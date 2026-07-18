import random
from typing import Dict, List, Optional


# Conversation topics with templates
TOPICS = {
    "greeting": {
        "starters": [
            "Hello! How are you today?",
            "Hi there! What's new with you?",
            "Good to see you! How has your day been?",
        ],
        "follow_ups": [
            "That's great! Tell me more about your day.",
            "Interesting! What else have you been doing?",
            "Nice! Do you have any plans for later?",
        ],
    },
    "work": {
        "starters": [
            "Let's talk about work. What do you do for a living?",
            "Tell me about your job. What's a typical day like?",
            "Do you enjoy your work? What do you like about it?",
        ],
        "follow_ups": [
            "That sounds interesting! How long have you been doing that?",
            "Do you work with a team or alone?",
            "What's the most challenging part of your job?",
        ],
    },
    "hobbies": {
        "starters": [
            "What do you like to do in your free time?",
            "Do you have any hobbies? Tell me about them.",
            "What's something fun you did recently?",
        ],
        "follow_ups": [
            "How often do you do that?",
            "When did you start? What got you interested?",
            "Do your friends enjoy that too?",
        ],
    },
    "food": {
        "starters": [
            "Let's talk about food! What's your favorite meal?",
            "Do you like cooking? What do you usually make?",
            "What did you eat today?",
        ],
        "follow_ups": [
            "That sounds delicious! Can you describe how it tastes?",
            "Do you prefer home food or restaurant food?",
            "Have you tried any new foods recently?",
        ],
    },
    "travel": {
        "starters": [
            "Have you traveled anywhere interesting?",
            "If you could go anywhere, where would you go?",
            "What's your favorite place you've visited?",
        ],
        "follow_ups": [
            "What did you like most about that place?",
            "How long did you stay there?",
            "Would you go back again? Why?",
        ],
    },
    "daily_routine": {
        "starters": [
            "Tell me about your daily routine. What time do you wake up?",
            "What do you usually do in the morning?",
            "How do you spend your evenings?",
        ],
        "follow_ups": [
            "That's a good routine! Do you do the same thing every day?",
            "What time do you usually go to bed?",
            "Do you prefer mornings or evenings?",
        ],
    },
}

# Encouragement responses
ENCOURAGEMENTS = [
    "Great job! ",
    "Well said! ",
    "Nice! ",
    "Good effort! ",
    "You're doing well! ",
    "Keep it up! ",
]

# Correction templates
CORRECTION_TEMPLATES = [
    'Try saying: "{corrected}"',
    'A better way: "{corrected}"',
    'You could say: "{corrected}"',
    'More natural: "{corrected}"',
]


class ConversationEngine:
    """
    Manages dialogue flow with the user.
    Uses topic-based templates, provides corrections inline,
    and generates follow-up questions to keep conversation going.
    """

    def __init__(self):
        self.topics = TOPICS
        self.current_topic = None

    def generate_response(
        self,
        user_message: str,
        corrections: List[Dict],
        student_level: str = "A1",
        history: Optional[List[Dict]] = None,
    ) -> Dict:
        """
        Generate a conversational response based on user input.
        Includes corrections inline and asks follow-up questions.
        """
        if history is None:
            history = []

        reply_parts = []

        # If there are corrections, provide them gently
        if corrections:
            encouragement = random.choice(ENCOURAGEMENTS)
            reply_parts.append(encouragement)

            # Show the most important correction
            main_correction = corrections[0]
            template = random.choice(CORRECTION_TEMPLATES)
            correction_text = template.format(corrected=main_correction["corrected"])
            reply_parts.append(correction_text)
            reply_parts.append("")  # blank line

        # Determine topic from context
        topic = self._detect_topic(user_message, history)

        # Generate a response to what the user said
        content_reply = self._generate_content_reply(user_message, topic, history)
        reply_parts.append(content_reply)

        # Generate follow-up question
        follow_up = self._get_follow_up(topic, history)

        full_reply = "\n".join(reply_parts)

        return {
            "reply": full_reply,
            "follow_up": follow_up,
            "topic": topic,
        }

    def start_conversation(self, topic: str = None) -> Dict:
        """Start a new conversation with a topic."""
        if topic is None:
            topic = random.choice(list(self.topics.keys()))

        self.current_topic = topic
        starter = random.choice(self.topics[topic]["starters"])

        return {
            "reply": starter,
            "topic": topic,
            "follow_up": None,
        }

    def _detect_topic(self, message: str, history: List[Dict]) -> str:
        """Simple keyword-based topic detection."""
        message_lower = message.lower()

        topic_keywords = {
            "work": ["work", "job", "office", "company", "boss", "colleague", "meeting", "project"],
            "food": ["food", "eat", "cook", "restaurant", "lunch", "dinner", "breakfast", "hungry"],
            "travel": ["travel", "trip", "vacation", "visit", "country", "city", "fly", "hotel"],
            "hobbies": ["hobby", "fun", "play", "game", "sport", "music", "movie", "read", "watch"],
            "daily_routine": ["morning", "evening", "wake", "sleep", "routine", "usually", "always", "every day"],
            "greeting": ["hello", "hi", "hey", "how are you", "good morning", "good evening"],
        }

        for topic, keywords in topic_keywords.items():
            for keyword in keywords:
                if keyword in message_lower:
                    return topic

        # Default to greeting if no topic detected
        if not history:
            return "greeting"

        # Continue with previous topic if in conversation
        return self.current_topic or "greeting"

    def _generate_content_reply(self, message: str, topic: str, history: List[Dict]) -> str:
        """Generate a reply based on what the user said."""
        message_lower = message.lower()

        # Simple response logic based on common patterns
        if any(w in message_lower for w in ["how are you", "how about you"]):
            return random.choice([
                "I'm doing great, thank you for asking!",
                "I'm good! I'm happy to practice English with you.",
                "Doing well! Let's keep chatting.",
            ])

        if any(w in message_lower for w in ["yes", "yeah", "yep", "sure"]):
            return random.choice([
                "That's good to hear!",
                "Wonderful!",
                "Great!",
            ])

        if any(w in message_lower for w in ["no", "nope", "not really"]):
            return random.choice([
                "That's okay! Let's try something else.",
                "No problem! We can talk about something different.",
                "Alright! What would you like to talk about instead?",
            ])

        if any(w in message_lower for w in ["i don't know", "i'm not sure", "maybe"]):
            return random.choice([
                "That's fine! Take your time.",
                "No worries! Let me help you.",
                "It's okay to be unsure. Let's work through it.",
            ])

        # Generic acknowledgment
        acknowledgments = [
            "I understand! That's interesting.",
            "Thanks for sharing that with me!",
            "That's a good answer!",
            "I see! Tell me more.",
            "Nice! I'd like to hear more about that.",
        ]
        return random.choice(acknowledgments)

    def _get_follow_up(self, topic: str, history: List[Dict]) -> str:
        """Get a follow-up question for the current topic."""
        if topic in self.topics:
            return random.choice(self.topics[topic]["follow_ups"])

        # Fallback follow-ups
        fallbacks = [
            "Can you tell me more?",
            "What else would you like to talk about?",
            "Is there anything else on your mind?",
        ]
        return random.choice(fallbacks)
