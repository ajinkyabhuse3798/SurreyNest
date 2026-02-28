# Model Evaluation Report

**Model:** rent_model v1.0.0
**Generated:** 2026-02-26 23:33

---

## 1. Standard Metrics

| Metric | Value |
|--------|-------|
| MAE | £40.90/week |
| RMSE | £53.07/week |
| R² | 0.7282 |
| MAPE | 10.3% |

---

## 2. Cross-Validation (5-fold)

| Metric | Mean ± Std |
|--------|-----------|
| MAE | 42.18 ± 1.63 |
| RMSE | 53.97 ± 1.34 |
| R² | 0.72 ± 0.02 |

---

## 3. Feature Importance

| Rank | Feature | Importance |
|------|---------|-----------|
| 1 | num_rooms | 0.7147 |
| 2 | floor_area_m2 | 0.0857 |
| 3 | distance_to_uni_km | 0.0616 |
| 4 | distance_to_town_km | 0.0569 |
| 5 | safety_score | 0.0236 |
| 6 | ptype_Flat | 0.0216 |
| 7 | energy_rating_ordinal | 0.0100 |
| 8 | potential_rating_ordinal | 0.0073 |
| 9 | ptype_Terraced | 0.0071 |
| 10 | is_hmo | 0.0047 |
| 11 | ptype_Semi-Detached | 0.0037 |
| 12 | ptype_Detached | 0.0029 |
| 13 | area_value_index | 0.0000 |

![Feature Importance](plots/feature_importance.png)

---

## 4. Residual Analysis

![Residuals](plots/residuals.png)

---

## 5. Sanity Checks

| Check | Prediction | Expected | Result |
|-------|-----------|----------|--------|
| 25m² studio flat | 227.71 | £100–220/week | ❌ FAIL |
| 120m² detached house | 485.59 | £300–550/week | ✅ PASS |
| Type ordering (80m², 3-bed) | Flat=409, Semi=360, Det=351 | Distinct predictions per type | ✅ PASS |
| Monotonic floor_area | 30m²=£345, 60m²=£379, 90m²=£424, 120m²=£431 | Increasing rent with area | ✅ PASS |

---

## 6. Prediction Distribution

| Stat | Value |
|------|-------|
| Mean | £406.28/week |
| Median | £395.59/week |
| Std | £93.85 |
| Min | £180.12/week |
| Max | £694.83/week |
| Outliers (>2σ) | 54 (1.9%) |

![Prediction Distribution](plots/prediction_distribution.png)
