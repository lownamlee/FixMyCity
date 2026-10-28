#!/usr/bin/env python3
"""Evaluate multilingual speech recognition and PII detection from de-identified JSONL.

Each input line must be a JSON object with:
  language: "BM" or "EN"
  reference: reference transcript string
  hypothesis: recognized transcript string
  pii_reference: list of reference PII spans (strings)
  pii_detected: list of detected PII spans (strings)

The report contains aggregate metrics only. Transcript and span values are never
printed. Inputs must already be de-identified before evaluation.
"""
from __future__ import annotations

import argparse
import json
import math
import sys
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Iterable

LANGUAGES = ("BM", "EN")


class EvaluationError(Exception):
    """An input or evaluation error that can be reported without exposing data."""


def normalize_text(value: str) -> str:
    """Apply Unicode canonicalization, case folding, and whitespace normalization."""
    value = unicodedata.normalize("NFKC", value).casefold()
    # Treat punctuation and symbols as token boundaries, retaining letters/numbers
    # from every script and combining marks attached to them.
    pieces: list[str] = []
    for char in value:
        category = unicodedata.category(char)
        if category[0] in {"P", "S", "Z", "C"}:
            pieces.append(" ")
        else:
            pieces.append(char)
    return " ".join("".join(pieces).split())


def tokens(value: str) -> list[str]:
    normalized = normalize_text(value)
    return normalized.split() if normalized else []


def edit_counts(reference: list[str], hypothesis: list[str]) -> tuple[int, int, int, int]:
    """Return substitutions, deletions, insertions, and reference token count."""
    # Dynamic programming with deterministic tie-breaking: substitution, deletion,
    # insertion. Backtracking lets us report the conventional WER components.
    rows, cols = len(reference) + 1, len(hypothesis) + 1
    cost = [[0] * cols for _ in range(rows)]
    prev = [[""] * cols for _ in range(rows)]
    for i in range(1, rows):
        cost[i][0], prev[i][0] = i, "D"
    for j in range(1, cols):
        cost[0][j], prev[0][j] = j, "I"
    for i in range(1, rows):
        for j in range(1, cols):
            if reference[i - 1] == hypothesis[j - 1]:
                cost[i][j], prev[i][j] = cost[i - 1][j - 1], "M"
            else:
                choices = (
                    (cost[i - 1][j - 1] + 1, "S"),
                    (cost[i - 1][j] + 1, "D"),
                    (cost[i][j - 1] + 1, "I"),
                )
                cost[i][j], prev[i][j] = min(choices, key=lambda item: item[0])
    substitutions = deletions = insertions = 0
    i, j = len(reference), len(hypothesis)
    while i or j:
        op = prev[i][j]
        if op == "S":
            substitutions += 1
            i -= 1
            j -= 1
        elif op == "D":
            deletions += 1
            i -= 1
        elif op == "I":
            insertions += 1
            j -= 1
        else:  # match
            i -= 1
            j -= 1
    return substitutions, deletions, insertions, len(reference)


def validate_record(record: Any, line_no: int) -> tuple[str, str, str, list[str], list[str]]:
    if not isinstance(record, dict):
        raise EvaluationError(f"line {line_no}: expected a JSON object")
    language = record.get("language")
    if not isinstance(language, str) or language.upper() not in LANGUAGES:
        raise EvaluationError(f"line {line_no}: language must be BM or EN")
    language = language.upper()
    reference, hypothesis = record.get("reference"), record.get("hypothesis")
    if not isinstance(reference, str) or not isinstance(hypothesis, str):
        raise EvaluationError(f"line {line_no}: reference and hypothesis must be strings")
    pii_ref, pii_found = record.get("pii_reference"), record.get("pii_detected")
    if not isinstance(pii_ref, list) or not all(isinstance(x, str) for x in pii_ref):
        raise EvaluationError(f"line {line_no}: pii_reference must be a list of strings")
    if not isinstance(pii_found, list) or not all(isinstance(x, str) for x in pii_found):
        raise EvaluationError(f"line {line_no}: pii_detected must be a list of strings")
    return language, reference, hypothesis, pii_ref, pii_found


def safe_rate(numerator: int, denominator: int) -> float | None:
    return numerator / denominator if denominator else None


def evaluate(paths: Iterable[Path], min_samples: int) -> dict[str, Any]:
    stats: dict[str, dict[str, int]] = defaultdict(Counter)
    total_samples = 0
    for path in paths:
        try:
            stream = path.open("r", encoding="utf-8-sig")
        except OSError as exc:
            raise EvaluationError(f"cannot read input file: {path} ({exc.strerror})") from None
        with stream:
            for line_no, line in enumerate(stream, 1):
                if not line.strip():
                    continue
                try:
                    record = json.loads(line)
                except json.JSONDecodeError:
                    raise EvaluationError(f"{path}, line {line_no}: invalid JSON") from None
                lang, ref, hyp, pii_ref, pii_found = validate_record(record, line_no)
                s, d, ins, nref = edit_counts(tokens(ref), tokens(hyp))
                bucket = stats[lang]
                bucket["samples"] += 1
                bucket["substitutions"] += s
                bucket["deletions"] += d
                bucket["insertions"] += ins
                bucket["reference_words"] += nref
                # PII spans are canonicalized and compared as normalized exact matches.
                reference_spans = [normalize_text(x) for x in pii_ref if normalize_text(x)]
                detected_spans = [normalize_text(x) for x in pii_found if normalize_text(x)]
                ref_counts, found_counts = Counter(reference_spans), Counter(detected_spans)
                bucket["pii_reference_spans"] += sum(ref_counts.values())
                bucket["pii_detected_spans"] += sum(found_counts.values())
                bucket["pii_true_positives"] += sum((ref_counts & found_counts).values())
                total_samples += 1
    if total_samples == 0:
        raise EvaluationError("no usable JSONL records found")
    missing = [lang for lang in LANGUAGES if stats[lang]["samples"] < min_samples]
    if missing:
        counts = ", ".join(f"{lang}={stats[lang]['samples']}" for lang in LANGUAGES)
        raise EvaluationError(
            f"minimum sample requirement not met (need {min_samples} per language; got {counts})"
        )
    report: dict[str, Any] = {
        "metric_version": 1,
        "normalization": "Unicode NFKC, case-folded, punctuation/symbol/space token boundaries",
        "pii_matching": "normalized exact span match; duplicate spans counted",
        "total_samples": total_samples,
        "languages": {},
    }
    for lang in LANGUAGES:
        item = stats[lang]
        errors = item["substitutions"] + item["deletions"] + item["insertions"]
        report["languages"][lang] = {
            "samples": item["samples"],
            "word_error_rate": safe_rate(errors, item["reference_words"]),
            "word_errors": errors,
            "reference_words": item["reference_words"],
            "substitutions": item["substitutions"],
            "deletions": item["deletions"],
            "insertions": item["insertions"],
            "pii_detection_recall": safe_rate(item["pii_true_positives"], item["pii_reference_spans"]),
            "pii_reference_spans": item["pii_reference_spans"],
            "pii_detected_spans": item["pii_detected_spans"],
            "pii_true_positives": item["pii_true_positives"],
        }
    return report


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Compute aggregate BM/EN speech WER and PII detection recall from de-identified JSONL."
    )
    parser.add_argument("inputs", nargs="+", type=Path, help="JSONL input file(s); records are combined")
    parser.add_argument("--min-samples", type=int, default=1,
                        help="minimum number of records required for each language (default: 1)")
    parser.add_argument("--output", type=Path,
                        help="write aggregate JSON report to this path (default: stdout)")
    args = parser.parse_args(argv)
    if args.min_samples < 1:
        parser.error("--min-samples must be at least 1")
    return args


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        report = evaluate(args.inputs, args.min_samples)
        rendered = json.dumps(report, ensure_ascii=False, indent=2, allow_nan=False) + "\n"
        if args.output:
            try:
                args.output.write_text(rendered, encoding="utf-8")
            except OSError as exc:
                raise EvaluationError(f"cannot write output file: {args.output} ({exc.strerror})") from None
        else:
            sys.stdout.write(rendered)
        return 0
    except EvaluationError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
