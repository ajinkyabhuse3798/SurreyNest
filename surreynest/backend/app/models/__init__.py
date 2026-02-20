"""SQLAlchemy ORM models — one file per database table.

Import all models here so that Alembic autogenerate can discover them
when it imports `app.models`.
"""

from app.models.crime_data import CrimeData
from app.models.hmo_record import HmoRecord
from app.models.pipeline_run import PipelineRun
from app.models.postcode_cache import PostcodeCache
from app.models.property import Property
from app.models.rent_prediction import RentPrediction
from app.models.review import Review
from app.models.user import User

__all__ = [
    "CrimeData",
    "HmoRecord",
    "PipelineRun",
    "PostcodeCache",
    "Property",
    "RentPrediction",
    "Review",
    "User",
]
