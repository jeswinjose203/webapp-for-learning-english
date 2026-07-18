from typing import Dict, List
from datetime import datetime, timedelta


WORD_BANK = {
    "A1": [
        {"word": "hello", "meaning": "a greeting", "example": "Hello, how are you?"},
        {"word": "book", "meaning": "pages bound together for reading", "example": "I read a book."},
        {"word": "water", "meaning": "liquid you drink", "example": "I drink water every day."},
        {"word": "house", "meaning": "a building where people live", "example": "My house is big."},
        {"word": "food", "meaning": "things you eat", "example": "The food is delicious."},
        {"word": "work", "meaning": "a job or activity", "example": "I go to work at 9."},
        {"word": "happy", "meaning": "feeling good", "example": "I am happy today."},
        {"word": "friend", "meaning": "a person you like", "example": "She is my friend."},
        {"word": "family", "meaning": "your parents, siblings, etc.", "example": "I love my family."},
        {"word": "morning", "meaning": "early part of the day", "example": "Good morning!"},
    ],
    "A2": [
        {"word": "although", "meaning": "even though", "example": "Although it rained, we went out."},
        {"word": "however", "meaning": "but, on the other hand", "example": "I was tired. However, I kept working."},
        {"word": "unless", "meaning": "if not", "example": "Unless you hurry, we'll be late."},
        {"word": "already", "meaning": "before now", "example": "I have already eaten."},
        {"word": "perhaps", "meaning": "maybe", "example": "Perhaps we should go home."},
        {"word": "quite", "meaning": "fairly, rather", "example": "The test was quite difficult."},
        {"word": "actually", "meaning": "in fact, really", "example": "Actually, I disagree."},
        {"word": "improve", "meaning": "to make better", "example": "I want to improve my English."},
        {"word": "decision", "meaning": "a choice you make", "example": "It was a difficult decision."},
        {"word": "experience", "meaning": "something that happens to you", "example": "It was a great experience."},
    ],
    "B1": [
        {"word": "nevertheless", "meaning": "despite that", "example": "It was hard. Nevertheless, I finished."},
        {"word": "consequently", "meaning": "as a result", "example": "He was late. Consequently, he missed the bus."},
        {"word": "adequate", "meaning": "enough, sufficient", "example": "The food was adequate."},
        {"word": "accomplish", "meaning": "to achieve, complete", "example": "She accomplished her goal."},
        {"word": "significant", "meaning": "important, large", "example": "A significant change occurred."},
        {"word": "opportunity", "meaning": "a chance to do something", "example": "This is a great opportunity."},
        {"word": "particularly", "meaning": "especially", "example": "I particularly enjoy reading."},
        {"word": "eventually", "meaning": "in the end, finally", "example": "He eventually found a job."},
        {"word": "appreciate", "meaning": "to be grateful for", "example": "I appreciate your help."},
        {"word": "circumstance", "meaning": "a condition or situation", "example": "Under the circumstances, we stayed."},
    ],
    "B2": [
        {"word": "ambiguous", "meaning": "having more than one meaning", "example": "The instructions were ambiguous."},
        {"word": "comprehensive", "meaning": "complete, thorough", "example": "It was a comprehensive review."},
        {"word": "inevitable", "meaning": "certain to happen", "example": "Change is inevitable."},
        {"word": "predominant", "meaning": "most common or important", "example": "English is the predominant language."},
        {"word": "simultaneously", "meaning": "at the same time", "example": "Both events happened simultaneously."},
        {"word": "fluctuate", "meaning": "to change frequently", "example": "Prices fluctuate daily."},
        {"word": "implication", "meaning": "a possible effect or result", "example": "Consider the implications."},
        {"word": "sophisticated", "meaning": "complex, advanced", "example": "It's a sophisticated system."},
        {"word": "reluctant", "meaning": "unwilling", "example": "He was reluctant to speak."},
        {"word": "substantial", "meaning": "large in amount", "example": "A substantial improvement was made."},
    ],
    "C1": [
        {"word": "juxtapose", "meaning": "to place side by side for comparison", "example": "The article juxtaposes two views."},
        {"word": "meticulous", "meaning": "very careful about details", "example": "She is meticulous in her work."},
        {"word": "ubiquitous", "meaning": "found everywhere", "example": "Smartphones are ubiquitous."},
        {"word": "exacerbate", "meaning": "to make worse", "example": "The rain exacerbated the flooding."},
        {"word": "unprecedented", "meaning": "never happened before", "example": "An unprecedented event occurred."},
        {"word": "paradox", "meaning": "a contradictory statement that may be true", "example": "It's a paradox of modern life."},
        {"word": "pragmatic", "meaning": "practical, realistic", "example": "Take a pragmatic approach."},
        {"word": "eloquent", "meaning": "fluent, persuasive in speech", "example": "She gave an eloquent speech."},
        {"word": "catalyst", "meaning": "something that causes change", "example": "The event was a catalyst for reform."},
        {"word": "ephemeral", "meaning": "lasting a very short time", "example": "Fame can be ephemeral."},
    ],
}


class VocabularyEngine:
    """
    Tracks known/unknown words, introduces new words by level,
    uses simplified SM-2 spaced repetition for review scheduling.
    """

    def __init__(self):
        self.word_bank = WORD_BANK

    def analyze(self, text: str, level: str = "A1") -> Dict:
        """Analyze user text and suggest new words to learn."""
        words_in_text = set(text.lower().split())
        level_words = self._get_words_for_level(level)

        new_words = []
        for word_entry in level_words:
            if word_entry["word"] not in words_in_text:
                new_words.append(word_entry)
            if len(new_words) >= 3:
                break

        return {
            "words_used": list(words_in_text),
            "new_words": new_words,
            "level": level,
        }

    def get_practice_words(self, level: str, known_words: List[str] = None, count: int = 5) -> List[Dict]:
        """Get words to practice, prioritizing unknown ones."""
        if known_words is None:
            known_words = []

        level_words = self._get_words_for_level(level)
        unknown = [w for w in level_words if w["word"] not in known_words]
        return unknown[:count]

    def calculate_next_review(self, mastery_count: int, last_review: datetime = None) -> datetime:
        """
        Simplified SM-2 spaced repetition.
        Intervals increase: 1d, 3d, 7d, 14d, 30d, 90d
        """
        intervals = [1, 3, 7, 14, 30, 90]
        index = min(mastery_count, len(intervals) - 1)
        base = last_review or datetime.utcnow()
        return base + timedelta(days=intervals[index])

    def is_mastered(self, mastery_count: int) -> bool:
        """Word is mastered after 3 correct in a row."""
        return mastery_count >= 3

    def check_answer(self, user_answer: str, correct_word: str) -> Dict:
        """Check if vocabulary answer is correct."""
        is_correct = user_answer.strip().lower() == correct_word.strip().lower()
        return {
            "is_correct": is_correct,
            "correct_answer": correct_word,
            "user_answer": user_answer,
        }

    def _get_words_for_level(self, level: str) -> List[Dict]:
        """Get word bank for a level, falling back to A1."""
        return self.word_bank.get(level, self.word_bank["A1"])
