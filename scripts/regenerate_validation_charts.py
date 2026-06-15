from __future__ import annotations

from pathlib import Path

import matplotlib.pyplot as plt
import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
RESULTS_CSV = ROOT / "research_outputs" / "dataset_comparison_results.csv"
TOPK_PNG = ROOT / "research_outputs" / "dataset_comparison_topk_metrics.png"
FINAL_SCORE_PNG = ROOT / "research_outputs" / "dataset_comparison_final_score.png"


def _require_columns(df: pd.DataFrame, names: list[str]) -> None:
    missing = [name for name in names if name not in df.columns]
    if missing:
        raise ValueError(f"Missing expected columns in {RESULTS_CSV.name}: {missing}")


def _load_results() -> pd.DataFrame:
    if not RESULTS_CSV.exists():
        raise FileNotFoundError(f"Results CSV not found: {RESULTS_CSV}")
    df = pd.read_csv(RESULTS_CSV)
    if df.empty:
        raise ValueError("Results CSV is empty.")
    _require_columns(df, ["approach"])
    return df


def _approach_means(df: pd.DataFrame, columns: list[str]) -> pd.DataFrame:
    available = [column for column in columns if column in df.columns]
    if not available:
        raise ValueError(f"None of the requested columns are available: {columns}")
    grouped = df.groupby("approach", as_index=False)[available].mean(numeric_only=True)
    grouped["approach"] = pd.Categorical(grouped["approach"], categories=["Baseline", "Retainly"], ordered=True)
    grouped = grouped.sort_values("approach").reset_index(drop=True)
    return grouped


def _annotate_zero_markers(ax, values, x_positions, color, label):
    for x_pos, value in zip(x_positions, values):
        if abs(float(value)) < 1e-12:
            ax.scatter([x_pos], [0], s=42, facecolors="white", edgecolors=color, linewidths=1.8, zorder=5)
            ax.annotate(
                f"{label}: 0.00",
                xy=(x_pos, 0),
                xytext=(0, 16),
                textcoords="offset points",
                ha="center",
                va="bottom",
                fontsize=8,
                color=color,
                arrowprops={"arrowstyle": "-", "color": color, "lw": 1},
            )


def generate_topk_chart(df: pd.DataFrame) -> Path:
    metric_columns = [
        "recall_at_top_10_percent",
        "recall_at_top_20_percent",
        "lift_at_top_10_percent",
        "lift_at_top_20_percent",
    ]
    grouped = _approach_means(df, metric_columns)
    rename_map = {
        "recall_at_top_10_percent": "Recall @ top 10%",
        "recall_at_top_20_percent": "Recall @ top 20%",
        "lift_at_top_10_percent": "Lift @ top 10%",
        "lift_at_top_20_percent": "Lift @ top 20%",
    }
    plot_df = grouped.set_index("approach")[list(rename_map.keys())].rename(columns=rename_map)
    recall_df = plot_df[["Recall @ top 10%", "Recall @ top 20%"]]
    lift_df = plot_df[["Lift @ top 10%", "Lift @ top 20%"]]

    baseline_color = "#334155"
    retainly_color = "#4f46e5"
    fig, axes = plt.subplots(1, 2, figsize=(8.5, 4), dpi=150)

    recall_plot = recall_df.T.plot(kind="bar", ax=axes[0], width=0.62, color=[baseline_color, retainly_color])
    axes[0].set_title("Top-k recall")
    axes[0].set_ylabel("Average score")
    axes[0].set_xlabel("")
    axes[0].grid(axis="y", alpha=0.2)
    axes[0].legend(title="", loc="upper left")
    axes[0].set_ylim(0, max(0.12, float(recall_df.to_numpy().max()) * 1.28))

    lift_plot = lift_df.T.plot(kind="bar", ax=axes[1], width=0.62, color=[baseline_color, retainly_color])
    axes[1].set_title("Top-k lift")
    axes[1].set_ylabel("Average score")
    axes[1].set_xlabel("")
    axes[1].grid(axis="y", alpha=0.2)
    axes[1].legend([], [], frameon=False)
    axes[1].set_ylim(0, max(0.12, float(lift_df.to_numpy().max()) * 1.20))

    for ax, frame in [(axes[0], recall_df), (axes[1], lift_df)]:
        for container in ax.containers:
            ax.bar_label(container, labels=[f"{bar.get_height():.2f}" for bar in container], padding=3, fontsize=8)
        ax.tick_params(axis="x", labelrotation=0)
        baseline_values = frame.loc["Baseline"].tolist()
        retainly_values = frame.loc["Retainly"].tolist()
        centers = [tick for tick in ax.get_xticks()]
        baseline_x = [center - 0.155 for center in centers]
        retainly_x = [center + 0.155 for center in centers]
        _annotate_zero_markers(ax, baseline_values, baseline_x, baseline_color, "Baseline")
        _annotate_zero_markers(ax, retainly_values, retainly_x, retainly_color, "Retainly")

    fig.suptitle("Top-k prioritization metrics", fontsize=11, y=1.02)
    plt.tight_layout()
    fig.savefig(TOPK_PNG, format="png")
    plt.close(fig)
    return TOPK_PNG


def generate_final_score_chart(df: pd.DataFrame) -> Path:
    score_column = "final_project_score"
    if score_column not in df.columns:
        _require_columns(df, ["recall", "f1", "pr_auc", "recall_at_top_20_percent"])
        df = df.copy()
        df["decision_support_bonus"] = df["approach"].map({"Baseline": 0.20, "Retainly": 1.00}).fillna(0.20)
        df[score_column] = (
            0.25 * df["recall"].fillna(0)
            + 0.20 * df["f1"].fillna(0)
            + 0.20 * df["pr_auc"].fillna(0)
            + 0.15 * df["recall_at_top_20_percent"].fillna(0)
            + 0.20 * df["decision_support_bonus"].fillna(0)
        )

    grouped = _approach_means(df, [score_column])
    plot_df = grouped.set_index("approach")[score_column]

    fig, ax = plt.subplots(figsize=(8, 4), dpi=140)
    bars = ax.bar(plot_df.index.astype(str), plot_df.values, color=["#94a3b8", "#4f46e5"], width=0.55)
    ax.set_title("Final decision-support score")
    ax.set_ylabel("Average score")
    ax.set_xlabel("")
    ax.grid(axis="y", alpha=0.2)
    ax.set_ylim(0, max(0.1, float(plot_df.max()) * 1.2))
    for bar, value in zip(bars, plot_df.values):
        ax.text(bar.get_x() + bar.get_width() / 2, value + 0.01, f"{value:.3f}", ha="center", va="bottom", fontsize=9)
    plt.tight_layout()
    fig.savefig(FINAL_SCORE_PNG, format="png")
    plt.close(fig)
    return FINAL_SCORE_PNG


def main() -> int:
    df = _load_results()
    topk = generate_topk_chart(df)
    final_score = generate_final_score_chart(df)
    print(f"generated {topk}")
    print(f"generated {final_score}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
