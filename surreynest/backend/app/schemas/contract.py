"""Pydantic schemas for the AI tenancy agreement checker."""

from datetime import datetime
from typing import List, Literal

from pydantic import BaseModel, Field


class ContractCheckRequest(BaseModel):
    """Request body for checking a tenancy agreement."""

    contract_text: str = Field(min_length=100, max_length=50_000)


class ContractClause(BaseModel):
    """A single clause extracted and analysed from the contract."""

    clause_text: str
    risk_level: Literal["safe", "caution", "danger"]
    explanation: str
    recommendation: str


class ContractCheckResponse(BaseModel):
    """Full analysis of a tenancy agreement."""

    overall_risk: Literal["low", "medium", "high"]
    summary: str
    clauses: List[ContractClause]
    overall_recommendation: str
    checked_at: datetime
