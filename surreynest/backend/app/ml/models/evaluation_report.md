# Model Evaluation Report

**Model:** rent_model v8.0.0
**Generated:** 2026-03-30 22:28

---

## 1. Primary Metrics

- Evaluation method: `LOSO(11)` on real observed rents only
- MAE: `£53.36/week`
- RMSE: `£75.91/week`
- R²: `0.8286`
- MAPE: `11.71%`

## 2. Calibration Lift

- Raw out-of-fold MAE: `£57.54/week`
- Calibrated out-of-fold MAE: `£53.36/week`
- Raw out-of-fold R²: `0.7981`
- Calibrated out-of-fold R²: `0.8286`

## 3. Interval Quality

- Nominal interval: `80%`
- Observed coverage: `79.9%`
- Average half-width: `£80.50/week`

## 4. Dataset

- Training rows: `497`
- Postcode-sector groups: `11`
- Feature count: `30`

## 5. Top Features

| Rank | Feature | Importance |
|------|---------|------------|
| 1 | actual_bedrooms | 0.5538 |
| 2 | ptype_Flat | 0.1403 |
| 3 | floor_area_m2 | 0.1365 |
| 4 | energy_improvement_gap | 0.0173 |
| 5 | is_studio | 0.0165 |
| 6 | m2_per_bedroom | 0.0159 |
| 7 | annual_energy_cost | 0.0145 |
| 8 | ptype_Semi-Detached | 0.0141 |
| 9 | rooms_per_m2 | 0.0101 |
| 10 | accessibility_score | 0.0092 |
| 11 | town_proximity_score | 0.0091 |
| 12 | safety_score | 0.0089 |
| 13 | sector_median_rent | 0.0088 |
| 14 | station_proximity_score | 0.0080 |
| 15 | energy_rating_ordinal | 0.0076 |

![Feature Importance](plots/feature_importance.png)

## 6. Prediction Distribution

- Mean: `£523.75/week`
- Median: `£518.05/week`
- Std dev: `£161.81`
- Range: `£215.66` to `£925.74`

![Prediction Distribution](plots/prediction_distribution.png)

## 7. Residual View

![Residuals](plots/residuals.png)

## 8. Per-Sector Performance

Sectors sorted by MAE (best → worst). Any sector with MAE > £80/wk warrants investigation.

| Sector | N | MAE £/wk | RMSE £/wk | Flag |
|--------|---|----------|-----------|------|
| GU1 1 | 44 | 30.21 | 44.34 | ✅ |
| GU2 9 | 50 | 41.82 | 55.73 |  |
| GU1 4 | 91 | 46.75 | 59.53 |  |
| GU2 8 | 96 | 46.98 | 66.62 |  |
| GU2 7 | 79 | 63.49 | 85.38 |  |
| GU1 2 | 26 | 65.69 | 94.55 |  |
| GU4 7 | 31 | 67.26 | 114.15 |  |
| GU2 4 | 23 | 67.33 | 87.46 |  |
| GU1 3 | 47 | 67.37 | 91.52 |  |
| GU3 3 | 9 | 71.88 | 85.16 |  |
