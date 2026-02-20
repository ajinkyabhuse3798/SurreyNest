# ML Model Documentation

> Rent fairness prediction model — design decisions, features, training process, evaluation.

---

## Model Goal

**Input:** Property characteristics (size, type, location, energy rating)
**Output:** Predicted fair weekly rent in £

**Downstream use:** Compare against actual rent submitted by user → compute fairness score 0–100

---

## Model Architecture

**Type:** Gradient Boosting Regression
**Library:** scikit-learn `GradientBoostingRegressor`
**Wrapper:** sklearn `Pipeline` (scaler → estimator)
**Serialisation:** `joblib.dump()` → `backend/app/ml/models/rent_model_v1.pkl`

### Why Gradient Boosting?
- Handles mixed numerical + categorical features well
- Robust to outliers (less sensitive than linear regression)
- Doesn't require feature scaling for tree-based methods (but we scale anyway for future model swaps)
- Good out-of-the-box performance on small-medium tabular datasets (~10k rows)

### Baselines (always train these for comparison)
1. `Ridge` regression — linear baseline
2. `RandomForestRegressor` — alternative ensemble
3. Mean prediction — sanity check (R² = 0 by definition)

---

## Features

### Numerical Features (scaled with StandardScaler)

| Feature | Source | Notes |
|---------|--------|-------|
| `floor_area_m2` | EPC: TOTAL-FLOOR-AREA | Strongest single predictor. Never impute — drop rows where null. |
| `num_rooms` | EPC: NUMBER-HABITABLE-ROOMS | Integer. Impute with median if null (rare). |
| `energy_rating_encoded` | EPC: CURRENT-ENERGY-RATING | Ordinal: G=0, F=1, E=2, D=3, C=4, B=5, A=6 |
| `distance_to_town_km` | Computed | Haversine from property to GU1 3AY (51.2362, -0.5704) |
| `distance_to_uni_km` | Computed | Haversine from property to Surrey Uni (51.2417, -0.5888) |
| `area_value_index` | Land Registry | Median sale price for postcode, normalised 0–1 |
| `safety_score` | police.uk | Our computed safety score 0–100 for postcode sector |

### Categorical Features (one-hot encoded)

| Feature | Source | Categories |
|---------|--------|-----------|
| `property_type` | EPC | Flat, Terraced, Semi-Detached, Detached, Other |
| `built_form` | EPC | Detached, Semi-Detached, Terraced, End-Terrace, Other |

### Binary Features

| Feature | Source | Notes |
|---------|--------|-------|
| `is_hmo` | HMO register | 1 if on register, 0 if not |

### Features NOT included (and why)

| Feature | Reason excluded |
|---------|----------------|
| `address` (raw string) | Too high cardinality, no semantic encoding for MVP |
| `postcode` (raw) | Use computed distance features instead |
| `landlord_name` | Not reliably available |
| `number_of_floors` | Sparse in EPC data |
| `construction_year` | Low correlation with rent, high missingness |

---

## Training Target

### Primary target: VOA median rent bands (MVP)

Source: VOA Private Rental Market Statistics (quarterly)
- Download median weekly rent by bedroom count for Guildford Borough
- Map to properties: `predicted_rent = voa_median_by_bedrooms[num_rooms]`
- This is coarse but sufficient for MVP fairness scoring

```python
# Approximate VOA bands for Guildford (update from latest VOA data each quarter)
VOA_RENT_BANDS = {
    1: 173,   # £/week median for 1-bed Guildford
    2: 230,   # £/week median for 2-bed
    3: 290,   # £/week median for 3-bed
    4: 375,   # £/week median for 4-bed
    5: 460,   # £/week median for 5-bed (use 4+ band)
}
```

### Future target: user-submitted rents

Once we have 50+ reviews with `weekly_rent_paid` populated:
1. Join reviews with property features
2. Use `weekly_rent_paid` as training target
3. Retrain model — this dramatically improves accuracy
4. Model version bumps to `v2.0.0`

---

## Training Process (`app/ml/train.py`)

```
1. Load features.csv (output of features.py)
2. Load VOA rent bands → create target column `expected_weekly_rent`
3. Feature engineering:
   - Drop rows with null floor_area_m2 or num_rooms
   - Impute safety_score nulls with median
   - One-hot encode property_type, built_form
   - Ordinal encode energy_rating
   - Compute distance features using geopy.distance.geodesic
4. train_test_split(test_size=0.2, random_state=42)
5. Build Pipeline: StandardScaler → GradientBoostingRegressor
6. GridSearchCV with 5-fold CV:
   - n_estimators: [100, 200, 300]
   - max_depth: [3, 4, 5]
   - learning_rate: [0.05, 0.1, 0.15]
7. Evaluate best model on test set (see Evaluation section)
8. If metrics acceptable: retrain on full dataset
9. joblib.dump(pipeline, f'models/rent_model_{VERSION}.pkl')
10. Log: model version, training date, dataset size, key metrics to pipeline_runs table
```

---

## Evaluation Metrics (`app/ml/evaluate.py`)

### Target thresholds

| Metric | Target | Notes |
|--------|--------|-------|
| MAE | < £50/week | Average prediction error in £ |
| RMSE | < £75/week | Penalises large errors |
| R² | > 0.65 | % variance explained (0 = mean predictor, 1 = perfect) |
| CV std | < 0.1 | Std of cross-validation scores — low = not overfitting |

### Plots to generate (saved to `app/ml/plots/`)
1. **Residual scatter:** actual vs predicted — look for heteroscedasticity
2. **Feature importance bar chart:** shows which features the model relies on most
3. **Learning curve:** training size vs validation error — shows if more data helps
4. **Error distribution histogram:** should be roughly normal, centred near 0

### Interpreting R²
- R² = 0.0 → model does no better than predicting the mean rent for every property
- R² = 0.70 → model explains 70% of rent variation — acceptable for fairness scoring
- R² > 0.85 → very good — achievable once we have user-submitted rent data

---

## Fairness Score Formula (`app/services/score_service.py`)

```python
def compute_fairness_score(actual_rent: float, predicted_rent: float) -> dict:
    """
    Converts rent deviation into a 0-100 fairness score.
    
    Args:
        actual_rent: Weekly rent in £ as submitted by tenant
        predicted_rent: Model's predicted fair weekly rent for this property
    
    Returns:
        dict with score (int), label (str), colour (str), ratio (float)
    """
    ratio = actual_rent / predicted_rent
    
    if ratio <= 0.85:
        score = 90 + int((0.85 - ratio) / 0.15 * 10)  # 90-100
        label = "Excellent deal"
        colour = "green"
    elif ratio <= 1.00:
        score = 70 + int((1.00 - ratio) / 0.15 * 20)   # 70-89
        label = "Below market"
        colour = "green"
    elif ratio <= 1.10:
        score = 55 + int((1.10 - ratio) / 0.10 * 15)   # 55-69
        label = "At market rate"
        colour = "amber"
    elif ratio <= 1.25:
        score = 35 + int((1.25 - ratio) / 0.15 * 20)   # 35-54
        label = "Slightly above market"
        colour = "amber"
    elif ratio <= 1.40:
        score = 15 + int((1.40 - ratio) / 0.15 * 20)   # 15-34
        label = "Above market"
        colour = "red"
    else:
        score = max(0, 15 - int((ratio - 1.40) / 0.20 * 15))  # 0-14
        label = "Significantly overpriced"
        colour = "red"
    
    score = max(0, min(100, score))
    
    return {
        "score": score,
        "label": label,
        "colour": colour,
        "ratio": round(ratio, 2),
        "predicted_rent": round(predicted_rent, 2),
        "actual_rent": actual_rent,
        "difference_pounds": round(actual_rent - predicted_rent, 2),
        "difference_percent": round((ratio - 1) * 100, 1)
    }
```

---

## Model Versioning

| Version | Training target | Expected R² | Notes |
|---------|----------------|-------------|-------|
| `v1.0.0` | VOA median bands | 0.55–0.70 | MVP — coarse target |
| `v2.0.0` | User-submitted rents | 0.75–0.85 | When 50+ reviews available |
| `v3.0.0` | User rents + scraped | 0.82–0.90 | If Rightmove scraper built |

Model pkl files are named `rent_model_v{VERSION}.pkl`.
The active version is referenced in `app/config.py → ML_MODEL_VERSION`.

---

## Retraining Schedule

- **Monthly** via APScheduler (3rd of month 4am)
- Pipeline: download latest VOA data → rerun features.py → train.py → evaluate → if metrics pass thresholds, deploy new pkl
- If metrics fail: keep previous pkl, log failure, alert via email

---

## Known Limitations

1. **Coarse training target:** VOA medians are by bedroom count, not property-specific. This limits R² ceiling until user rent data is available.
2. **No time-series component:** Model doesn't account for seasonal rent variation or year-on-year increases.
3. **Missing furnished/unfurnished signal:** Furnished properties rent higher; EPC data doesn't include this.
4. **HMO pricing dynamics:** HMOs are often priced per-room; our model predicts whole-property rent. HMO properties should display per-room interpretation.
