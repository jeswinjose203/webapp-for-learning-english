def sanitize_text(text: str) -> str:
    """Remove extra whitespace and normalize text."""
    return " ".join(text.strip().split())


def calculate_percentage(part: int, total: int) -> float:
    """Safely calculate percentage."""
    if total == 0:
        return 0.0
    return round((part / total) * 100, 1)


def clamp(value: float, min_val: float = 0.0, max_val: float = 100.0) -> float:
    """Clamp a value between min and max."""
    return max(min_val, min(max_val, value))
