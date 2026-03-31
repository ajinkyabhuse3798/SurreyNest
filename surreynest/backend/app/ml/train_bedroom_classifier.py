"""Train a sub-model to predict actual bedrooms from EPC features.
This solves the discrepancy where EPC 'num_rooms' = habitable rooms 
(including living rooms/kitchens) rather than raw bedrooms.
The model trains on ground-truth scraped data linking floor_area and 
num_rooms to actual bedrooms, then backfills the rest of the database.
"""

import logging
from datetime import datetime, timezone
import numpy as np
import pandas as pd
from sqlalchemy import text
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import StratifiedKFold, cross_val_score
from sklearn.metrics import accuracy_score, classification_report
import joblib
from pathlib import Path

from app.database import SessionLocal
from app.data_pipelines.epc_pipeline import AGE_BAND_ORDINAL

logger = logging.getLogger(__name__)


def encode_features(df: pd.DataFrame) -> pd.DataFrame:
    """Prepare features for the RF Classifier."""
    X = pd.DataFrame()
    X["num_rooms"] = df["num_rooms"].fillna(3).astype(int)
    X["floor_area_m2"] = df["floor_area_m2"].fillna(60.0)

    # Ordinal Age Band
    X["age_band_ordinal"] = (
        df["construction_age_band"]
        .fillna("")
        .str.lower()
        .str.strip()
        .map(AGE_BAND_ORDINAL)
        .fillna(6)
    ).astype(float)

    # One-hot property type
    X["is_flat"] = (df["property_type"] == "Flat").astype(int)
    X["is_terraced"] = (df["property_type"] == "Terraced").astype(int)
    X["is_semi"] = (df["property_type"] == "Semi-Detached").astype(int)
    X["is_detached"] = (df["property_type"] == "Detached").astype(int)

    return X


def train_and_predict():
    db = SessionLocal()
    try:
        logger.info("Fetching properties from DB for bedroom classification...")

        # Load all properties
        all_props = pd.read_sql(
            "SELECT uprn, num_rooms, floor_area_m2, property_type, construction_age_band, actual_bedrooms FROM properties",
            db.bind,
        )

        # Define Training Set (where we have actual_bedrooms from Zoopla/Rightmove)
        train_df = all_props[all_props["actual_bedrooms"].notna()].copy()

        # Define Target Set (where we need to predict)
        target_df = all_props[all_props["actual_bedrooms"].isna()].copy()

        logger.info(f"Training set size (Ground Truth): {len(train_df)}")
        logger.info(f"Target set size (To Backfill): {len(target_df)}")

        if len(train_df) < 50:
            logger.error(
                "Not enough training data. Need at least 50 scraped properties with actual_bedrooms."
            )
            return

        X_train_full = encode_features(train_df)
        y_train_full = train_df["actual_bedrooms"].astype(int)

        rf = RandomForestClassifier(n_estimators=100, max_depth=10, random_state=42)

        # Proper 5-fold stratified cross-validation (replaces single 80/20 split).
        # Stratified folds preserve bedroom-class proportions per fold.
        n_folds = min(5, y_train_full.value_counts().min())
        n_folds = max(n_folds, 2)
        cv = StratifiedKFold(n_splits=n_folds, shuffle=True, random_state=42)
        cv_scores = cross_val_score(rf, X_train_full, y_train_full, cv=cv, scoring="accuracy")
        logger.info(
            "Bedroom classifier %d-fold CV accuracy: %.3f ± %.3f (min %.3f, max %.3f)",
            n_folds,
            float(np.mean(cv_scores)),
            float(np.std(cv_scores)),
            float(np.min(cv_scores)),
            float(np.max(cv_scores)),
        )

        # Final fit on full dataset after CV validation
        rf.fit(X_train_full, y_train_full)
        full_preds = rf.predict(X_train_full)
        logger.info(
            "Full-dataset refit accuracy: %.3f (train-set, expected optimistic)",
            accuracy_score(y_train_full, full_preds),
        )
        logger.info("\n" + classification_report(y_train_full, full_preds))

        # Feature Importance
        importances = pd.Series(rf.feature_importances_, index=X_train_full.columns)
        logger.info(
            "Feature Importances:\n" + str(importances.sort_values(ascending=False))
        )

        # Save model for future single-property prediction if needed
        model_dir = Path(__file__).resolve().parent / "models"
        model_dir.mkdir(parents=True, exist_ok=True)
        joblib.dump(rf, model_dir / "bedroom_classifier_v1.pkl")

        # Predict for all remaining records
        if not target_df.empty:
            X_target = encode_features(target_df)
            target_preds = rf.predict(X_target)

            logger.info("Running bulk DB UPDATE...")
            # We will use SQLAlchemy core text execution for fast bulk update
            update_data = [
                {
                    "uprn": uprn,
                    "predicted_beds": int(pred),
                    "now": datetime.now(timezone.utc),
                }
                for uprn, pred in zip(target_df["uprn"], target_preds)
            ]

            # Batch update into properties table
            stmt = text(
                "UPDATE properties SET actual_bedrooms = :predicted_beds, updated_at = :now WHERE uprn = :uprn"
            )

            with db.begin():  # implicit transaction
                # execute bulk
                db.execute(stmt, update_data)

            logger.info(
                f"Successfully backfilled actual_bedrooms for {len(target_df)} properties."
            )

    except Exception as e:
        logger.error(f"Failed to train and predict bedrooms: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    train_and_predict()
