"""Postcode utilities: single source of truth for UK postcode parsing."""

import re


def extract_postcode_sector(postcode: str) -> str:
    """Extract postcode sector from a full or partial UK postcode.

    Handles extra whitespace, full postcodes ("GU2 7XH" → "GU2 7"),
    and pre-extracted sectors ("GU2 7" → "GU2 7").

    Args:
        postcode: Full or partial UK postcode, e.g. "GU2 7XH" or "GU2  7".

    Returns:
        Postcode sector, e.g. "GU2 7". Returns empty string if unparseable.

    Examples:
        >>> extract_postcode_sector("GU2 7XH")
        'GU2 7'
        >>> extract_postcode_sector("EC1V 1JB")
        'EC1V 1'
        >>> extract_postcode_sector("GU2  7")
        'GU2 7'
    """
    pc = re.sub(r"\s+", " ", str(postcode).upper().strip())
    parts = pc.split()
    if len(parts) == 2 and len(parts[1]) >= 1:
        return f"{parts[0]} {parts[1][0]}"
    return ""
