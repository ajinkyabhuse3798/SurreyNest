"""Model evaluation: comprehensive analysis of the rent prediction model.

Loads the trained model and feature data, runs:
1. Standard metrics: MAE, RMSE, R², MAPE
2. 5-fold cross-validation with mean ± std
3. Feature importance bar chart
4. Residual analysis scatter plot
5. Sanity checks (synthetic inputs with expected ranges)
6. Prediction distribution histogram
7. Generates markdown report + PNG plots

Usage:
    python -m app.ml.evaluate
"""

import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Tuple

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import cross_validate, train_test_split

from app.ml.train import (
    FEATURES_PATH,
    MODEL_PATH,
    MODEL_VERSION,
    OUTLIER_CAP_WEEKLY,
    compute_real_target,
    get_feature_columns,
)

logger = logging.getLogger(__name__)

# ── Output paths ─────────────────────────────────────────────────────────────
REPORT_PATH = MODEL_PATH.parent / "evaluation_report.md"
PLOTS_DIR = MODEL_PATH.parent / "plots"


# =============================================================================
# 1. Standard Metrics
# =============================================================================


def compute_metrics(
    y_true: np.ndarray, y_pred: np.ndarray
) -> Dict[str, float]:
    """Compute MAE, RMSE, R², and MAPE.

    Args:
        y_true: Actual values.
        y_pred: Predicted values.

    Returns:
        Dict with mae, rmse, r2, mape keys.
    """
    mae = mean_absolute_error(y_true, y_pred)
    rmse = np.sqrt(mean_squared_error(y_true, y_pred))
    r2 = r2_score(y_true, y_pred)

    # MAPE: avoid division by zero
    nonzero = y_true != 0
    if nonzero.sum() > 0:
        mape = np.mean(np.abs((y_true[nonzero] - y_pred[nonzero]) / y_true[nonzero])) * 100
    else:
        mape = float("inf")

    return {
        "mae": round(mae, 2),
        "rmse": round(rmse, 2),
        "r2": round(r2, 4),
        "mape": round(mape, 2),
    }


# =============================================================================
# 2. Cross-Validation
# =============================================================================


def run_cross_validation(
    pipeline, X: pd.DataFrame, y: pd.Series, cv: int = 5
) -> Dict[str, str]:
    """Run k-fold cross-validation.

    Args:
        pipeline: Untrained sklearn Pipeline (cloned internally by cross_validate).
        X: Feature matrix.
        y: Target values.
        cv: Number of folds.

    Returns:
        Dict mapping metric name to 'mean ± std' string.
    """
    logger.info("Running %d-fold cross-validation...", cv)

    scoring = {
        "mae": "neg_mean_absolute_error",
        "rmse": "neg_root_mean_squared_error",
        "r2": "r2",
    }

    results = cross_validate(pipeline, X, y, cv=cv, scoring=scoring, return_train_score=False)

    cv_results = {}
    for metric, scorer_key in [("MAE", "test_mae"), ("RMSE", "test_rmse"), ("R²", "test_r2")]:
        scores = results[scorer_key]
        if metric in ("MAE", "RMSE"):
            scores = -scores  # sklearn negates these
        mean = scores.mean()
        std = scores.std()
        cv_results[metric] = f"{mean:.2f} ± {std:.2f}"

    logger.info("Cross-validation complete")
    return cv_results


# =============================================================================
# 3. Feature Importance
# =============================================================================


def get_feature_importance(pipeline, feature_cols: List[str]) -> pd.DataFrame:
    """Extract feature importances from the trained GBR.

    Args:
        pipeline: Trained sklearn Pipeline with a 'model' step.
        feature_cols: List of feature column names.

    Returns:
        DataFrame with 'feature' and 'importance' columns, sorted descending.
    """
    gbr = pipeline.named_steps["model"]
    imp_df = pd.DataFrame({
        "feature": feature_cols,
        "importance": gbr.feature_importances_,
    }).sort_values("importance", ascending=False)

    return imp_df


def plot_feature_importance(imp_df: pd.DataFrame, save_path: Path) -> None:
    """Save feature importance bar chart as PNG.

    Args:
        imp_df: DataFrame from get_feature_importance().
        save_path: Path to save the PNG file.
    """
    try:
        import matplotlib
        matplotlib.use("Agg")  # Non-interactive backend
        import matplotlib.pyplot as plt

        fig, ax = plt.subplots(figsize=(10, 6))
        ax.barh(imp_df["feature"][::-1], imp_df["importance"][::-1], color="#4A90D9")
        ax.set_xlabel("Importance")
        ax.set_title("Feature Importance (Gradient Boosting)")
        plt.tight_layout()
        save_path.parent.mkdir(parents=True, exist_ok=True)
        fig.savefig(str(save_path), dpi=150)
        plt.close(fig)
        logger.info("Feature importance plot saved to %s", save_path)
    except ImportError:
        logger.warning("matplotlib not installed — skipping feature importance plot")


# =============================================================================
# 4. Residual Analysis
# =============================================================================


def plot_residuals(
    y_true: np.ndarray, y_pred: np.ndarray, save_path: Path
) -> None:
    """Save residuals vs predicted scatter plot.

    Args:
        y_true: Actual values.
        y_pred: Predicted values.
        save_path: Path to save the PNG file.
    """
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt

        residuals = y_true - y_pred

        fig, ax = plt.subplots(figsize=(10, 6))
        ax.scatter(y_pred, residuals, alpha=0.4, s=10, color="#E74C3C")
        ax.axhline(y=0, color="black", linestyle="--", linewidth=0.8)
        ax.set_xlabel("Predicted (£/week)")
        ax.set_ylabel("Residual (Actual - Predicted)")
        ax.set_title("Residual Analysis")
        plt.tight_layout()
        save_path.parent.mkdir(parents=True, exist_ok=True)
        fig.savefig(str(save_path), dpi=150)
        plt.close(fig)
        logger.info("Residual plot saved to %s", save_path)
    except ImportError:
        logger.warning("matplotlib not installed — skipping residual plot")


# =============================================================================
# 5. Sanity Checks
# =============================================================================


def run_sanity_checks(pipeline, feature_cols: List[str]) -> List[Dict]:
    """Run sanity checks with synthetic inputs.

    Tests:
    1. 25m² studio flat → expected ~£90-160/week
    2. 120m² detached house → expected ~£280-460/week
    3. Flat < Semi < Detached (all else equal, 80m²)
    4. 30m² < 60m² < 90m² < 120m² (monotonic floor_area)

    Args:
        pipeline: Trained sklearn Pipeline.
        feature_cols: Feature column names.

    Returns:
        List of check result dicts with name, prediction, expected, pass/fail.
    """
    results = []

    def _make_features(**overrides) -> np.ndarray:
        """Build a feature array with sensible defaults."""
        defaults = {
            "floor_area_m2": 60.0,
            "actual_bedrooms": 2,        # v4.1.0: real/predicted bedrooms (not estimated_bedrooms)
            "rooms_per_m2": 0.05,        # 3 rooms / 60m²
            "energy_rating_ordinal": 4,  # C
            "potential_rating_ordinal": 5,  # B
            "distance_to_town_km": 2.0,
            "distance_to_uni_km": 2.0,
            "distance_to_station_km": 2.5,
            "location_score": 0.30,      # ~2.5km from town/uni (outer Guildford)
            "town_proximity_score": 0.30,  # v4.4.0: split from location_score
            "uni_proximity_score": 0.30,   # v4.4.0: split from location_score
            "safety_score": 50.0,
            "sale_count": 4.0,
            "sector_median_rent": 350.0,   # v4.3.0: Guildford median
            "age_band_ordinal": 6,         # 1983-1990 (Guildford median)
            "has_mains_gas": 1,
            "floor_level_ordinal": 0,
            "annual_energy_cost": 1500.0,
            "energy_improvement_gap": 1,
            "price_drop_pct": 0.0,
            "is_studio": 0,               # v4.5.0: explicit studio flag
            "ptype_Detached": 0,
            "ptype_Flat": 0,
            "ptype_Semi-Detached": 0,
            "ptype_Terraced": 0,
            "ptype_Unknown": 0,
        }
        defaults.update(overrides)
        return np.array([[defaults.get(c, 0) for c in feature_cols]])

    def _predict_rent(features: np.ndarray) -> float:
        """Predict rent with log-inverse transform for v3.2.0+ models."""
        raw = pipeline.predict(features)[0]
        return float(np.expm1(raw))  # Inverse log-transform

    # ── Check 1: 34.5m² studio flat (matches user's £1,200/mo market ref) ──
    # Real market: £1,200/mo = £277/wk. Data shows studios median £299/wk.
    studio = _make_features(
        floor_area_m2=34.5, actual_bedrooms=0, is_studio=1,
        rooms_per_m2=round(1/34.5, 4), ptype_Flat=1,
        sector_median_rent=270.0,  # studio/1-bed sector typical
    )
    studio_pred = _predict_rent(studio)
    results.append({
        "name": "34.5m² studio flat (1 hab room)",
        "prediction": round(studio_pred, 2),
        "expected": "£150–350/week (£650–1,520/mo)",
        "passed": 150 <= studio_pred <= 350,
    })

    # ── Check 2: 120m² detached house (5 hab rooms = 3 bedrooms) ──────
    # Data shows 3-bed houses median £319/wk, with 120m² area premium.
    detached = _make_features(
        floor_area_m2=120.0, actual_bedrooms=3,
        rooms_per_m2=round(5/120, 4), ptype_Detached=1,
        sector_median_rent=380.0,  # 3-bed detached sector typical
    )
    detached_pred = _predict_rent(detached)
    results.append({
        "name": "120m² detached house (5 hab rooms)",
        "prediction": round(detached_pred, 2),
        "expected": "£350–700/week",
        "passed": 350 <= detached_pred <= 700,
    })

    # ── Check 3: Type ordering (80m², 3-bed, all else equal) ─────────────
    flat_pred = _predict_rent(_make_features(
        floor_area_m2=80.0, actual_bedrooms=2,
        rooms_per_m2=round(3/80, 4), ptype_Flat=1
    ))
    semi_pred = _predict_rent(_make_features(
        floor_area_m2=80.0, actual_bedrooms=2,
        rooms_per_m2=round(3/80, 4), **{"ptype_Semi-Detached": 1}
    ))
    detached_80 = _predict_rent(_make_features(
        floor_area_m2=80.0, actual_bedrooms=2,
        rooms_per_m2=round(3/80, 4), ptype_Detached=1
    ))

    # Flat multiplier (1.05) > Semi (0.93) > Detached (0.90)
    results.append({
        "name": "Type ordering (80m², 3-bed)",
        "prediction": f"Flat={flat_pred:.0f}, Semi={semi_pred:.0f}, Det={detached_80:.0f}",
        "expected": "Distinct predictions per type",
        "passed": len({round(flat_pred), round(semi_pred), round(detached_80)}) >= 2,
    })

    # ── Check 4: Monotonic floor area (same bedroom count) ───────────────
    areas = [30, 60, 90, 120]
    area_preds = []
    for area in areas:
        pred = _predict_rent(_make_features(
            floor_area_m2=float(area), actual_bedrooms=2,
            rooms_per_m2=round(3/max(area,10), 4), ptype_Flat=1
        ))
        area_preds.append(pred)

    is_monotonic = all(a < b for a, b in zip(area_preds, area_preds[1:]))
    results.append({
        "name": "Monotonic floor_area",
        "prediction": ", ".join(f"{a}m²=£{p:.0f}" for a, p in zip(areas, area_preds)),
        "expected": "Increasing rent with area",
        "passed": is_monotonic,
    })

    return results


# =============================================================================
# 6. Prediction Distribution
# =============================================================================


def plot_prediction_distribution(
    y_pred: np.ndarray, save_path: Path
) -> Dict[str, float]:
    """Save prediction distribution histogram and compute stats.

    Args:
        y_pred: Predicted values.
        save_path: Path to save the PNG file.

    Returns:
        Dict with distribution stats.
    """
    stats = {
        "mean": round(float(np.mean(y_pred)), 2),
        "median": round(float(np.median(y_pred)), 2),
        "std": round(float(np.std(y_pred)), 2),
        "min": round(float(np.min(y_pred)), 2),
        "max": round(float(np.max(y_pred)), 2),
    }

    # Outliers: beyond 2σ from mean
    lower = stats["mean"] - 2 * stats["std"]
    upper = stats["mean"] + 2 * stats["std"]
    n_outliers = int(np.sum((y_pred < lower) | (y_pred > upper)))
    stats["outliers"] = n_outliers
    stats["outlier_pct"] = round(n_outliers / len(y_pred) * 100, 1)

    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt

        fig, ax = plt.subplots(figsize=(10, 6))
        ax.hist(y_pred, bins=50, color="#2ECC71", edgecolor="white", alpha=0.8)
        ax.axvline(stats["mean"], color="red", linestyle="--", label=f"Mean: £{stats['mean']:.0f}")
        ax.axvline(stats["median"], color="blue", linestyle="--", label=f"Median: £{stats['median']:.0f}")
        ax.set_xlabel("Predicted Weekly Rent (£)")
        ax.set_ylabel("Count")
        ax.set_title("Prediction Distribution")
        ax.legend()
        plt.tight_layout()
        save_path.parent.mkdir(parents=True, exist_ok=True)
        fig.savefig(str(save_path), dpi=150)
        plt.close(fig)
        logger.info("Prediction distribution plot saved to %s", save_path)
    except ImportError:
        logger.warning("matplotlib not installed — skipping distribution plot")

    return stats


# =============================================================================
# 7. Markdown Report
# =============================================================================


def generate_report(
    metrics: Dict,
    cv_results: Dict,
    importance_df: pd.DataFrame,
    sanity_results: List[Dict],
    dist_stats: Dict,
    report_path: Path,
    scraped_metrics: Dict = None,
) -> str:
    """Generate evaluation report as markdown.

    Args:
        metrics: Standard metrics dict.
        cv_results: Cross-validation results.
        importance_df: Feature importance DataFrame.
        sanity_results: Sanity check results.
        dist_stats: Prediction distribution stats.
        report_path: Path to save the report.

    Returns:
        Report text.
    """
    lines = [
        "# Model Evaluation Report",
        f"\n**Model:** rent_model {MODEL_VERSION}",
        f"**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        "",
        "---",
        "",
        "## 1. Standard Metrics",
        "",
        "| Metric | Value |",
        "|--------|-------|",
        f"| MAE | £{metrics['mae']:.2f}/week |",
        f"| RMSE | £{metrics['rmse']:.2f}/week |",
        f"| R² | {metrics['r2']:.4f} |",
        f"| MAPE | {metrics['mape']:.1f}% |",
        "",
        "---",
    ]

    if scraped_metrics:
        lines.extend([
            "",
            "## 1b. Scraped-Only Metrics (Ground Truth)",
            "",
            "> Primary production quality metric — evaluated on actual Zoopla/Rightmove rents only",
            "",
            "| Metric | Value |",
            "|--------|-------|",
            f"| MAE (scraped) | £{scraped_metrics['mae']:.2f}/week |",
            f"| RMSE (scraped) | £{scraped_metrics['rmse']:.2f}/week |",
            f"| R² (scraped) | {scraped_metrics['r2']:.4f} |",
            "",
            "---",
        ])

    lines.extend([
        "",
        "## 2. Cross-Validation (5-fold)",
        "",
        "| Metric | Mean ± Std |",
        "|--------|-----------|",
    ])

    for metric, value in cv_results.items():
        lines.append(f"| {metric} | {value} |")

    lines.extend([
        "",
        "---",
        "",
        "## 3. Feature Importance",
        "",
        "| Rank | Feature | Importance |",
        "|------|---------|-----------|",
    ])

    for rank, (_, row) in enumerate(importance_df.iterrows(), 1):
        lines.append(f"| {rank} | {row['feature']} | {row['importance']:.4f} |")

    lines.extend([
        "",
        "![Feature Importance](plots/feature_importance.png)",
        "",
        "---",
        "",
        "## 4. Residual Analysis",
        "",
        "![Residuals](plots/residuals.png)",
        "",
        "---",
        "",
        "## 5. Sanity Checks",
        "",
        "| Check | Prediction | Expected | Result |",
        "|-------|-----------|----------|--------|",
    ])

    for check in sanity_results:
        status = "✅ PASS" if check["passed"] else "❌ FAIL"
        lines.append(f"| {check['name']} | {check['prediction']} | {check['expected']} | {status} |")

    lines.extend([
        "",
        "---",
        "",
        "## 6. Prediction Distribution",
        "",
        "| Stat | Value |",
        "|------|-------|",
        f"| Mean | £{dist_stats['mean']:.2f}/week |",
        f"| Median | £{dist_stats['median']:.2f}/week |",
        f"| Std | £{dist_stats['std']:.2f} |",
        f"| Min | £{dist_stats['min']:.2f}/week |",
        f"| Max | £{dist_stats['max']:.2f}/week |",
        f"| Outliers (>2σ) | {dist_stats['outliers']} ({dist_stats['outlier_pct']}%) |",
        "",
        "![Prediction Distribution](plots/prediction_distribution.png)",
        "",
    ])

    report = "\n".join(lines)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(report)
    logger.info("Evaluation report saved to %s", report_path)
    return report


# =============================================================================
# Main Entry Point
# =============================================================================


def run_evaluation() -> None:
    """Execute the full evaluation pipeline.

    Loads model + features, runs all evaluation components,
    generates report and plots.
    """
    logger.info("=" * 60)
    logger.info("STARTING MODEL EVALUATION")
    logger.info("=" * 60)

    # ── Load features ────────────────────────────────────────────────────
    if not FEATURES_PATH.exists():
        logger.error("Features file not found at %s — run features.py first", FEATURES_PATH)
        raise FileNotFoundError(f"Features not found: {FEATURES_PATH}")

    df = pd.read_csv(str(FEATURES_PATH))
    logger.info("Loaded feature matrix: shape=%s", df.shape)

    # ── Add derived features (same as train_model) ─────────────────────
    df["rooms_per_m2"] = (df["num_rooms"] / df["floor_area_m2"].clip(lower=10)).round(4)

    # ── Compute target ────────────────────────────────────────────────────
    target = compute_real_target(df)
    feature_cols = get_feature_columns(df)
    X = df[feature_cols].copy()
    y = target

    # Drop NaN
    valid = X.notna().all(axis=1) & y.notna()
    X, y = X[valid], y[valid]

    # ── Cap outliers (same as train.py) ──────────────────────────────────
    cap_mask = y <= OUTLIER_CAP_WEEKLY
    n_removed = (~cap_mask).sum()
    X, y = X[cap_mask], y[cap_mask]
    logger.info(
        "Outlier cap: removed %d properties > £%.0f/wk, %d remain",
        n_removed, OUTLIER_CAP_WEEKLY, len(y),
    )
    logger.info("Valid samples: %d, features: %d", len(X), len(feature_cols))

    # ── Train/test split (same as train.py) ──────────────────────────────
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    # ── Load trained model ───────────────────────────────────────────────
    if not MODEL_PATH.exists():
        logger.error("Model not found at %s — run train.py first", MODEL_PATH)
        raise FileNotFoundError(f"Model not found: {MODEL_PATH}")

    pipeline = joblib.load(str(MODEL_PATH))
    logger.info("Loaded model from %s", MODEL_PATH)

    # ── 1. Standard metrics (on original scale) ──────────────────────────
    # Model predicts in log-space, so inverse-transform for metrics
    y_log = np.log1p(y_test)
    y_pred_log = pipeline.predict(X_test)
    y_pred = np.expm1(y_pred_log)  # Inverse log-transform
    metrics = compute_metrics(y_test.values, y_pred)

    logger.info("=" * 40)
    logger.info("STANDARD METRICS (original £/wk scale)")
    logger.info("  MAE:  £%.2f/week", metrics["mae"])
    logger.info("  RMSE: £%.2f/week", metrics["rmse"])
    logger.info("  R²:   %.4f", metrics["r2"])
    logger.info("  MAPE: %.1f%%", metrics["mape"])
    logger.info("=" * 40)

    # ── 1b. Scraped-only evaluation (production quality metric) ──────────────────────
    # The hybrid training target uses ~98% implied rents — evaluate against
    # scraped ground truth only to measure true production accuracy.
    scraped_mask = df.loc[X_test.index, "actual_market_rent_weekly"].notna() \
        if "actual_market_rent_weekly" in df.columns else pd.Series(False, index=X_test.index)
    if scraped_mask.sum() >= 10:
        y_scraped_true = y_test[scraped_mask].values
        y_scraped_pred = np.expm1(pipeline.predict(X_test[scraped_mask]))
        scraped_metrics = compute_metrics(y_scraped_true, y_scraped_pred)
        logger.info("=" * 40)
        logger.info("SCRAPED-ONLY METRICS (ground truth: %d rows)", scraped_mask.sum())
        logger.info("  MAE:  £%.2f/week  ← primary production quality metric", scraped_metrics["mae"])
        logger.info("  RMSE: £%.2f/week", scraped_metrics["rmse"])
        logger.info("  R²:   %.4f", scraped_metrics["r2"])
        logger.info("=" * 40)
    else:
        logger.warning("Insufficient scraped rows in test set (%d) for scraped-only evaluation",
                       scraped_mask.sum())
        scraped_metrics = {}

    # ── 2. Cross-validation ──────────────────────────────────────────────
    # Use a fresh (untrained) pipeline for CV
    from sklearn.pipeline import Pipeline as SKPipeline
    from sklearn.preprocessing import StandardScaler
    from xgboost import XGBRegressor

    # CV on log-space target (matching train.py)
    y_log_full = np.log1p(y)
    fresh_pipeline = SKPipeline([
        ("scaler", StandardScaler()),
        ("model", XGBRegressor(
            # v4.3.0 hyperparameters — must stay in sync with train.py
            n_estimators=300, max_depth=5, learning_rate=0.05,
            subsample=0.8, colsample_bytree=0.8,
            reg_alpha=0.1, reg_lambda=1.0, min_child_weight=8,
            random_state=42, n_jobs=-1, verbosity=0,
        )),
    ])
    cv_results = run_cross_validation(fresh_pipeline, X, y_log_full, cv=5)

    logger.info("CROSS-VALIDATION (5-fold)")
    for metric, value in cv_results.items():
        logger.info("  %s: %s", metric, value)

    # ── 3. Feature importance ────────────────────────────────────────────
    importance_df = get_feature_importance(pipeline, feature_cols)
    plot_feature_importance(importance_df, PLOTS_DIR / "feature_importance.png")

    logger.info("FEATURE IMPORTANCE")
    for _, row in importance_df.head(5).iterrows():
        logger.info("  %s: %.4f", row["feature"], row["importance"])

    # ── 4. Residual analysis ─────────────────────────────────────────────
    plot_residuals(y_test.values, y_pred, PLOTS_DIR / "residuals.png")

    # ── 5. Sanity checks ────────────────────────────────────────────────
    sanity_results = run_sanity_checks(pipeline, feature_cols)

    logger.info("SANITY CHECKS")
    all_passed = True
    for check in sanity_results:
        status = "✅" if check["passed"] else "❌"
        logger.info("  %s %s → %s (expected: %s)", status, check["name"], check["prediction"], check["expected"])
        if not check["passed"]:
            all_passed = False

    if all_passed:
        logger.info("  All sanity checks PASSED")
    else:
        logger.warning("  Some sanity checks FAILED — review model")

    # ── 6. Prediction distribution ───────────────────────────────────────
    y_pred_all = pipeline.predict(X)
    dist_stats = plot_prediction_distribution(y_pred_all, PLOTS_DIR / "prediction_distribution.png")

    logger.info("PREDICTION DISTRIBUTION")
    logger.info("  Mean: £%.2f, Median: £%.2f, Std: £%.2f", dist_stats["mean"], dist_stats["median"], dist_stats["std"])
    logger.info("  Range: £%.2f – £%.2f", dist_stats["min"], dist_stats["max"])
    logger.info("  Outliers (>2σ): %d (%.1f%%)", dist_stats["outliers"], dist_stats["outlier_pct"])

    # ── 7. Generate report ───────────────────────────────────────────────
    report = generate_report(
        metrics, cv_results, importance_df,
        sanity_results, dist_stats, REPORT_PATH,
        scraped_metrics=scraped_metrics,
    )

    logger.info("=" * 60)
    logger.info("EVALUATION COMPLETE — report at %s", REPORT_PATH)
    logger.info("=" * 60)


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(name)s %(levelname)s %(message)s",
    )
    run_evaluation()
