"""Listing wording compliance scan for the Renters' Rights Act rollout.

This focuses on issues that can be inferred from listing copy with reasonable
confidence, while staying honest about future effective dates and false-positive
risk. It is not a substitute for legal advice.
"""

from __future__ import annotations

import html
import re
from datetime import date
from typing import Optional

_PHASE_1_START = date(2026, 5, 1)

_SCRIPT_STYLE_RE = re.compile(r"<(script|style)\b.*?>.*?</\1>", re.IGNORECASE | re.DOTALL)
_TAG_RE = re.compile(r"<[^>]+>")
_WHITESPACE_RE = re.compile(r"\s+")

_ISSUE_RULES = [
    {
        "id": "rental_bidding",
        "category": "rental_bidding",
        "title": "Possible rental bidding wording",
        "severity": "high",
        "status": "flagged",
        "patterns": [
            re.compile(r"\boffers?\s+over\b", re.IGNORECASE),
            re.compile(r"\bbest\s+offers?\b", re.IGNORECASE),
            re.compile(r"\bhighest\s+offers?\b", re.IGNORECASE),
            re.compile(r"\bbids?\s+(?:over|above)\b", re.IGNORECASE),
        ],
        "before": (
            "From 1 May 2026 in England, landlords and agents must publish one asking rent and "
            "cannot ask for, encourage, or accept bids above it."
        ),
        "after": (
            "In England, landlords and agents must publish one asking rent and cannot ask for, "
            "encourage, or accept bids above it."
        ),
        "guidance": "Look for one fixed advertised rent rather than wording that invites competing offers.",
    },
    {
        "id": "rent_in_advance",
        "category": "rent_in_advance",
        "title": "Possible rent-in-advance issue",
        "severity": "high",
        "status": "flagged",
        "patterns": [
            re.compile(
                r"\b(?:[2-9]|1[0-2])\s+months?\s+(?:rent\s+)?(?:in\s+advance|upfront|up\s*front)\b",
                re.IGNORECASE,
            ),
            re.compile(r"\bmore\s+than\s+1\s+month(?:'s)?\s+rent\s+in\s+advance\b", re.IGNORECASE),
        ],
        "before": (
            "From 1 May 2026 in England, landlords and agents will not be able to require more "
            "than 1 month's rent in advance for most private tenancies."
        ),
        "after": (
            "In England, landlords and agents cannot require more than 1 month's rent in advance "
            "for most private tenancies."
        ),
        "guidance": "Be cautious if the advert asks for several months upfront rather than a deposit and one month's rent.",
    },
    {
        "id": "benefits_discrimination",
        "category": "benefits_discrimination",
        "title": "Possible benefits discrimination wording",
        "severity": "high",
        "status": "flagged",
        "patterns": [
            re.compile(r"\bno\s+dss\b", re.IGNORECASE),
            re.compile(r"\bno\s+housing\s+benefit\b", re.IGNORECASE),
            re.compile(r"\bbenefits?\s+not\s+(?:accepted|allowed)\b", re.IGNORECASE),
            re.compile(r"\bhousing\s+benefit\s+not\s+(?:accepted|allowed)\b", re.IGNORECASE),
        ],
        "before": (
            "From 1 May 2026 in England, landlords and agents will not be able to make a renter "
            "less likely to rent because they receive benefits."
        ),
        "after": (
            "In England, landlords and agents cannot make a renter less likely to rent because they receive benefits."
        ),
        "guidance": "Listings should focus on affordability and referencing criteria, not blanket exclusions aimed at benefit recipients.",
    },
    {
        "id": "children_discrimination",
        "category": "children_discrimination",
        "title": "Possible children discrimination wording",
        "severity": "high",
        "status": "flagged",
        "patterns": [
            re.compile(r"\bno\s+children\b", re.IGNORECASE),
            re.compile(r"\bno\s+kids\b", re.IGNORECASE),
            re.compile(r"\bchildren\s+not\s+(?:allowed|accepted)\b", re.IGNORECASE),
            re.compile(r"\bfamil(?:y|ies)\s+not\s+(?:allowed|accepted)\b", re.IGNORECASE),
        ],
        "before": (
            "From 1 May 2026 in England, landlords and agents will not be able to make a renter "
            "less likely to rent because they have children."
        ),
        "after": (
            "In England, landlords and agents cannot make a renter less likely to rent because they have children."
        ),
        "guidance": "Listings should describe the home, not exclude families or children as a group.",
    },
    {
        "id": "pets",
        "category": "pets",
        "title": "Blanket pet ban wording",
        "severity": "medium",
        "status": "review",
        "patterns": [
            re.compile(r"\bno\s+pets\b", re.IGNORECASE),
            re.compile(r"\bsorry,\s*no\s+pets\b", re.IGNORECASE),
            re.compile(r"\bpets?\s+not\s+(?:allowed|accepted)\b", re.IGNORECASE),
            re.compile(r"\bstrictly\s+no\s+pets\b", re.IGNORECASE),
        ],
        "before": (
            "From 1 May 2026 in England, landlords will need to consider pet requests individually "
            "and give valid reasons if they refuse."
        ),
        "after": (
            "In England, landlords must consider pet requests individually and give valid reasons if they refuse."
        ),
        "guidance": "A listing can explain practical limits, but a blanket pet ban may need a case-by-case explanation.",
    },
]

_POSITIVE_RULES = [
    {
        "id": "pets_welcome",
        "category": "pets",
        "title": "Pets appear to be considered",
        "severity": "low",
        "status": "positive",
        "patterns": [
            re.compile(r"\bpets?\s+(?:considered|welcome)\b", re.IGNORECASE),
            re.compile(r"\bpet[- ]friendly\b", re.IGNORECASE),
        ],
        "summary": "This wording suggests the listing is open to discussing pets rather than rejecting them outright.",
        "guidance": "Still check whether any insurance or superior landlord conditions apply.",
    },
    {
        "id": "inclusive_renters",
        "category": "benefits_discrimination",
        "title": "Inclusive renter wording spotted",
        "severity": "low",
        "status": "positive",
        "patterns": [
            re.compile(r"\bdss\s+welcome\b", re.IGNORECASE),
            re.compile(r"\bbenefits?\s+considered\b", re.IGNORECASE),
            re.compile(r"\bfamil(?:y|ies)\s+welcome\b", re.IGNORECASE),
        ],
        "summary": "The listing includes wording that looks more inclusive for families or renters on benefits.",
        "guidance": "Still confirm affordability checks and any guarantor requirements in writing.",
    },
]


def html_to_listing_text(raw_html: str) -> str:
    """Convert raw HTML into a scan-friendly text block."""
    without_scripts = _SCRIPT_STYLE_RE.sub(" ", raw_html)
    without_tags = _TAG_RE.sub(" ", without_scripts)
    unescaped = html.unescape(without_tags)
    return _WHITESPACE_RE.sub(" ", unescaped).strip()


def _truncate(text: str, limit: int = 180) -> str:
    text = text.strip()
    if len(text) <= limit:
        return text
    return text[: limit - 1].rstrip() + "…"


def _snippet(text: str, match: re.Match[str], radius: int = 70) -> str:
    start = max(0, match.start() - radius)
    end = min(len(text), match.end() + radius)
    return _truncate(text[start:end])


def analyse_listing_compliance(
    listing_text: Optional[str],
    *,
    text_source: Optional[str],
    as_of: Optional[date] = None,
) -> dict:
    """Analyse listing wording against key Phase 1 Renters' Rights Act themes."""
    if not listing_text or len(listing_text.strip()) < 20:
        return {
            "status": "NOT_AVAILABLE",
            "headline": "Compliance scan unavailable",
            "summary": (
                "We could not analyse enough listing wording to scan for bidding, rent-in-advance, "
                "children or benefits discrimination, or blanket pet-ban wording."
            ),
            "analysed_text_source": text_source,
            "issues": [],
            "positives": [],
        }

    today = as_of or date.today()
    cleaned_text = listing_text.strip()
    issues: list[dict] = []
    positives: list[dict] = []
    seen_issue_ids: set[str] = set()

    for rule in _ISSUE_RULES:
        for pattern in rule["patterns"]:
            match = pattern.search(cleaned_text)
            if not match:
                continue
            if rule["id"] in seen_issue_ids:
                break
            issues.append(
                {
                    "id": rule["id"],
                    "category": rule["category"],
                    "title": rule["title"],
                    "severity": rule["severity"],
                    "status": rule["status"],
                    "applies_from": _PHASE_1_START,
                    "summary": rule["after"] if today >= _PHASE_1_START else rule["before"],
                    "guidance": rule["guidance"],
                    "evidence": _snippet(cleaned_text, match),
                }
            )
            seen_issue_ids.add(rule["id"])
            break

    for rule in _POSITIVE_RULES:
        for pattern in rule["patterns"]:
            match = pattern.search(cleaned_text)
            if not match:
                continue
            positives.append(
                {
                    "id": rule["id"],
                    "category": rule["category"],
                    "title": rule["title"],
                    "severity": rule["severity"],
                    "status": rule["status"],
                    "applies_from": _PHASE_1_START,
                    "summary": rule["summary"],
                    "guidance": rule["guidance"],
                    "evidence": _snippet(cleaned_text, match),
                }
            )
            break

    if issues:
        high_risk = any(issue["severity"] == "high" for issue in issues)
        status = "HIGH_RISK" if high_risk else "REVIEW"
        headline = (
            "Possible Renters’ Rights issues found"
            if today >= _PHASE_1_START
            else "Possible wording conflicts with the 1 May 2026 rules"
        )
        summary = (
            "We spotted listing wording that looks likely to clash with the Phase 1 England rules. "
            "Check the original advert and get advice before relying on it."
            if today < _PHASE_1_START
            else "We spotted wording that may conflict with the current Phase 1 England renting rules. "
                 "Check the original advert and supporting documents before relying on it."
        )
    else:
        status = "CLEAR"
        headline = "No obvious wording red flags spotted"
        summary = (
            "We did not spot obvious bidding, advance-rent, children or benefits discrimination, or "
            "blanket pet-ban wording in the text we analysed. That is not a legal guarantee."
        )

    return {
        "status": status,
        "headline": headline,
        "summary": summary,
        "analysed_text_source": text_source,
        "issues": issues,
        "positives": positives,
    }

