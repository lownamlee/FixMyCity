"""Compute release metrics from reviewed, de-identified evaluation records."""
import argparse
import hashlib
import json
from collections import Counter
from pathlib import Path


def evaluate(path):
    data = path.read_bytes()
    counts, labels = Counter(), set()
    records = [json.loads(line) for line in data.decode('utf-8').splitlines() if line.strip()]
    if not records:
        raise ValueError('Evaluation data is empty.')
    for item in records:
        expected, predicted = item.get('expectedCategory'), item.get('predictedCategory')
        if not isinstance(expected, str) or not isinstance(predicted, str):
            raise ValueError('Every record needs expected and predicted categories.')
        labels.update((expected, predicted))
        counts[('expected', expected)] += 1
        counts[('predicted', predicted)] += 1
        if expected == predicted:
            counts[('true', expected)] += 1
        for name in ('expectedDuplicate', 'predictedDuplicate'):
            if not isinstance(item.get(name), bool):
                raise ValueError('Duplicate labels must be reviewed booleans.')
        counts[('dup', item['expectedDuplicate'], item['predictedDuplicate'])] += 1
    f1s = []
    for label in sorted(labels):
        true = counts[('true', label)]
        denom = counts[('expected', label)] + counts[('predicted', label)]
        f1s.append(2 * true / denom if denom else 0)
    tp = counts[('dup', True, True)]
    fp = counts[('dup', False, True)]
    fn = counts[('dup', True, False)]
    return {'datasetSha256': hashlib.sha256(data).hexdigest(), 'records': len(records),
            'categoryMacroF1': sum(f1s) / len(f1s),
            'duplicatePrecision': tp / (tp + fp) if tp + fp else 0,
            'duplicateRecall': tp / (tp + fn) if tp + fn else 0}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--records', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    result = evaluate(args.records)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
