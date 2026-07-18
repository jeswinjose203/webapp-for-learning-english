import re
from typing import List, Dict


class GrammarEngine:
    """
    Rule-based grammar error detection and correction.
    Detects: subject-verb agreement, articles, verb tense, prepositions,
    plurals, word order, and common ESL mistakes.
    """

    def __init__(self):
        self.subject_verb_rules = {
            r"\bi\s+has\b": ("I have", "Use 'have' with 'I', not 'has'."),
            r"\bi\s+does\b": ("I do", "Use 'do' with 'I', not 'does'."),
            r"\bi\s+is\b": ("I am", "Use 'am' with 'I', not 'is'."),
            r"\bhe\s+have\b": ("he has", "Use 'has' with 'he/she/it'."),
            r"\bshe\s+have\b": ("she has", "Use 'has' with 'he/she/it'."),
            r"\bit\s+have\b": ("it has", "Use 'has' with 'he/she/it'."),
            r"\bhe\s+do\b": ("he does", "Use 'does' with 'he/she/it'."),
            r"\bshe\s+do\b": ("she does", "Use 'does' with 'he/she/it'."),
            r"\bhe\s+go\s": ("he goes", "Use 'goes' with 'he/she/it'."),
            r"\bshe\s+go\s": ("she goes", "Use 'goes' with 'he/she/it'."),
            r"\bit\s+go\s": ("it goes", "Use 'goes' with 'he/she/it'."),
            r"\bhe\s+work\b": ("he works", "Add 's' to verbs with 'he/she/it'."),
            r"\bshe\s+work\b": ("she works", "Add 's' to verbs with 'he/she/it'."),
            r"\bhe\s+like\b": ("he likes", "Add 's' to verbs with 'he/she/it'."),
            r"\bshe\s+like\b": ("she likes", "Add 's' to verbs with 'he/she/it'."),
            r"\bhe\s+want\b": ("he wants", "Add 's' to verbs with 'he/she/it'."),
            r"\bshe\s+want\b": ("she wants", "Add 's' to verbs with 'he/she/it'."),
            r"\bthey\s+has\b": ("they have", "Use 'have' with 'they'."),
            r"\bwe\s+has\b": ("we have", "Use 'have' with 'we'."),
            r"\bthey\s+is\b": ("they are", "Use 'are' with 'they'."),
            r"\bwe\s+is\b": ("we are", "Use 'are' with 'we'."),
            r"\byou\s+is\b": ("you are", "Use 'are' with 'you'."),
        }

        self.article_patterns = [
            (r"\bi\s+work\s+(\w+)\s+company\b", r"I work at a \1 company",
             "Use 'at a' before a workplace.", "article"),
            (r"\bi\s+am\s+(student|teacher|doctor|engineer|developer|programmer|designer|manager|worker)\b",
             r"I am a \1", "Use 'a/an' before a profession.", "article"),
            (r"\bi\s+have\s+(car|dog|cat|house|phone|book|computer|job|problem|question)\b",
             r"I have a \1", "Use 'a/an' before a singular countable noun.", "article"),
            (r"\bi\s+go\s+to\s+(office|school|market|hospital|airport|station)\b",
             r"I go to the \1", "Use 'the' for specific places you go to regularly.", "article"),
            (r"\bis\s+(best|worst|most|least|biggest|smallest)\b",
             r"is the \1", "Use 'the' with superlatives.", "article"),
        ]

        self.tense_patterns = [
            (r"\bi\s+go\s+(yesterday|last\s+\w+|ago)\b", r"I went \1",
             "Use past tense for past events.", "verb_tense"),
            (r"\bi\s+eat\s+(yesterday|last\s+\w+|ago)\b", r"I ate \1",
             "Use past tense for past events.", "verb_tense"),
            (r"\bi\s+see\s+(him|her|them|it)\s+(yesterday|last\s+\w+)\b", r"I saw \1 \2",
             "Use past tense for past events.", "verb_tense"),
            (r"\byesterday\s+i\s+go\b", "yesterday I went",
             "Use past tense for past events.", "verb_tense"),
            (r"\bi\s+am\s+go\b", "I am going",
             "Use '-ing' form after 'am/is/are'.", "verb_tense"),
            (r"\bi\s+am\s+work\b", "I am working",
             "Use '-ing' form after 'am/is/are'.", "verb_tense"),
            (r"\b(he|she|it)\s+is\s+go\b", r"\1 is going",
             "Use '-ing' form after 'am/is/are'.", "verb_tense"),
        ]

        self.preposition_patterns = [
            (r"\bgood\s+in\s+(english|math|sports|cooking|swimming)\b",
             r"good at \1", "Use 'good at' for skills.", "preposition"),
            (r"\bdepend\s+of\b", "depend on",
             "Use 'depend on', not 'depend of'.", "preposition"),
            (r"\binterested\s+for\b", "interested in",
             "Use 'interested in', not 'interested for'.", "preposition"),
            (r"\blisten\s+(music|songs|radio|podcast)\b", r"listen to \1",
             "Use 'listen to' before what you're listening to.", "preposition"),
            (r"\bmarried\s+with\b", "married to",
             "Use 'married to', not 'married with'.", "preposition"),
        ]

        self.common_mistakes = [
            (r"\bi\s+am\s+agree\b", "I agree",
             "'Agree' is a verb, not an adjective. Don't use 'am' before it.", "word_order"),
            (r"\bi\s+am\s+not\s+agree\b", "I don't agree",
             "Use 'don't agree' instead of 'am not agree'.", "word_order"),
            (r"\btold\s+to\s+me\b", "told me",
             "'Tell' doesn't need 'to' before the person.", "word_order"),
            (r"\bdidn'?t\s+went\b", "didn't go",
             "Use base form after 'didn't'.", "verb_tense"),
            (r"\bdidn'?t\s+saw\b", "didn't see",
             "Use base form after 'didn't'.", "verb_tense"),
            (r"\bmore\s+better\b", "better",
             "'Better' already means 'more good'. Don't add 'more'.", "word_order"),
            (r"\bmore\s+easier\b", "easier",
             "'Easier' already is comparative. Don't add 'more'.", "word_order"),
            (r"\binformations\b", "information",
             "'Information' is uncountable. No plural form.", "plural"),
            (r"\badvices\b", "advice",
             "'Advice' is uncountable. No plural form.", "plural"),
            (r"\bfurnitures\b", "furniture",
             "'Furniture' is uncountable. No plural form.", "plural"),
            (r"\bhomeworks\b", "homework",
             "'Homework' is uncountable. No plural form.", "plural"),
        ]

    def analyze(self, text: str) -> Dict:
        """Analyze text for grammar errors and return corrections."""
        corrections = []
        lower_text = text.lower()

        # Check subject-verb agreement
        for pattern, fix_info in self.subject_verb_rules.items():
            match = re.search(pattern, lower_text)
            if match:
                correction_text, explanation = fix_info
                corrections.append({
                    "original": match.group(0),
                    "corrected": correction_text,
                    "explanation": explanation,
                    "error_type": "subject_verb",
                })

        # Check articles
        for pattern, replacement, explanation, error_type in self.article_patterns:
            match = re.search(pattern, lower_text)
            if match:
                original = match.group(0)
                corrected = re.sub(pattern, replacement, original)
                corrections.append({
                    "original": original,
                    "corrected": corrected,
                    "explanation": explanation,
                    "error_type": error_type,
                })

        # Check verb tense
        for pattern, replacement, explanation, error_type in self.tense_patterns:
            match = re.search(pattern, lower_text)
            if match:
                original = match.group(0)
                corrected = re.sub(pattern, replacement, original)
                corrections.append({
                    "original": original,
                    "corrected": corrected,
                    "explanation": explanation,
                    "error_type": error_type,
                })

        # Check prepositions
        for pattern, replacement, explanation, error_type in self.preposition_patterns:
            match = re.search(pattern, lower_text)
            if match:
                original = match.group(0)
                corrected = re.sub(pattern, replacement, original)
                corrections.append({
                    "original": original,
                    "corrected": corrected,
                    "explanation": explanation,
                    "error_type": error_type,
                })

        # Check common mistakes
        for pattern, replacement, explanation, error_type in self.common_mistakes:
            match = re.search(pattern, lower_text)
            if match:
                corrections.append({
                    "original": match.group(0),
                    "corrected": replacement,
                    "explanation": explanation,
                    "error_type": error_type,
                })

        return {
            "corrections": corrections,
            "has_errors": len(corrections) > 0,
            "error_count": len(corrections),
        }
