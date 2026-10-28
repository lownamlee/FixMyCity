"""Generate the README's SVG charts from the documented project scenarios.

Run with: uv run --no-project --with matplotlib python docs/generate_charts.py
Pass --preview-dir PATH to also render PNG previews outside the repository.
"""
from pathlib import Path
import argparse

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.ticker import FuncFormatter, MultipleLocator

ROOT = Path(__file__).resolve().parent
OUTPUT = ROOT / "assets"
NAVY = "#102849"
BLUE = "#0969DA"
TEAL = "#087F8C"
ORANGE = "#C65F13"
MUTED = "#53657C"
GRID = "#E5EBF3"

plt.rcParams.update({
    "font.family": "DejaVu Sans",
    "font.size": 11,
    "text.color": NAVY,
    "axes.labelcolor": MUTED,
    "xtick.color": MUTED,
    "ytick.color": MUTED,
    "svg.fonttype": "none",
    "svg.hashsalt": "fixmycity-readme",
})


def canvas(title: str, subtitle: str, height: float = 5.2):
    fig = plt.figure(figsize=(11, height), facecolor="white")
    fig.text(0.07, 0.92, title, fontsize=21, weight="bold", va="top")
    fig.text(0.07, 0.83, subtitle, fontsize=11, color=MUTED, va="top")
    return fig


def finish(fig, name: str, preview: Path | None):
    OUTPUT.mkdir(parents=True, exist_ok=True)
    fig.savefig(OUTPUT / f"{name}.svg", facecolor="white",
                metadata={"Date": None, "Creator": "FixMyCity chart generator"})
    if preview:
        preview.mkdir(parents=True, exist_ok=True)
        fig.savefig(preview / f"{name}.png", dpi=150, facecolor="white")
    plt.close(fig)


def complaint_forwarding(preview: Path | None):
    total, forwarded = 72_071, 49_217
    remaining = total - forwarded
    proportion = forwarded / total * 100
    fig = canvas("Complaint routing crosses agency boundaries",
                 "MYJalan complaints · August 2023–September 2026", 4.5)
    fig.text(0.07, 0.60, f"{total:,}", fontsize=36, weight="bold")
    fig.text(0.30, 0.62, "complaints in the reported total", color=MUTED)
    ax = fig.add_axes((0.07, 0.37, 0.86, 0.14))
    ax.barh([0], [forwarded], color=BLUE, height=0.8)
    ax.barh([0], [remaining], left=[forwarded], color="#DFE9F7", height=0.8)
    ax.text(forwarded / 2, 0, f"{proportion:.1f}%", color="white",
            ha="center", va="center", fontsize=20, weight="bold")
    ax.text(forwarded + remaining / 2, 0, f"{100-proportion:.1f}%",
            ha="center", va="center", fontsize=20, weight="bold")
    ax.set_xlim(0, total)
    ax.axis("off")
    fig.text(0.07, 0.27, "49,217 forwarded outside KKR", color=BLUE, weight="bold")
    fig.text(0.64, 0.27, "22,854 remaining complaints", color=MUTED)
    fig.text(0.07, 0.10, "Remaining complaints = total complaints − complaints forwarded outside KKR.",
             fontsize=10, color=MUTED)
    finish(fig, "complaint-forwarding", preview)


def handling_time(preview: Path | None):
    manual, proposed, cases = 8, 3, 1_000
    reduction = (manual - proposed) / manual * 100
    hours = (manual - proposed) * cases / 60
    fig = canvas("Less administration. More capacity for action.",
                 "Estimated staff handling time · scenario for 1,000 routine cases per month")
    ax = fig.add_axes((0.25, 0.32, 0.48, 0.38))
    ax.barh([1, 0], [manual, proposed], height=0.45, color=["#8296B1", BLUE])
    ax.set_yticks([1, 0], ["Manual workflow", "FixMyCity scenario"])
    ax.set_xlim(0, 9)
    ax.set_xlabel("Minutes per case", labelpad=10)
    ax.xaxis.set_major_locator(MultipleLocator(2))
    ax.grid(axis="x", color=GRID)
    ax.set_axisbelow(True)
    for spine in ax.spines.values():
        spine.set_visible(False)
    ax.tick_params(axis="both", length=0, pad=9)
    for y, value in [(1, manual), (0, proposed)]:
        ax.text(value + 0.15, y, f"{value} min", va="center", weight="bold", fontsize=12)
    fig.text(0.77, 0.57, f"{reduction:.1f}%", fontsize=30, weight="bold", color=BLUE)
    fig.text(0.77, 0.49, "less handling time", fontsize=10, color=MUTED)
    fig.text(0.07, 0.15, f"{hours:.1f} staff hours released / month", color=BLUE, fontsize=13, weight="bold")
    fig.text(0.07, 0.07, "Pilot target: 1,000 routine cases / month × 5 minutes saved per case = 83.3 hours of staff capacity.",
             fontsize=10, color=MUTED)
    finish(fig, "handling-time", preview)


def financial_scenario(preview: Path | None):
    areas = list(range(1, 11))
    price, cost = 1_500, 835
    contribution = price - cost
    assert contribution == 665
    series = [
        ("Subscription revenue", price, BLUE, "o"),
        ("Operating cost", cost, ORANGE, "s"),
        ("Contribution before overhead", contribution, TEAL, "D"),
    ]
    fig = canvas("A council-funded model, free for residents",
                 "Illustrative monthly scenario · 1,000 routine cases per service area", 6.1)
    ax = fig.add_axes((0.10, 0.30, 0.77, 0.43))
    for label, unit, color, marker in series:
        values = [unit * n for n in areas]
        ax.plot(areas, values, label=label, color=color, linewidth=2.5,
                marker=marker, markersize=4.5)
        ax.annotate(f"RM{values[-1]:,}", (10, values[-1]), xytext=(9, 0),
                    textcoords="offset points", va="center", color=color,
                    weight="bold", fontsize=10, annotation_clip=False)
    ax.set_xlim(1, 10)
    ax.set_ylim(0, 16_500)
    ax.set_xticks(areas)
    ax.yaxis.set_major_locator(MultipleLocator(5_000))
    ax.yaxis.set_major_formatter(FuncFormatter(lambda value, _: f"RM{value:,.0f}"))
    ax.set_xlabel("Council service areas", labelpad=9)
    ax.grid(axis="y", color=GRID)
    ax.set_axisbelow(True)
    for spine in ax.spines.values():
        spine.set_visible(False)
    ax.tick_params(axis="both", length=0, pad=9)
    handles, labels = ax.get_legend_handles_labels()
    fig.legend(handles, labels, loc="center", bbox_to_anchor=(0.51, 0.15),
               ncol=3, frameon=False, fontsize=10, handlelength=2)
    fig.text(0.07, 0.065, "Assumes unchanged pricing, volume and unit costs as areas increase. Excludes setup fees and overhead.",
             fontsize=9.5, color=MUTED)
    finish(fig, "financial-scenario", preview)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--preview-dir", type=Path)
    args = parser.parse_args()
    for chart in [complaint_forwarding, handling_time, financial_scenario]:
        chart(args.preview_dir)
    print(f"Generated three SVG charts in {OUTPUT}")
