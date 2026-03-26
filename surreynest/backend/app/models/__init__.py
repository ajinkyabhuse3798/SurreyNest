"""SQLAlchemy ORM models, one file per database table.

Import all models here so that Alembic autogenerate can discover them
when it imports `app.models`.
"""

from app.models.area_value import AreaValue
from app.models.crime_data import CrimeData
from app.models.flood_risk import FloodRisk
from app.models.hmo_record import HmoRecord
from app.models.pipeline_config import PipelineConfig
from app.models.pipeline_run import PipelineRun
from app.models.postcode_cache import PostcodeCache
from app.models.property import Property
from app.models.rent_history import RentHistory
from app.models.rent_prediction import RentPrediction
from app.models.review import Review
from app.models.letting_agent import LettingAgent
from app.models.user import User
from app.models.voa_rent_band import VoaRentBand

__all__ = [
    "AreaValue",
    "CrimeData",
    "FloodRisk",
    "HmoRecord",
    "PipelineConfig",
    "PipelineRun",
    "PostcodeCache",
    "Property",
    "RentHistory",
    "RentPrediction",
    "Review",
    "LettingAgent",
    "User",
    "VoaRentBand",
]
