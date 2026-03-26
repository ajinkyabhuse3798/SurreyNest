"""Model evaluation for the SurreyNest rent model."""

from __future__ import annotations

import logging
from datetime import datetime
from pathlib import Path
from typing import Dict

import joblib
import numpy as np
import pandas as pd

from app.ml.calibration import (
    apply_prediction_calibration,
    interval_half_width_for_type,
    property_type_series_from_frame,
)
from app.ml.train import (
    FEATURES_PATH,
    MODEL_PATH,
    MODEL_VERSION,
    compute_metrics,
    cross_validate_model,
    prepare_training_frame,
)

logger = logging.getLogger(__name__)

REPORT_PATH = MODEL_PATH.parent / "evaluation_report.md"
PLOTS_DIR = MODEL_PATH.parent / "plots"


def get_feature_importance(pipeline, feature_cols: list[str]) -> pd.DataFrame:
    """Extract feature importances from the trained XGBoost model."""
    model = pipeline.named_steps["model"]
    return (
        pd.DataFrame(
            {
                "feature": feature_cols,
                "importance": model.feature_importances_,
            }
        )
        .sort_values("importance", ascending=False)
        .reset_index(drop=True)
    )


def plot_feature_importance(imp_df: pd.DataFrame, save_path: Path) -> None:
    """Save feature importance chart."""
    try:
        import matplotlib

        matplotlib.use("Agg")
        import matplotlib.pyplot as plt

        fig, ax = plt.subplots(figsize=(10, 6))
        top = imp_df.head(15)
        ax.barh(top["feature"][::-1], top["importance"][::-1], color="#2563eb")
        ax.set_xlabel("Importance")
        ax.set_title("Feature Importance")
        plt.tight_layout()
        save_path.parent.mkdir(parents=True, exist_ok=True)
        fig.savefig(str(save_path), dpi=150)
        plt.close(fig)
    except ImportError:
        logger.warning("matplotlib not installed, skipping feature importance plot")


def plot_residuals(y_true: np.ndarray, y_pred: np.ndarray, save_path: Path) -> None:
    """Save residual plot."""
    try:
        import matplotlib

        matplotlib.use("Agg")
        import matplotlib.pyplot as plt

        residuals = y_true - y_pred
        fig, ax = plt.subplots(figsize=(10, 6))
        ax.scatter(y_pred, residuals, alpha=0.5, s=12, color="#dc2626")
        ax.axhline(y=0, color="black", linestyle="--", linewidth=0.8)
        ax.set_xlabel("Predicted rent (£/week)")
        ax.set_ylabel("Residual (actual - predicted)")
        ax.set_title("Out-of-Fold Residuals")
        plt.tight_layout()
        save_path.parent.mkdir(parents=True, exist_ok=True)
        fig.savefig(str(save_path), dpi=150)
        plt.close(fig)
    except ImportError:
        logger.warning("matplotlib not installed, skipping residual plot")


def plot_prediction_distribution(y_pred: np.ndarray, save_path: Path) -> Dict[str, float]:
    """Save calibrated prediction distribution plot and summary stats."""
    stats = {
        "mean": round(float(np.mean(y_pred)), 2),
        "median": round(float(np.median(y_pred)), 2),
        "std": round(float(np.std(y_pred)), 2),
        "min": round(float(np.min(y_pred)), 2),
        "max": round(float(np.max(y_pred)), 2),
    }

    try:
        import matplotlib

        matplotlib.use("Agg")
        import matplotlib.pyplot as plt

        fig, ax = plt.subplots(figsize=(10, 6))
        ax.hist(y_pred, bins=30, color="#16a34a", edgecolor="white", alpha=0.8)
        ax.axvline(stats["mean"], color="red", linestyle="--", label=f"Mean £{stats['mean']:.0f}")
        ax.axvline(stats["median"], color="blue", linestyle="--", label=f"Median £{stats['median']:.0f}")
        ax.set_xlabel("Predicted weekly rent (£)")
        ax.set_ylabel("Count")
        ax.set_title("Calibrated Prediction Distribution")
        ax.legend()
        plt.tight_layout()
        save_path.parent.mkdir(parents=True, exist_ok=True)
        fig.savefig(str(save_path), dpi=150)
        plt.close(fig)
    except ImportError:
        logger.warning("matplotlib not installed, skipping prediction distribution plot")

    return stats


def generate_report(
    *,
    metrics: Dict[str, float],
    importance_df: pd.DataFrame,
    dist_stats: Dict[str, float],
    avg_interval_half_width: float,
    report_path: Path,
) -> str:
    """Generate a concise markdown report for the current model."""
    lines = [
        "# Model Evaluation Report",
        "",
        f"**Model:** rent_model {MODEL_VERSION}",
        f"**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        "",
        "---",
        "",
        "## 1. Primary Metrics",
        "",
        f"- Evaluation method: `{metrics['cv_method']}` on real observed rents only",
        f"- MAE: `£{metrics['mae']:.2f}/week`",
        f"- RMSE: `£{metrics['rmse']:.2f}/week`",
        f"- R²: `{metrics['r2']:.4f}`",
        f"- MAPE: `{metrics['mape']:.2f}%`",
        "",
        "## 2. Calibration Lift",
        "",
        f"- Raw out-of-fold MAE: `£{metrics['raw_mae']:.2f}/week`",
        f"- Calibrated out-of-fold MAE: `£{metrics['mae']:.2f}/week`",
        f"- Raw out-of-fold R²: `{metrics['raw_r2']:.4f}`",
        f"- Calibrated out-of-fold R²: `{metrics['r2']:.4f}`",
        "",
        "## 3. Interval Quality",
        "",
        f"- Nominal interval: `80%`",
        f"- Observed coverage: `{metrics['interval_coverage'] * 100:.1f}%`",
        f"- Average half-width: `£{avg_interval_half_width:.2f}/week`",
        "",
        "## 4. Dataset",
        "",
        f"- Training rows: `{metrics['train_size']}`",
        f"- Postcode-sector groups: `{metrics['group_count']}`",
        f"- Feature count: `{metrics['n_features']}`",
        "",
        "## 5. Top Features",
        "",
        "| Rank | Feature | Importance |",
        "|------|---------|------------|",
    ]

    for rank, (_, row) in enumerate(importance_df.head(15).iterrows(), start=1):
        lines.append(f"| {rank} | {row['feature']} | {row['importance']:.4f} |")

    lines.extend(
        [
            "",
            "![Feature Importance](plots/feature_importance.png)",
            "",
            "## 6. Prediction Distribution",
            "",
            f"- Mean: `£{dist_stats['mean']:.2f}/week`",
            f"- Median: `£{dist_stats['median']:.2f}/week`",
            f"- Std dev: `£{dist_stats['std']:.2f}`",
            f"- Range: `£{dist_stats['min']:.2f}` to `£{dist_stats['max']:.2f}`",
            "",
            "![Prediction Distribution](plots/prediction_distribution.png)",
            "",
            "## 7. Residual View",
            "",
            "![Residuals](plots/residuals.png)",
            "",
        ]
    )

    report = "\n".join(lines)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(report)
    return report


def run_evaluation() -> None:
    """Run evaluation against the current features file and saved artifact."""
    logger.info("Starting model evaluation for %s", MODEL_VERSION)

    if not FEATURES_PATH.exists():
        raise FileNotFoundError(f"Features not found: {FEATURES_PATH}")
    if not MODEL_PATH.exists():
        raise FileNotFoundError(f"Model not found: {MODEL_PATH}")

    df = pd.read_csv(str(FEATURES_PATH), low_memory=False)
    training_df, X, y, feature_cols, groups = prepare_training_frame(df)
    property_types = property_type_series_from_frame(training_df)
    postcode_sectors = training_df["postcode_sector"].fillna("").astype(str)
    postcodes = training_df["postcode"].fillna("").astype(str)

    metrics, raw_oof, calibrated_oof, calibration_artifact, interval_artifact = (
        cross_validate_model(X, y, groups, property_types, postcode_sectors, postcodes)
    )
    metrics.update(
        {
            "train_size": int(len(X)),
            "group_count": int(pd.Series(groups).nunique()),
            "n_features": int(len(feature_cols)),
        }
    )

    pipeline = joblib.load(str(MODEL_PATH))
    importance_df = get_feature_importance(pipeline, feature_cols)

    full_raw_predictions = np.expm1(pipeline.predict(X))
    full_predictions = np.array(
        [
            apply_prediction_calibration(
                prediction,
                property_type,
                calibration_artifact,
                postcode_sector,
                postcode,
            )
            for prediction, property_type, postcode_sector, postcode in zip(
                full_raw_predictions,
                property_types,
                postcode_sectors,
                postcodes,
            )
        ],
        dtype=float,
    )

    avg_interval_half_width = float(
        np.mean(
            [
                interval_half_width_for_type(property_type, interval_artifact)
                for property_type in property_types
            ]
        )
    )

    plot_feature_importance(importance_df, PLOTS_DIR / "feature_importance.png")
    plot_residuals(y.to_numpy(dtype=float), calibrated_oof, PLOTS_DIR / "residuals.png")
    dist_stats = plot_prediction_distribution(
        full_predictions,
        PLOTS_DIR / "prediction_distribution.png",
    )

    generate_report(
        metrics=metrics,
        importance_df=importance_df,
        dist_stats=dist_stats,
        avg_interval_half_width=avg_interval_half_width,
        report_path=REPORT_PATH,
    )

    logger.info(
        "Evaluation complete: MAE=£%.2f RMSE=£%.2f R²=%.4f interval_coverage=%.1f%%",
        metrics["mae"],
        metrics["rmse"],
        metrics["r2"],
        metrics["interval_coverage"] * 100,
    )


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(name)s %(levelname)s %(message)s",
    )
    run_evaluation()
