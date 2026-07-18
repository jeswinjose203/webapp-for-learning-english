import random
from typing import Dict, List
from ai.recommendation.engine import RecommendationEngine


# Grammar exercises by level
GRAMMAR_EXERCISES = {
    "A1": [
        {"instruction": "Fill in the blank: I ___ a student.", "answer": "am", "topic": "verb_to_be"},
        {"instruction": "Fill in the blank: She ___ a book.", "answer": "has", "topic": "have_has"},
        {"instruction": "Fill in the blank: They ___ to school every day.", "answer": "go", "topic": "simple_present"},
        {"instruction": "Correct this: 'He go to work.'", "answer": "He goes to work.", "topic": "subject_verb"},
        {"instruction": "Correct this: 'I has a dog.'", "answer": "I have a dog.", "topic": "subject_verb"},
        {"instruction": "Fill in: We ___ happy today.", "answer": "are", "topic": "verb_to_be"},
        {"instruction": "Correct this: 'She work in a hospital.'", "answer": "She works in a hospital.", "topic": "subject_verb"},
        {"instruction": "Fill in: I ___ English every day.", "answer": "study", "topic": "simple_present"},
    ],
    "A2": [
        {"instruction": "Fill in: I ___ to the store yesterday.", "answer": "went", "topic": "past_tense"},
        {"instruction": "Correct: 'I didn't went to school.'", "answer": "I didn't go to school.", "topic": "past_tense"},
        {"instruction": "Fill in: She ___ cooking when I arrived.", "answer": "was", "topic": "past_continuous"},
        {"instruction": "Correct: 'I am agree with you.'", "answer": "I agree with you.", "topic": "word_order"},
        {"instruction": "Fill in: I have ___ eaten lunch.", "answer": "already", "topic": "present_perfect"},
        {"instruction": "Correct: 'He told to me a story.'", "answer": "He told me a story.", "topic": "word_order"},
        {"instruction": "Fill in: If it rains, I ___ stay home.", "answer": "will", "topic": "conditionals"},
        {"instruction": "Correct: 'I am good in math.'", "answer": "I am good at math.", "topic": "prepositions"},
    ],
    "B1": [
        {"instruction": "Fill in: If I ___ rich, I would travel.", "answer": "were", "topic": "conditionals"},
        {"instruction": "Correct: 'I wish I can speak better.'", "answer": "I wish I could speak better.", "topic": "conditionals"},
        {"instruction": "Rewrite in passive: 'Someone stole my bike.'", "answer": "My bike was stolen.", "topic": "passive_voice"},
        {"instruction": "Fill in: By next year, I ___ graduated.", "answer": "will have", "topic": "future_perfect"},
        {"instruction": "Correct: 'Despite of the rain, we went out.'", "answer": "Despite the rain, we went out.", "topic": "prepositions"},
        {"instruction": "Fill in: She asked me where I ___.", "answer": "lived", "topic": "reported_speech"},
    ],
}

# Speaking prompts by level
SPEAKING_PROMPTS = {
    "A1": [
        "Introduce yourself. Say your name, age, and where you live.",
        "Describe your family. Who do you live with?",
        "Talk about your daily routine. What do you do in the morning?",
        "Describe your home. How many rooms does it have?",
        "Talk about your favorite food. Why do you like it?",
    ],
    "A2": [
        "Describe your last weekend. What did you do?",
        "Talk about a friend. How did you meet them?",
        "Describe your dream vacation. Where would you go?",
        "Talk about your job or studies. What do you like about it?",
        "Describe a typical day at work or school.",
    ],
    "B1": [
        "Give your opinion: Is social media good or bad? Why?",
        "Describe a challenge you overcame. What did you learn?",
        "Compare life in a city vs. a small town.",
        "Talk about a skill you'd like to learn and why.",
        "Describe a memorable experience from your life.",
    ],
}


class LessonGenerator:
    """
    Creates personalized daily lessons based on student level,
    weaknesses, and recommendation engine output.
    No fixed curriculum — each lesson is unique to the student.
    """

    def __init__(self):
        self.grammar_exercises = GRAMMAR_EXERCISES
        self.speaking_prompts = SPEAKING_PROMPTS

    def generate(self, level: str, focus: Dict[str, float], weaknesses: List[str] = None) -> Dict:
        """
        Generate a complete personalized lesson.

        Args:
            level: Student's CEFR level (A1-C1)
            focus: Percentage focus for each area from RecommendationEngine
            weaknesses: List of weak topics to prioritize
        """
        if weaknesses is None:
            weaknesses = []

        # Get item counts from focus percentages
        rec_engine = RecommendationEngine()
        counts = rec_engine.get_lesson_counts(focus)

        # Build lesson content
        grammar = self._get_grammar_exercises(level, counts["grammar_exercises"], weaknesses)
        vocabulary = self._get_vocabulary_section(level, counts["vocabulary_words"])
        speaking = self._get_speaking_section(level, counts["speaking_prompts"])

        # Create lesson title based on focus
        primary_focus = max(focus, key=focus.get)
        title = self._generate_title(primary_focus, level)

        return {
            "title": title,
            "type": "mixed",
            "level": level,
            "focus": focus,
            "sections": {
                "grammar": grammar,
                "vocabulary": vocabulary,
                "speaking": speaking,
            },
            "total_items": counts["grammar_exercises"] + counts["vocabulary_words"] + counts["speaking_prompts"],
        }

    def _get_grammar_exercises(self, level: str, count: int, weaknesses: List[str]) -> List[Dict]:
        """Get grammar exercises, prioritizing weak areas."""
        available = self.grammar_exercises.get(level, self.grammar_exercises["A1"])

        # Prioritize exercises matching weaknesses
        if weaknesses:
            priority = [ex for ex in available if ex["topic"] in weaknesses]
            other = [ex for ex in available if ex["topic"] not in weaknesses]
            ordered = priority + other
        else:
            ordered = available[:]
            random.shuffle(ordered)

        return ordered[:count]

    def _get_vocabulary_section(self, level: str, count: int) -> List[Dict]:
        """Get vocabulary items for the lesson."""
        from ai.vocabulary.engine import VocabularyEngine
        vocab_engine = VocabularyEngine()
        words = vocab_engine.get_practice_words(level, count=count)
        return words

    def _get_speaking_section(self, level: str, count: int) -> List[str]:
        """Get speaking prompts for the lesson."""
        available = self.speaking_prompts.get(level, self.speaking_prompts["A1"])
        prompts = available[:]
        random.shuffle(prompts)
        return prompts[:count]

    def _generate_title(self, primary_focus: str, level: str) -> str:
        """Generate a lesson title based on primary focus."""
        titles = {
            "grammar": [
                f"Grammar Practice - Level {level}",
                f"Building Stronger Sentences ({level})",
                f"Grammar Focus Day ({level})",
            ],
            "vocabulary": [
                f"New Words to Learn - Level {level}",
                f"Vocabulary Builder ({level})",
                f"Expand Your Word Power ({level})",
            ],
            "speaking": [
                f"Conversation Practice - Level {level}",
                f"Speaking Skills ({level})",
                f"Let's Talk! ({level})",
            ],
        }
        options = titles.get(primary_focus, titles["grammar"])
        return random.choice(options)
