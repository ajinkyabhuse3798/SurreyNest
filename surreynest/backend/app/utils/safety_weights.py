"""Crime category weights: single source of truth for safety scoring.

Both score_service and safety_intelligence must use these identical weights.
Defining them once prevents silent divergence.
"""

from typing import Dict

CATEGORY_WEIGHTS: Dict[str, float] = {
    "violent-crime": 3.0,
    "robbery": 2.5,
    "anti-social-behaviour": 2.0,
    "burglary": 2.0,
    "drugs": 1.5,
    "public-order": 1.5,
    "vehicle-crime": 1.0,
    "theft-from-the-person": 1.0,
    "bicycle-theft": 1.5,
}

DEFAULT_WEIGHT: float = 0.5
