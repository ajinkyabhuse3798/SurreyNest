# Model Evaluation Report

**Model:** rent_model v7.0.0
**Generated:** 2026-03-26 00:01

> Note: the calibrated figures below are generated from a calibration artifact fit on the full out-of-fold set. A leakage-free nested audit on 2026-03-26 measured v7 at roughly `MAE £55.73` and `R² 0.8086`, and still preferred v7 over the `v6.2.0` backup.

---

## 1. Primary Metrics

- Evaluation method: `LOSO(11)` on real observed rents only
- MAE: `£52.50/week`
- RMSE: `£75.43/week`
- R²: `0.8307`
- MAPE: `11.53%`

## 2. Calibration Lift

- Raw out-of-fold MAE: `£55.94/week`
- Calibrated out-of-fold MAE: `£52.50/week`
- Raw out-of-fold R²: `0.8008`
- Calibrated out-of-fold R²: `0.8307`

## 3. Interval Quality

- Nominal interval: `80%`
- Observed coverage: `79.9%`
- Average half-width: `£79.39/week`

## 4. Dataset

- Training rows: `497`
- Postcode-sector groups: `11`
- Feature count: `36`

## 5. Top Features

| Rank | Feature | Importance |
|------|---------|------------|
| 1 | ptype_Flat | 0.3733 |
| 2 | actual_bedrooms | 0.3404 |
| 3 | floor_area_m2 | 0.1143 |
| 4 | ptype_Detached | 0.0290 |
| 5 | rooms_per_m2 | 0.0132 |
| 6 | ptype_Semi-Detached | 0.0131 |
| 7 | annual_energy_cost | 0.0113 |
| 8 | m2_per_bedroom | 0.0108 |
| 9 | energy_rating_ordinal | 0.0080 |
| 10 | accessibility_score | 0.0076 |
| 11 | distance_to_town_km | 0.0071 |
| 12 | energy_improvement_gap | 0.0068 |
| 13 | safety_score | 0.0067 |
| 14 | town_proximity_score | 0.0064 |
| 15 | station_proximity_score | 0.0063 |

![Feature Importance](plots/feature_importance.png)

## 6. Prediction Distribution

- Mean: `£523.79/week`
- Median: `£513.84/week`
- Std dev: `£163.82`
- Range: `£209.73` to `£911.97`

![Prediction Distribution](plots/prediction_distribution.png)

## 7. Residual View

![Residuals](plots/residuals.png)
