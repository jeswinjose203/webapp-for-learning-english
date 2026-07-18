from typing import Dict, List


# Common pronunciation difficulties by native language
PRONUNCIATION_ISSUES = {
    "hindi": [
        {"sound": "v/w", "example": "vine vs wine", "tip": "Touch your top teeth to your lower lip for 'v'. Round your lips for 'w'."},
        {"sound": "th", "example": "think, this", "tip": "Put your tongue between your teeth for 'th' sounds."},
        {"sound": "r/l", "example": "right vs light", "tip": "For 'r', curl your tongue back. For 'l', touch the roof behind your teeth."},
    ],
    "spanish": [
        {"sound": "b/v", "example": "berry vs very", "tip": "For 'v', touch top teeth to lower lip. For 'b', press both lips together."},
        {"sound": "sh/ch", "example": "ship vs chip", "tip": "For 'sh', push air through rounded lips. For 'ch', start with tongue touching the roof."},
        {"sound": "j", "example": "jump, juice", "tip": "Start with tongue touching the roof, then release with voice."},
    ],
    "chinese": [
        {"sound": "l/r", "example": "light vs right", "tip": "For 'l', tongue touches behind top teeth. For 'r', tongue curls back without touching."},
        {"sound": "th", "example": "think, that", "tip": "Put tongue between teeth. Blow air for 'think'. Add voice for 'that'."},
        {"sound": "v/w", "example": "very vs wary", "tip": "For 'v', top teeth on lower lip. For 'w', round lips without teeth."},
    ],
    "arabic": [
        {"sound": "p/b", "example": "pat vs bat", "tip": "For 'p', press lips and release without voice. For 'b', add voice."},
        {"sound": "short vowels", "example": "sit vs seat", "tip": "Short 'i' is quick and relaxed. Long 'ee' is tense and held longer."},
    ],
    "unknown": [
        {"sound": "th", "example": "think, this, that", "tip": "Put your tongue between your teeth for 'th' sounds."},
        {"sound": "r", "example": "run, right, red", "tip": "Curl your tongue back without touching the roof of your mouth."},
    ],
}


class PronunciationEngine:
    """
    Pronunciation guidance based on native language.
    Currently provides tips and common issues.
    Future: phonetic analysis with audio input.
    """

    def __init__(self):
        self.issues_db = PRONUNCIATION_ISSUES

    def get_tips_for_language(self, native_language: str) -> List[Dict]:
        """Get pronunciation tips based on native language."""
        lang = native_language.lower()
        return self.issues_db.get(lang, self.issues_db["unknown"])

    def get_word_pronunciation_guide(self, word: str) -> Dict:
        """
        Get pronunciation guide for a specific word.
        Identifies tricky sounds in the word.
        """
        tricky_sounds = []

        # Check for common difficult patterns
        if "th" in word.lower():
            tricky_sounds.append({
                "sound": "th",
                "tip": "Put your tongue between your teeth.",
                "position": word.lower().index("th"),
            })
        if "ough" in word.lower():
            tricky_sounds.append({
                "sound": "ough",
                "tip": "This can be pronounced differently: 'though' (oh), 'tough' (uf), 'through' (oo).",
            })
        if word.lower().endswith("ed"):
            tricky_sounds.append({
                "sound": "-ed ending",
                "tip": "'-ed' can sound like /t/ (walked), /d/ (played), or /id/ (wanted).",
            })
        if "tion" in word.lower():
            tricky_sounds.append({
                "sound": "-tion",
                "tip": "Pronounce '-tion' as 'shun'.",
            })

        return {
            "word": word,
            "tricky_sounds": tricky_sounds,
            "has_tricky_sounds": len(tricky_sounds) > 0,
        }

    def evaluate_text_difficulty(self, text: str) -> Dict:
        """
        Estimate how difficult a text would be to pronounce.
        Based on word length, tricky sound patterns, etc.
        """
        words = text.split()
        difficult_words = []

        for word in words:
            guide = self.get_word_pronunciation_guide(word)
            if guide["has_tricky_sounds"]:
                difficult_words.append(guide)

        difficulty = len(difficult_words) / max(len(words), 1)
        if difficulty > 0.5:
            level = "hard"
        elif difficulty > 0.2:
            level = "medium"
        else:
            level = "easy"

        return {
            "difficulty_level": level,
            "difficult_words": difficult_words,
            "total_words": len(words),
            "difficult_count": len(difficult_words),
        }
