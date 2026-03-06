# Model Evaluation Report

**Model:** rent_model v3.2.0
**Generated:** 2026-03-04 22:42

---

## 1. Standard Metrics

| Metric | Value |
|--------|-------|
| MAE | £40.51/week |
| RMSE | £70.31/week |
| R² | 0.8703 |
| MAPE | 11.7% |

---

## 2. Cross-Validation (5-fold)

| Metric | Mean ± Std |
|--------|-----------|
| MAE | 0.13 ± 0.01 |
| RMSE | 0.19 ± 0.01 |
| R² | 0.89 ± 0.01 |

---

## 3. Feature Importance

| Rank | Feature | Importance |
|------|---------|-----------|
| 1 | floor_area_m2 | 0.2550 |
| 2 | ptype_Flat | 0.2056 |
| 3 | ptype_Detached | 0.1497 |
| 4 | num_rooms | 0.1402 |
| 5 | ptype_Terraced | 0.0419 |
| 6 | ptype_Semi-Detached | 0.0352 |
| 7 | sale_count | 0.0266 |
| 8 | distance_to_station_km | 0.0245 |
| 9 | safety_score | 0.0236 |
| 10 | distance_to_uni_km | 0.0223 |
| 11 | distance_to_town_km | 0.0203 |
| 12 | estimated_bedrooms | 0.0198 |
| 13 | potential_rating_ordinal | 0.0141 |
| 14 | energy_rating_ordinal | 0.0114 |
| 15 | rooms_per_m2 | 0.0098 |

![Feature Importance](plots/feature_importance.png)

---

## 4. Residual Analysis

![Residuals](plots/residuals.png)

---

## 5. Sanity Checks

| Check | Prediction | Expected | Result |
|-------|-----------|----------|--------|
| 34.5m² studio flat (1 hab room) | 178.17 | £150–350/week (£650–1,520/mo) | ✅ PASS |
| 120m² detached house (5 hab rooms) | 544.92 | £350–700/week | ✅ PASS |
| Type ordering (80m², 3-bed) | Flat=242, Semi=332, Det=436 | Distinct predictions per type | ✅ PASS |
| Monotonic floor_area | 30m²=£179, 60m²=£188, 90m²=£277, 120m²=£370 | Increasing rent with area | ✅ PASS |

---

## 6. Prediction Distribution

| Stat | Value |
|------|-------|
| Mean | £5.72/week |
| Median | £5.75/week |
| Std | £0.54 |
| Min | £3.96/week |
| Max | £6.87/week |
| Outliers (>2σ) | 541 (3.2%) |

![Prediction Distribution](plots/prediction_distribution.png)
