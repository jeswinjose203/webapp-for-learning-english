from typing import Dict


class RecommendationEngine:
    """
    Determines daily focus areas based on student weaknesses.
    Automatically allocates time between grammar, vocabulary, and speaking.
    No manual lesson selection — the system decides what you need.
    """

    def get_daily_focus(
        self,
        grammar_score: float = 0.0,
        vocabulary_score: float = 0.0,
        speaking_score: float = 0.0,
    ) -> Dict[str, float]:
        """
        Calculate how much time to spend on each area today.
        Lower scores get more focus. Returns percentages that sum to 100.

        Example:
            grammar=30%, vocabulary=70%, speaking=20%
            → Focus more on speaking (lowest), then grammar, then vocab
        """
        # Invert scores: lower score = higher need
        grammar_need = max(0, 100 - grammar_score)
        vocabulary_need = max(0, 100 - vocabulary_score)
        speaking_need = max(0, 100 - speaking_score)

        total_need = grammar_need + vocabulary_need + speaking_need

        # If student is perfect at everything, equal distribution
        if total_need == 0:
            return {
                "grammar": 33.0,
                "vocabulary": 33.0,
                "speaking": 34.0,
            }

        # Allocate proportionally to need
        grammar_pct = round((grammar_need / total_need) * 100, 1)
        vocabulary_pct = round((vocabulary_need / total_need) * 100, 1)
        speaking_pct = round(100 - grammar_pct - vocabulary_pct, 1)

        # Ensure minimum 10% for each area so nothing is ignored
        focus = {
            "grammar": max(10.0, grammar_pct),
            "vocabulary": max(10.0, vocabulary_pct),
            "speaking": max(10.0, speaking_pct),
        }

        # Normalize to 100%
        total = sum(focus.values())
        for key in focus:
            focus[key] = round((focus[key] / total) * 100, 1)

        return focus

    def get_lesson_counts(self, focus: Dict[str, float]) -> Dict[str, int]:
        """
        Convert focus percentages into concrete lesson item counts.
        Assumes a lesson has ~10 items total.
        """
        total_items = 10
        grammar_items = max(1, round(focus["grammar"] / 100 * total_items))
        vocab_items = max(1, round(focus["vocabulary"] / 100 * total_items))
        speaking_items = max(1, total_items - grammar_items - vocab_items)

        return {
            "grammar_exercises": grammar_items,
            "vocabulary_words": vocab_items,
            "speaking_prompts": speaking_items,
        }
