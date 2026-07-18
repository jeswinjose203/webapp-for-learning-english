from typing import Dict, List, Optional
from datetime import datetime


class MemoryEngine:
    """
    Tracks every mistake over time.
    - Records when a mistake is made
    - Tracks how many times it's repeated
    - Removes from weak topics after 3 correct uses
    - Determines what to re-test and when
    """

    def __init__(self):
        # In-memory store (in production, this comes from DB)
        self.mistakes: List[Dict] = []

    def record_mistake(self, original: str, corrected: str, error_type: str) -> Dict:
        """Record a new mistake or increment count if already tracked."""
        # Check if we've seen this mistake before
        for mistake in self.mistakes:
            if mistake["original"].lower() == original.lower():
                mistake["times_made"] += 1
                mistake["last_seen"] = datetime.utcnow()
                mistake["correct_streak"] = 0  # Reset streak on error
                return mistake

        # New mistake
        entry = {
            "original": original,
            "corrected": corrected,
            "error_type": error_type,
            "times_made": 1,
            "correct_streak": 0,
            "is_resolved": False,
            "first_seen": datetime.utcnow(),
            "last_seen": datetime.utcnow(),
        }
        self.mistakes.append(entry)
        return entry

    def record_correct_usage(self, original: str) -> Dict:
        """Record when user correctly uses something they previously got wrong."""
        for mistake in self.mistakes:
            if mistake["original"].lower() == original.lower():
                mistake["correct_streak"] += 1
                # Resolved after 3 correct uses
                if mistake["correct_streak"] >= 3:
                    mistake["is_resolved"] = True
                return mistake
        return {}

    def get_unresolved_mistakes(self) -> List[Dict]:
        """Get all mistakes that haven't been mastered yet."""
        return [m for m in self.mistakes if not m["is_resolved"]]

    def get_worst_mistakes(self, limit: int = 5) -> List[Dict]:
        """Get the most frequent unresolved mistakes."""
        unresolved = self.get_unresolved_mistakes()
        sorted_mistakes = sorted(unresolved, key=lambda x: x["times_made"], reverse=True)
        return sorted_mistakes[:limit]

    def get_mistakes_by_type(self) -> Dict[str, int]:
        """Get count of unresolved mistakes grouped by error type."""
        type_counts = {}
        for mistake in self.get_unresolved_mistakes():
            error_type = mistake["error_type"]
            type_counts[error_type] = type_counts.get(error_type, 0) + 1
        return type_counts

    def should_retest(self, mistake: Dict) -> bool:
        """
        Determine if a mistake should be re-tested.
        Re-test if: not resolved AND (made more than once OR last seen > 1 day ago)
        """
        if mistake["is_resolved"]:
            return False
        if mistake["times_made"] > 1:
            return True
        # Re-test after some time has passed
        time_since = (datetime.utcnow() - mistake["last_seen"]).days
        return time_since >= 1

    def get_weakness_summary(self) -> Dict:
        """Get a summary of weak areas for the student."""
        type_counts = self.get_mistakes_by_type()
        total = sum(type_counts.values())

        if total == 0:
            return {"weaknesses": [], "strongest": "all_areas"}

        weaknesses = []
        for error_type, count in sorted(type_counts.items(), key=lambda x: x[1], reverse=True):
            percentage = (count / total) * 100
            weaknesses.append({
                "type": error_type,
                "count": count,
                "percentage": round(percentage, 1),
            })

        return {
            "weaknesses": weaknesses,
            "total_unresolved": total,
            "worst_area": weaknesses[0]["type"] if weaknesses else None,
        }
