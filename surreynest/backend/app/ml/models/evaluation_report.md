# Model Evaluation Report

**Model:** rent_model v2.1.0
**Generated:** 2026-03-02 19:54

---

## 1. Standard Metrics

| Metric | Value |
|--------|-------|
| MAE | £13.27/week |
| RMSE | £20.58/week |
| R² | 0.9949 |
| MAPE | 3.5% |

---

## 2. Cross-Validation (5-fold)

| Metric | Mean ± Std |
|--------|-----------|
| MAE | 13.97 ± 0.54 |
| RMSE | 22.51 ± 1.94 |
| R² | 0.99 ± 0.00 |

---

## 3. Feature Importance

| Rank | Feature | Importance |
|------|---------|-----------|
| 1 | floor_area_m2 | 0.5233 |
| 2 | area_value_index | 0.4069 |
| 3 | ptype_Detached | 0.0345 |
| 4 | ptype_Flat | 0.0099 |
| 5 | num_rooms | 0.0077 |
| 6 | distance_to_uni_km | 0.0040 |
| 7 | safety_score | 0.0034 |
| 8 | ptype_Semi-Detached | 0.0026 |
| 9 | distance_to_town_km | 0.0024 |
| 10 | sale_count | 0.0022 |
| 11 | distance_to_station_km | 0.0022 |
| 12 | energy_rating_ordinal | 0.0004 |
| 13 | ptype_Terraced | 0.0003 |
| 14 | potential_rating_ordinal | 0.0001 |
| 15 | is_hmo | 0.0000 |
| 16 | iphrp_growth_pct | 0.0000 |

![Feature Importance](plots/feature_importance.png)

---

## 4. Residual Analysis

![Residuals](plots/residuals.png)

---

## 5. Sanity Checks

| Check | Prediction | Expected | Result |
|-------|-----------|----------|--------|
| 25m² studio flat | 287.19 | £100–220/week | ❌ FAIL |
| 120m² detached house | 604.17 | £300–550/week | ❌ FAIL |
| Type ordering (80m², 3-bed) | Flat=377, Semi=447, Det=477 | Distinct predictions per type | ✅ PASS |
| Monotonic floor_area | 30m²=£316, 60m²=£354, 90m²=£401, 120m²=£447 | Increasing rent with area | ✅ PASS |

---

## 6. Prediction Distribution

| Stat | Value |
|------|-------|
| Mean | £411.74/week |
| Median | £331.38/week |
| Std | £281.71 |
| Min | £41.03/week |
| Max | £1262.68/week |
| Outliers (>2σ) | 1373 (7.5%) |

![Prediction Distribution](plots/prediction_distribution.png)
