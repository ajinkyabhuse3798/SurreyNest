# Model Evaluation Report

**Model:** rent_model v3.3.0
**Generated:** 2026-03-09 19:10

---

## 1. Standard Metrics

| Metric | Value |
|--------|-------|
| MAE | £40.78/week |
| RMSE | £67.89/week |
| R² | 0.8804 |
| MAPE | 11.4% |

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
| 1 | num_rooms | 0.2361 |
| 2 | ptype_Flat | 0.2194 |
| 3 | ptype_Detached | 0.1531 |
| 4 | floor_area_m2 | 0.1414 |
| 5 | estimated_bedrooms | 0.0438 |
| 6 | has_mains_gas | 0.0235 |
| 7 | ptype_Semi-Detached | 0.0233 |
| 8 | ptype_Terraced | 0.0198 |
| 9 | sale_count | 0.0194 |
| 10 | safety_score | 0.0165 |
| 11 | distance_to_station_km | 0.0156 |
| 12 | distance_to_uni_km | 0.0145 |
| 13 | rooms_per_m2 | 0.0138 |
| 14 | age_band_ordinal | 0.0134 |
| 15 | distance_to_town_km | 0.0129 |
| 16 | potential_rating_ordinal | 0.0080 |
| 17 | energy_rating_ordinal | 0.0079 |
| 18 | floor_level_ordinal | 0.0068 |
| 19 | energy_improvement_gap | 0.0065 |
| 20 | annual_energy_cost | 0.0041 |

![Feature Importance](plots/feature_importance.png)

---

## 4. Residual Analysis

![Residuals](plots/residuals.png)

---

## 5. Sanity Checks

| Check | Prediction | Expected | Result |
|-------|-----------|----------|--------|
| 34.5m² studio flat (1 hab room) | 172.29 | £150–350/week (£650–1,520/mo) | ✅ PASS |
| 120m² detached house (5 hab rooms) | 508.6 | £350–700/week | ✅ PASS |
| Type ordering (80m², 3-bed) | Flat=250, Semi=329, Det=380 | Distinct predictions per type | ✅ PASS |
| Monotonic floor_area | 30m²=£169, 60m²=£198, 90m²=£281, 120m²=£375 | Increasing rent with area | ✅ PASS |

---

## 6. Prediction Distribution

| Stat | Value |
|------|-------|
| Mean | £5.72/week |
| Median | £5.76/week |
| Std | £0.54 |
| Min | £3.97/week |
| Max | £6.92/week |
| Outliers (>2σ) | 535 (3.2%) |

![Prediction Distribution](plots/prediction_distribution.png)
