"""AI tenancy agreement checker using Anthropic Claude.

Analyses UK tenancy agreements for problematic clauses under:
- Tenant Fees Act 2019
- Housing Act 1988
- Renters' Rights Act 2025
- Consumer Rights Act 2015
"""

import json
import logging
from datetime import datetime, timezone

import anthropic

from app.config import settings
from app.schemas.contract import ContractCheckRequest, ContractCheckResponse

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = """You are a UK tenancy law specialist with deep knowledge of:
- Tenant Fees Act 2019 (deposit cap: 5 weeks rent; prohibited fees: admin, referencing, credit checks, guarantor, renewal, check-in)
- Housing Act 1988 (assured shorthold tenancies, Section 21, Section 8)
- Renters' Rights Act 2025 (abolition of fixed terms, periodic tenancies, Section 13 rent increases)
- Consumer Rights Act 2015 (unfair contract terms — must be transparent and not cause significant imbalance)
- Mandatory landlord obligations: provide How to Rent guide, valid EPC, deposit protection scheme details within 30 days

ILLEGAL OR UNENFORCEABLE CLAUSES:
- Fair wear and tear waiver (landlord cannot charge for normal wear)
- Entry without 24 hours written notice (except genuine emergencies)
- Professional cleaning charge unless professionally cleaned at tenancy start
- Charges for admin, referencing, credit checks, renewal, guarantor setup
- Prohibiting pets without reasonable consideration (Renters' Rights Act 2025)
- Restricting tenant's right to challenge a Section 13 rent increase
- Blanket ban on subletting without reasonable justification
- Any term purporting to waive statutory rights

Analyse the provided tenancy agreement and return a JSON object (NO markdown fences, raw JSON only):
{
  "overall_risk": "low" | "medium" | "high",
  "summary": "2-3 sentence plain English summary of the agreement's overall quality",
  "clauses": [
    {
      "clause_text": "The exact problematic text from the agreement (max 200 chars)",
      "risk_level": "safe" | "caution" | "danger",
      "explanation": "Plain English explanation of what this means and why it matters",
      "recommendation": "Specific action: negotiate removal, ask for clarification, or accept"
    }
  ],
  "overall_recommendation": "Concrete advice: sign, negotiate first, or seek legal advice"
}

Rules:
- Order clauses: danger first, then caution, then safe
- Include maximum 15 clauses total
- Focus on clauses that materially affect the tenant's rights or finances
- Use plain English — no legal jargon
- Be specific about WHY a clause is dangerous (cite the relevant law)
- If a clause is standard and fair, include it as "safe" with brief confirmation"""

_ANALYSIS_PROMPT = """Please analyse this UK tenancy agreement and identify key clauses:

{contract_text}

Return ONLY a raw JSON object. No markdown, no code blocks, no explanation outside the JSON."""


async def check_contract(request: ContractCheckRequest) -> ContractCheckResponse:
    """Analyse a tenancy agreement using Claude AI.

    Args:
        request: ContractCheckRequest with the contract text.

    Returns:
        ContractCheckResponse with clause analysis.

    Raises:
        ValueError: If ANTHROPIC_API_KEY is not configured.
        RuntimeError: If AI analysis fails.
    """
    if not settings.anthropic_api_key:
        raise ValueError("AI contract checking is not available — ANTHROPIC_API_KEY not configured.")

    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

    prompt = _ANALYSIS_PROMPT.format(contract_text=request.contract_text)

    try:
        message = await client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=4096,
            timeout=90.0,
            system=_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": prompt}],
        )
    except anthropic.RateLimitError:
        raise RuntimeError("AI service is temporarily busy. Try again in a minute.")
    except anthropic.APITimeoutError:
        raise RuntimeError("Analysis timed out. Try with a shorter contract text.")
    except anthropic.APIError as e:
        logger.error("Anthropic API error: %s", e, exc_info=True)
        raise RuntimeError("AI service error. Please try again shortly.")

    raw_text = message.content[0].text.strip()

    # Strip accidental markdown fences
    if raw_text.startswith("```"):
        lines = raw_text.split("\n")
        raw_text = "\n".join(lines[1:])
        if raw_text.endswith("```"):
            raw_text = raw_text[: raw_text.rfind("```")].strip()

    try:
        data = json.loads(raw_text)
    except json.JSONDecodeError as e:
        logger.error("Failed to parse AI response as JSON. Raw: %s", raw_text[:500])
        raise RuntimeError("AI returned unexpected format. Please try again.")

    return ContractCheckResponse(
        overall_risk=data["overall_risk"],
        summary=data["summary"],
        clauses=data.get("clauses", []),
        overall_recommendation=data["overall_recommendation"],
        checked_at=datetime.now(timezone.utc),
    )
