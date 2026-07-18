from typing import Dict


class ScoringEngine:
    """
    Calculates all progress scores:
    - Grammar, Vocabulary, Speaking, Listening, Pronunciation, Confidence
    - Overall Level (A1-C2)
    """

    # Score thresholds for CEFR levels
    LEVEL_THRESHOLDS = {
        "A1": (0, 20),
        "A2": (20, 40),
        "B1": (40, 60),
        "B2": (60, 75),
        "C1": (75, 90),
        "C2": (90, 100),
    }

    def calculate_grammar_score(
        self, total_exercises: int, correct_exercises: int, mistakes_resolved: int, total_mistakes: int
    ) -> float:
        """
        Grammar score based on:
        - Exercise accuracy (70% weight)
        - Mistake resolution rate (30% weight)
        """
        if total_exercises == 0:
            accuracy = 0.0
        else:
            accuracy = (correct_exercises / total_exercises) * 100

        if total_mistakes == 0:
            resolution_rate = 100.0
        else:
            resolution_rate = (mistakes_resolved / total_mistakes) * 100

        score = (accuracy * 0.7) + (resolution_rate * 0.3)
        return round(min(100, max(0, score)), 1)

    def calculate_vocabulary_score(self, total_words: int, known_words: int, mastered_words: int) -> float:
        """
        Vocabulary score based on:
        - Known word percentage (50% weight)
        - Mastered word percentage (50% weight)
        """
        if total_words == 0:
            return 0.0

        known_pct = (known_words / total_words) * 100
        mastered_pct = (mastered_words / total_words) * 100

        score = (known_pct * 0.5) + (mastered_pct * 0.5)
        return round(min(100, max(0, score)), 1)

    def calculate_speaking_score(
        self, conversations_held: int, avg_message_length: float, grammar_accuracy_in_chat: float
    ) -> float:
        """
        Speaking score based on:
        - Number of conversations (30% weight, caps at 50 convos = 100%)
        - Average message length (30% weight, caps at 20 words = 100%)
        - Grammar accuracy in chat (40% weight)
        """
        convo_score = min(100, (conversations_held / 50) * 100)
        length_score = min(100, (avg_message_length / 20) * 100)

        score = (convo_score * 0.3) + (length_score * 0.3) + (grammar_accuracy_in_chat * 0.4)
        return round(min(100, max(0, score)), 1)

    def calculate_confidence_score(
        self, messages_sent: int, avg_response_time_seconds: float, error_rate_trend: float
    ) -> float:
        """
        Confidence estimated from:
        - Number of messages sent (engagement)
        - Whether error rate is decreasing (improvement)
        """
        engagement = min(100, (messages_sent / 100) * 100)
        # error_rate_trend: negative = improving, positive = getting worse
        improvement = max(0, min(100, 50 - (error_rate_trend * 50)))

        score = (engagement * 0.4) + (improvement * 0.6)
        return round(min(100, max(0, score)), 1)

    def calculate_overall_score(self, scores: Dict[str, float]) -> float:
        """
        Overall score: weighted average of all skills.
        Grammar: 25%, Vocabulary: 25%, Speaking: 25%, Confidence: 15%, Other: 10%
        """
        weights = {
            "grammar": 0.25,
            "vocabulary": 0.25,
            "speaking": 0.25,
            "confidence": 0.15,
            "pronunciation": 0.05,
            "listening": 0.05,
        }

        total = 0.0
        for skill, weight in weights.items():
            total += scores.get(skill, 0.0) * weight

        return round(min(100, max(0, total)), 1)

    def determine_level(self, overall_score: float) -> str:
        """Determine CEFR level from overall score."""
        for level, (low, high) in self.LEVEL_THRESHOLDS.items():
            if low <= overall_score < high:
                return level
        return "C2"

    def should_level_up(self, current_level: str, overall_score: float) -> bool:
        """Check if student should move to the next level."""
        level_order = ["A1", "A2", "B1", "B2", "C1", "C2"]
        current_index = level_order.index(current_level) if current_level in level_order else 0
        new_level = self.determine_level(overall_score)
        new_index = level_order.index(new_level) if new_level in level_order else 0
        return new_index > current_index
