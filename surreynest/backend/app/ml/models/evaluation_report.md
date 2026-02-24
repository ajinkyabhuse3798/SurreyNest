# Model Evaluation Report

**Model:** rent_model v1.0.0
**Generated:** 2026-02-24 21:37

---

## 1. Standard Metrics

| Metric | Value |
|--------|-------|
| MAE | £33.12/week |
| RMSE | £43.41/week |
| R² | 0.7949 |
| MAPE | 10.3% |

---

## 2. Cross-Validation (5-fold)

| Metric | Mean ± Std |
|--------|-----------|
| MAE | 33.52 ± 1.55 |
| RMSE | 43.39 ± 1.77 |
| R² | 0.79 ± 0.01 |

---

## 3. Feature Importance

| Rank | Feature | Importance |
|------|---------|-----------|
| 1 | num_rooms | 0.7817 |
| 2 | floor_area_m2 | 0.0692 |
| 3 | distance_to_uni_km | 0.0440 |
| 4 | distance_to_town_km | 0.0430 |
| 5 | safety_score | 0.0189 |
| 6 | ptype_Flat | 0.0126 |
| 7 | energy_rating_ordinal | 0.0082 |
| 8 | potential_rating_ordinal | 0.0062 |
| 9 | ptype_Terraced | 0.0048 |
| 10 | ptype_Detached | 0.0041 |
| 11 | is_hmo | 0.0038 |
| 12 | ptype_Semi-Detached | 0.0034 |
| 13 | area_value_index | 0.0000 |

![Feature Importance](plots/feature_importance.png)

---

## 4. Residual Analysis

![Residuals](plots/residuals.png)

---

## 5. Sanity Checks

| Check | Prediction | Expected | Result |
|-------|-----------|----------|--------|
| 25m² studio flat | 164.51 | £100–220/week | ✅ PASS |
| 120m² detached house | 423.11 | £300–550/week | ✅ PASS |
| Type ordering (80m², 3-bed) | Flat=322, Semi=282, Det=274 | Distinct predictions per type | ✅ PASS |
| Monotonic floor_area | 30m²=£277, 60m²=£299, 90m²=£341, 120m²=£343 | Increasing rent with area | ✅ PASS |

---

## 6. Prediction Distribution

| Stat | Value |
|------|-------|
| Mean | £326.61/week |
| Median | £313.42/week |
| Std | £88.85 |
| Min | £134.09/week |
| Max | £605.11/week |
| Outliers (>2σ) | 43 (1.5%) |

![Prediction Distribution](plots/prediction_distribution.png)
