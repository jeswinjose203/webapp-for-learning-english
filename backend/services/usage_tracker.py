from sqlalchemy.orm import Session
from database.models import ApiUsage


# Pricing per 1M tokens (as of 2024-2025)
PRICING = {
    "gpt-4o-mini": {"input": 0.15, "output": 0.60},
    "gpt-4o": {"input": 2.50, "output": 10.00},
    "claude-sonnet-4-20250514": {"input": 3.00, "output": 15.00},
    "tts-1": {"per_1k_chars": 0.015},
    "tts-1-hd": {"per_1k_chars": 0.030},
}


def calculate_cost(provider: str, model: str, input_tokens: int, output_tokens: int) -> float:
    """Calculate cost in USD from actual token counts."""
    pricing = PRICING.get(model)
    if not pricing:
        # Fallback estimate
        if provider == "openai":
            pricing = PRICING["gpt-4o-mini"]
        else:
            pricing = PRICING["claude-sonnet-4-20250514"]

    input_cost = (input_tokens / 1_000_000) * pricing["input"]
    output_cost = (output_tokens / 1_000_000) * pricing["output"]
    return round(input_cost + output_cost, 6)


def calculate_tts_cost(model: str, characters: int) -> float:
    """Calculate TTS cost from character count."""
    pricing = PRICING.get(model, PRICING["tts-1"])
    return round((characters / 1000) * pricing["per_1k_chars"], 6)


def track_chat_usage(
    db: Session,
    student_id: int,
    provider: str,
    model: str,
    feature: str,
    input_tokens: int,
    output_tokens: int,
):
    """Track a chat/completion API call."""
    cost = calculate_cost(provider, model, input_tokens, output_tokens)

    usage = ApiUsage(
        student_id=student_id,
        provider=provider,
        model=model,
        feature=feature,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        total_tokens=input_tokens + output_tokens,
        cost_usd=cost,
    )
    db.add(usage)


def track_tts_usage(
    db: Session,
    student_id: int,
    model: str,
    characters: int,
):
    """Track a TTS API call."""
    cost = calculate_tts_cost(model, characters)

    usage = ApiUsage(
        student_id=student_id,
        provider="openai",
        model=model,
        feature="tts",
        input_tokens=0,
        output_tokens=0,
        total_tokens=0,
        cost_usd=cost,
        tts_characters=characters,
    )
    db.add(usage)
