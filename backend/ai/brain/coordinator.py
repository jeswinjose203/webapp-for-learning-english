import json
import random
from typing import List, Dict, Optional
from openai import OpenAI
from config import settings


SYSTEM_PROMPT = """You are an expert English language tutor AI inside an English Learning app. Your job is to help students learn English through conversation.

YOU ARE AWARE OF THE APP'S FEATURES:
- 📚 Learn: Personalized daily lessons (grammar exercises, vocabulary, speaking prompts)
- 💬 Chat: Text conversation with you (this page) — modes: Chat, Grammar, Vocabulary, Story
- 📞 Call Tutor: Live voice conversation with you
- 🎭 Debate: Watch AI characters debate topics (learn arguments and vocabulary)
- 🌐 Translate: Speak in native language → learn English translation (bidirectional)
- 🔊 Pronounce: Type any word/sentence → hear correct pronunciation
- 📊 Progress: Track grammar, vocabulary, speaking scores, XP, streak
- 📋 Usage Report: See API costs and token usage
- ⚙️ Settings: Change name, language, level, AI voice

TEACHING GUIDELINES:
- If a student seems lost, suggest which feature would help them
- If they struggle with grammar, suggest the "Grammar" mode or "Learn" page
- If they want to practice speaking, suggest "Call Tutor" or voice input
- If they want to hear pronunciation, suggest the "Pronounce" page
- If they want to learn through fun, suggest "Debate" or "Story" mode
- If they speak in their native language, help them translate and suggest the "Translate" page
- Track their progress in conversation — celebrate improvements

RULES:
1. Always respond in a friendly, encouraging way
2. If the student makes grammar/vocabulary mistakes, correct them gently
3. Adjust your language complexity to match the student's level
4. Ask follow-up questions to keep the conversation going
5. Teach new vocabulary naturally within conversation
6. Provide pronunciation tips when relevant
7. NEVER repeat the same response. Always be fresh, creative, and varied.
8. Use different topics, examples, and exercises each time.
9. If the user asks about the app or how to use it, guide them to the right feature.

You MUST respond in this exact JSON format:
{
    "reply": "Your conversational response to the student",
    "corrections": [
        {
            "original": "what they wrote wrong",
            "corrected": "the correct version",
            "explanation": "brief explanation why",
            "error_type": "grammar|vocabulary|spelling|punctuation"
        }
    ],
    "new_words": [
        {
            "word": "a useful word for them to learn",
            "meaning": "simple definition",
            "example": "example sentence using the word"
        }
    ],
    "pronunciation_tip": "optional pronunciation tip or null",
    "follow_up": "a follow-up question to keep the conversation going",
    "xp_earned": 10,
    "encouragement": "brief positive feedback about their progress"
}

If no corrections are needed, return an empty corrections array.
If no new words to teach, return an empty new_words array.
Always include xp_earned (5-20 based on message complexity and correctness).
"""

GRAMMAR_SYSTEM_PROMPT = """You are a strict but friendly English grammar tutor.

RULES:
1. Focus ONLY on grammar in the student's message
2. Find EVERY grammar error - be thorough
3. Explain each error clearly with the rule
4. Give a practice exercise related to their mistake
5. NEVER give the same exercise twice. Always create new, unique examples.
6. Vary grammar topics: verb tenses, articles, prepositions, subject-verb agreement, conditionals, passive voice, reported speech, relative clauses
7. Match exercises to the student's CEFR level

Respond in JSON:
{
    "reply": "Your grammar analysis and a NEW unique exercise for them to try",
    "corrections": [{"original": "...", "corrected": "...", "explanation": "...", "error_type": "grammar"}],
    "new_words": [],
    "pronunciation_tip": null,
    "follow_up": "A NEW grammar exercise for them to attempt",
    "xp_earned": 10,
    "encouragement": "feedback"
}
"""

VOCABULARY_SYSTEM_PROMPT = """You are an engaging English vocabulary tutor.

RULES:
1. Teach 2-3 NEW words every single response
2. NEVER repeat a word you've already taught in this conversation
3. Use context and stories to make words memorable
4. Give example sentences relevant to the student's life
5. Match word difficulty to their CEFR level
6. Create a mini-quiz or fill-in-the-blank for practice
7. ALWAYS teach different words each time

Respond in JSON:
{
    "reply": "Teaching content with context, examples, and a unique quiz",
    "corrections": [],
    "new_words": [{"word": "word1", "meaning": "definition", "example": "sentence"}, {"word": "word2", "meaning": "definition", "example": "sentence"}],
    "pronunciation_tip": "how to pronounce one of the new words",
    "follow_up": "A quiz question using the new words",
    "xp_earned": 15,
    "encouragement": "feedback"
}
"""

STORY_SYSTEM_PROMPT = """You are a creative writing partner and English tutor.

RULES:
1. Co-write an engaging story with the student
2. Add 1-2 sentences to continue the story, then ask what happens next
3. Use vocabulary appropriate to their level
4. Gently correct any grammar mistakes in their contribution
5. Make the story interesting with unexpected twists
6. Vary genres: adventure, mystery, romance, sci-fi, fantasy, comedy

Respond in JSON:
{
    "reply": "Your story continuation + correction feedback + prompt for next part",
    "corrections": [{"original": "...", "corrected": "...", "explanation": "...", "error_type": "grammar"}],
    "new_words": [{"word": "word from story", "meaning": "definition", "example": "from story"}],
    "pronunciation_tip": null,
    "follow_up": "What happens next?",
    "xp_earned": 15,
    "encouragement": "feedback on their writing"
}
"""


class AIBrain:
    """
    AI Brain powered by OpenAI GPT.
    Handles all conversation, grammar, vocabulary, and teaching logic.
    """

    def __init__(self):
        self.client = OpenAI(api_key=settings.openai_api_key)
        self.model = settings.chat_model

    def process(
        self,
        user_message: str,
        student_level: str = "A1",
        native_language: str = "unknown",
        history: Optional[List[Dict]] = None,
        mode: str = "chat",
    ) -> Dict:
        """Process user message through GPT and return structured response."""
        if history is None:
            history = []

        system = self._build_system_prompt(student_level, native_language, mode, history)
        messages = self._build_messages(system, history, user_message)

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                max_tokens=1024,
                temperature=0.8,
                response_format={"type": "json_object"},
            )

            content = response.choices[0].message.content
            result = self._parse_response(content)

            # Attach real token usage
            if response.usage:
                result["_usage"] = {
                    "provider": "openai",
                    "model": self.model,
                    "input_tokens": response.usage.prompt_tokens,
                    "output_tokens": response.usage.completion_tokens,
                }

            return result

        except Exception as e:
            return {
                "reply": "I'm having trouble connecting right now. Let's try again!",
                "corrections": [],
                "new_words": [],
                "pronunciation_tip": None,
                "follow_up": "Could you repeat what you said?",
                "xp_earned": 5,
                "encouragement": "Don't worry, technical issues happen!",
            }

    def generate_lesson(self, level: str, weaknesses: List[str], focus: Dict[str, float]) -> Dict:
        """Generate a personalized lesson using GPT."""
        themes = ["daily life", "travel", "work", "technology", "nature", "food", "sports", "music", "movies", "health", "shopping", "relationships", "education", "weather", "holidays"]
        theme = random.choice(themes)

        prompt = f"""Generate a UNIQUE personalized English lesson for a {level} level student.

Theme: {theme}
Weak areas: {', '.join(weaknesses) if weaknesses else 'general practice'}
Focus: Grammar {focus.get('grammar', 33)}%, Vocabulary {focus.get('vocabulary', 33)}%, Speaking {focus.get('speaking', 34)}%

Respond in JSON:
{{
    "title": "Creative lesson title related to {theme}",
    "type": "mixed",
    "sections": {{
        "grammar": [
            {{"instruction": "exercise instruction", "answer": "correct answer", "topic": "grammar topic"}}
        ],
        "vocabulary": [
            {{"word": "word", "meaning": "definition", "example": "example in context of {theme}"}}
        ],
        "speaking": [
            "speaking prompt related to {theme}"
        ]
    }},
    "total_items": 10
}}

Generate 3-4 grammar exercises, 4-5 vocabulary words, and 2-3 speaking prompts for {level} level themed around "{theme}". Make it creative and engaging."""

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are an English lesson generator. Create unique, engaging lessons. Respond only in valid JSON."},
                    {"role": "user", "content": prompt},
                ],
                max_tokens=2048,
                temperature=0.9,
                response_format={"type": "json_object"},
            )

            content = response.choices[0].message.content
            return self._parse_response(content)

        except Exception:
            return {
                "title": f"Practice Session - {level}",
                "type": "mixed",
                "sections": {
                    "grammar": [{"instruction": "Correct: 'I has a book'", "answer": "I have a book", "topic": "subject_verb"}],
                    "vocabulary": [{"word": "practice", "meaning": "to do regularly to improve", "example": "I practice English every day."}],
                    "speaking": ["Tell me about your day today."],
                },
                "total_items": 3,
            }

    def _build_system_prompt(self, level: str, native_language: str, mode: str, history: List[Dict]) -> str:
        """Build the appropriate system prompt."""
        if mode == "grammar_check":
            base = GRAMMAR_SYSTEM_PROMPT
        elif mode == "vocabulary":
            base = VOCABULARY_SYSTEM_PROMPT
        elif mode == "story":
            base = STORY_SYSTEM_PROMPT
        else:
            base = SYSTEM_PROMPT

        context = f"\n\nSTUDENT INFO:\n- CEFR Level: {level}\n- Native language: {native_language}\n- Messages in session: {len(history)}"

        level_instructions = {
            "A1": "\n\nLEVEL A1 (Beginner): Use very simple English. Short sentences (5-8 words). Basic vocabulary. Present tense mainly.",
            "A2": "\n\nLEVEL A2 (Elementary): Simple sentences. Common expressions. Past tense, future with 'going to'. Daily routine vocabulary.",
            "B1": "\n\nLEVEL B1 (Intermediate): Natural English. Idioms and phrasal verbs. All major tenses. Abstract topics.",
            "B2": "\n\nLEVEL B2 (Upper Intermediate): Sophisticated English. Complex grammar. Academic vocabulary. Nuanced expressions.",
            "C1": "\n\nLEVEL C1 (Advanced): Near-native English. Subtle distinctions. Formal/informal registers. Literary vocabulary.",
            "C2": "\n\nLEVEL C2 (Proficient): Native-level. Focus on style, elegance, precision. Rare vocabulary.",
        }
        context += level_instructions.get(level, level_instructions["A1"])

        if len(history) > 0:
            context += f"\n\nThis is message #{len(history)+1}. Do NOT repeat topics or exercises from earlier."

        return base + context

    def _build_messages(self, system: str, history: List[Dict], current_message: str) -> List[Dict]:
        """Build messages array for OpenAI API."""
        messages = [{"role": "system", "content": system}]

        for msg in history[-10:]:
            role = "user" if msg["role"] == "user" else "assistant"
            messages.append({"role": role, "content": msg["message"]})

        messages.append({"role": "user", "content": current_message})
        return messages

    def _parse_response(self, content: str) -> Dict:
        """Parse GPT's JSON response."""
        content = content.strip()

        if content.startswith("```json"):
            content = content[7:]
        elif content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
        content = content.strip()

        try:
            parsed = json.loads(content)
            # Clean: if reply contains the JSON itself, extract just the text part
            reply = parsed.get("reply", "")
            if "{" in reply and '"reply"' in reply:
                # The reply accidentally contains JSON — extract text before the JSON
                json_start = reply.find("{")
                if json_start > 0:
                    parsed["reply"] = reply[:json_start].strip()
                else:
                    # Entire reply is JSON, try to parse it again
                    try:
                        inner = json.loads(reply)
                        if isinstance(inner, dict) and "reply" in inner:
                            parsed["reply"] = inner["reply"]
                    except:
                        pass
            return parsed
        except json.JSONDecodeError:
            # If the content has JSON embedded after some text
            # Try to find JSON in the response
            json_start = content.find("{")
            json_end = content.rfind("}") + 1
            if json_start >= 0 and json_end > json_start:
                try:
                    parsed = json.loads(content[json_start:json_end])
                    return parsed
                except:
                    pass
            
            # Last resort — return raw text as reply
            return {
                "reply": content,
                "corrections": [],
                "new_words": [],
                "pronunciation_tip": None,
                "follow_up": None,
                "xp_earned": 5,
                "encouragement": "",
            }
