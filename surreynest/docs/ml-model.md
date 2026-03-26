# ML Model Documentation

> SurreyNest rent prediction model for Guildford weekly rents.

## Current Artifact

- Active model version: `v7.0.0`
- Runtime entrypoint: `backend/app/ml/predict.py`
- Training script: `backend/app/ml/train.py`
- Evaluation script: `backend/app/ml/evaluate.py`
- Saved artifacts:
  - `backend/app/ml/models/rent_model_v1.pkl`
  - `backend/app/ml/models/feature_columns.json`
  - `backend/app/ml/models/sector_rent_map.json`
  - `backend/app/ml/models/prediction_calibration.json`
  - `backend/app/ml/models/prediction_intervals.json`
  - `backend/app/ml/models/model_metadata.json`

## Goal

The model predicts a fair weekly rent for a Guildford property using structural, location, energy, and local-market features. SurreyNest uses that prediction to power rent comparisons, fairness messaging, and the rent-explain route.

## Architecture

- Estimator: `xgboost.XGBRegressor`
- Wrapper: single-step sklearn `Pipeline`
- Target transform: `log1p(y)` during training, `expm1(...)` at inference
- Preprocessing: no `StandardScaler` in v7

Why v7 dropped scaling:

- XGBoost uses tree splits, so monotonic feature scaling does not change the learned split order.
- Removing the unused scaler makes the artifact simpler and avoids explainability drift between pipeline versions.

## Training Data

- Source feature matrix: `backend/data/processed/features.csv`
- Primary target: `actual_market_rent_weekly`
- Rows with missing real observed rent are excluded from training
- University-managed properties are excluded from the target
- Weekly rent outliers above `£1000` are capped out of training
- Grouping key for evaluation: postcode sector, with postcode fallback when sector is missing

The sector prior used at inference is intentionally leakage-safe:

- `sector_median_rent` is recomputed from `implied_weekly_rent`
- scraped market rents are not allowed to leak into the anchor prior
- anchors are split by `Flat` versus `House`

## Feature Set

### Core numeric features

- `floor_area_m2`
- `actual_bedrooms`
- `rooms_per_m2`
- `energy_rating_ordinal`
- `potential_rating_ordinal`
- `distance_to_town_km`
- `distance_to_uni_km`
- `distance_to_station_km`
- `town_proximity_score`
- `uni_proximity_score`
- `station_proximity_score`
- `accessibility_score`
- `safety_score`
- `sale_count`
- `sector_median_rent`
- `has_mains_gas`
- `flat_floor_premium`
- `annual_energy_cost`
- `energy_improvement_gap`
- `price_drop_pct`
- `is_studio`
- `is_student_zone`
- `m2_per_bedroom`

### One-hot features

- `ptype_*` property-type columns
- `bform_*` built-form columns

The saved feature order is always taken from `feature_columns.json`.

## Training And Evaluation Flow

1. Load the processed feature matrix.
2. Recompute the leakage-safe sector anchor.
3. Build the v7 feature frame and real-rent target.
4. Run grouped cross-validation using leave-one-sector-out when enough postcode sectors exist.
5. Fit a lightweight post-prediction calibration artifact and type-aware prediction intervals.
6. Train the final XGBoost pipeline on the full training frame.
7. Save the model, metadata, and post-processing artifacts.

## Metrics

### Shipped artifact metadata

The current saved metadata in `model_metadata.json` reports:

- Evaluation method: `LOSO(11)`
- MAE: `£52.75/week`
- RMSE: `£75.75/week`
- R²: `0.8293`
- Raw OOF MAE: `£56.29/week`
- Raw OOF R²: `0.8013`
- Interval coverage: `79.88%`

### Important calibration note

The calibration artifact is fit after generating raw out-of-fold predictions. That is fine for the deployed artifact, but it makes the reported calibrated OOF metrics optimistic if you treat them as a fully leakage-free benchmark.

An independent nested audit on `2026-03-26` found the same v7 model still beats the `v6.2.0` backup, but with more conservative calibrated metrics:

- Honest calibrated MAE: `£55.73/week`
- Honest calibrated RMSE: `£80.20/week`
- Honest calibrated R²: `0.8086`
- Honest raw OOF MAE: `£55.94/week`
- Honest raw OOF R²: `0.8008`

Conclusion:

- Keep `v7.0.0`
- Do not revert to `v6.2.0`
- Use the nested figures for model-selection discussions until cross-fit calibration is added to the training pipeline

## Inference Path

`predict_rent(...)` in `backend/app/ml/predict.py`:

- builds the runtime feature row
- runs the pipeline prediction
- reverses the log transform
- applies calibration
- applies type-aware prediction intervals
- returns confidence and model version metadata

`/api/rent/explain/{uprn}` in `backend/app/routers/rent_explain.py`:

- shares the same feature builder
- uses `prepare_explainability_input(...)` so v7 works both with and without preprocessing steps
- computes per-feature SHAP contributions from the XGBoost booster

## Operational Notes

- `ML_MODEL_VERSION` should match the saved artifact version
- if the env var and artifact differ, the backend still loads the artifact and logs an error so cached predictions are naturally invalidated
- production health checks should verify both app startup and model loading, not just HTTP reachability

## Commands

Retrain:

```bash
cd backend
python -m app.ml.train
```

Evaluate:

```bash
cd backend
python -m app.ml.evaluate
```

Run ML tests:

```bash
cd backend
pytest -q tests/test_ml_pipeline.py
```
