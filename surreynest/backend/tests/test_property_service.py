"""Unit tests for property_service — pure helpers and structural checks.

Tests extract_postcode_sector (pure function, no DB).
search_properties and get_property_detail require PostGIS — integration
tests for those are deferred to Step 3.11 with the full test DB.
"""

import inspect

from app.services.property_service import (
    get_property_detail,
    search_properties,
)
from app.utils.postcode import extract_postcode_sector as _extract_postcode_sector


# ── Postcode sector extraction ────────────────────────────────────────────────


class TestExtractPostcodeSector:
    """Tests for the _extract_postcode_sector helper."""

    def test_extract_sector_standard(self) -> None:
        """Standard postcode 'GU2 7XH' → sector 'GU2 7'."""
        assert _extract_postcode_sector("GU2 7XH") == "GU2 7"

    def test_extract_sector_no_space(self) -> None:
        """No-space postcode 'GU27XH' returns empty string (unparseable)."""
        result = _extract_postcode_sector("GU27XH")
        # Without space, split returns one element — cannot extract sector
        assert result == ""

    def test_extract_sector_extra_spaces(self) -> None:
        """Extra whitespace '  GU2  7XH  ' → cleaned to 'GU2 7'."""
        # strip() removes outer spaces, split() handles inner space
        result = _extract_postcode_sector("  GU2  7XH  ")
        assert result == "GU2 7"

    def test_extract_sector_short_postcode(self) -> None:
        """Short area code 'W1A 1AA' → sector 'W1A 1'."""
        assert _extract_postcode_sector("W1A 1AA") == "W1A 1"

    def test_extract_sector_two_char_inward(self) -> None:
        """Minimal inward code still extracts first char: 'E1 6AN' → 'E1 6'."""
        assert _extract_postcode_sector("E1 6AN") == "E1 6"


# ── Structural checks ────────────────────────────────────────────────────────


class TestPropertyServiceStructure:
    """Verify that required functions exist with correct signatures."""

    def test_search_properties_function_exists(self) -> None:
        """search_properties is importable and callable."""
        assert callable(search_properties)

    def test_get_property_detail_function_exists(self) -> None:
        """get_property_detail is importable and callable."""
        assert callable(get_property_detail)

    def test_search_properties_has_correct_params(self) -> None:
        """search_properties accepts postcode, radius_m, page, per_page, db."""
        sig = inspect.signature(search_properties)
        param_names = list(sig.parameters.keys())
        assert "postcode" in param_names
        assert "radius_m" in param_names
        assert "page" in param_names
        assert "per_page" in param_names
        assert "db" in param_names
