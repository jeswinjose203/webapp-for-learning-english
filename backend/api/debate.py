from fastapi import APIRouter, Depends, Header
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from openai import OpenAI
from config import settings
from database.connection import get_db
from services.usage_tracker import track_chat_usage, track_tts_usage
import json
import random

router = APIRouter()


DEBATERS = {
    "professor": {
        "name": "Prof. Williams",
        "avatar": "🎓",
        "personality": "Academic professor. Uses data, research, and statistics. Formal tone. Cites studies. Rarely interrupted — commands respect.",
        "style": "measured, authoritative, evidence-based",
        "provider": "openai",
        "model": "gpt-4o-mini",
        "voice": "onyx",
    },
    "journalist": {
        "name": "Sarah Chen",
        "avatar": "📰",
        "personality": "Investigative journalist. Real-world examples and stories. Asks tough questions. Passionate and direct. Interrupts when someone says something factually wrong.",
        "style": "sharp, questioning, story-driven",
        "provider": "openai",
        "model": "gpt-4o-mini",
        "voice": "nova",
    },
    "philosopher": {
        "name": "Dr. Marcus",
        "avatar": "🤔",
        "personality": "Philosopher. Questions assumptions. Uses analogies and thought experiments. Calm and reflective. Rarely interrupts but asks deep questions that silence everyone.",
        "style": "calm, reflective, deep questions",
        "provider": "openai",
        "model": "gpt-4o-mini",
        "voice": "fable",
    },
    "activist": {
        "name": "Zara Khan",
        "avatar": "✊",
        "personality": "Social activist. Emotional, appeals to morality and justice. Personal stories. Fiery. Will interrupt passionately when someone dismisses human suffering.",
        "style": "passionate, moral, interrupts when angry",
        "provider": "openai",
        "model": "gpt-4o-mini",
        "voice": "shimmer",
    },
    "businessman": {
        "name": "Robert Sterling",
        "avatar": "💼",
        "personality": "CEO. Pragmatic, numbers-focused. Efficiency over emotion. Will interrupt to say 'but who's paying for that?' Dismissive of idealism.",
        "style": "pragmatic, blunt, money-focused",
        "provider": "openai",
        "model": "gpt-4o-mini",
        "voice": "echo",
    },
    "comedian": {
        "name": "Dave Murphy",
        "avatar": "😂",
        "personality": "Comedian-commentator. Uses humor and satire. Diffuses tension. Interrupts with jokes. Makes everyone laugh but actually makes the best points through humor.",
        "style": "funny, sarcastic, surprising insights",
        "provider": "openai",
        "model": "gpt-4o-mini",
        "voice": "alloy",
    },
    "scientist": {
        "name": "Dr. Elena Rossi",
        "avatar": "🔬",
        "personality": "Research scientist. Evidence-based. Skeptical. Will interrupt to say 'that's not what the data shows'. Frustrated by emotional arguments without evidence.",
        "style": "precise, skeptical, data-driven",
        "provider": "claude",
        "model": "claude-sonnet-4-20250514",
        "voice": "shimmer",
    },
    "historian": {
        "name": "Prof. Okafor",
        "avatar": "📜",
        "personality": "Historian. Draws parallels from history. 'We've seen this before in 1920...' Deep storyteller. Interrupts when someone ignores historical context.",
        "style": "narrative, historical parallels, wise",
        "provider": "claude",
        "model": "claude-sonnet-4-20250514",
        "voice": "fable",
    },
    "teenager": {
        "name": "Alex Rivera",
        "avatar": "🧑‍💻",
        "personality": "Gen-Z teenager. Casual, modern slang. Digital native. Interrupts elders with 'OK but that's outdated thinking'. Surprisingly insightful despite seeming dismissive.",
        "style": "casual, modern, challenges assumptions",
        "provider": "openai",
        "model": "gpt-4o-mini",
        "voice": "alloy",
    },
    "grandma": {
        "name": "Nana Rose",
        "avatar": "👵",
        "personality": "Wise grandmother. Life experience. Proverbs. Warm but firm. Interrupts gently: 'Now dear, let me tell you what I've learned...' Everyone listens to her.",
        "style": "warm, wise, life stories",
        "provider": "claude",
        "model": "claude-sonnet-4-20250514",
        "voice": "nova",
    },
    "lawyer": {
        "name": "Attorney James Park",
        "avatar": "⚖️",
        "personality": "Trial lawyer. Logical, structured. 'Objection!' Finds holes in arguments. Cross-examines others. Interrupts to point out logical fallacies.",
        "style": "logical, cross-examining, finds flaws",
        "provider": "openai",
        "model": "gpt-4o-mini",
        "voice": "onyx",
    },
    "artist": {
        "name": "Luna Frost",
        "avatar": "🎨",
        "personality": "Artist and poet. Creative lens. Metaphors and imagery. Emotional. Interrupts with beautiful analogies that reframe the whole debate.",
        "style": "poetic, emotional, reframes debates",
        "provider": "claude",
        "model": "claude-sonnet-4-20250514",
        "voice": "shimmer",
    },
}


class DebateStartRequest(BaseModel):
    topic: str
    num_debaters: int = 3
    debater_ids: Optional[List[str]] = None
    duration_minutes: int = 5  # How long the debate should feel


class DebateNextRequest(BaseModel):
    topic: str
    debater_ids: List[str]
    history: List[dict]  # [{name, message, debater_id}]
    turn_count: int


class UserJoinRequest(BaseModel):
    topic: str
    message: str
    debate_history: List[dict]
    debater_ids: List[str]



def call_ai(debater: dict, system_prompt: str, user_prompt: str, db=None, student_id=None) -> str:
    """Call appropriate AI provider with usage tracking."""
    provider = debater.get("provider", "openai")
    if provider == "claude":
        return call_claude(debater, system_prompt, user_prompt, db, student_id)
    return call_openai(debater, system_prompt, user_prompt, db, student_id)


def call_openai(debater: dict, system_prompt: str, user_prompt: str, db=None, student_id=None) -> str:
    client = OpenAI(api_key=settings.openai_api_key)
    try:
        response = client.chat.completions.create(
            model=debater.get("model", "gpt-4o-mini"),
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            max_tokens=200,
            temperature=1.0,
            response_format={"type": "json_object"},
        )
        # Track usage
        if db and student_id and response.usage:
            track_chat_usage(db=db, student_id=student_id, provider="openai", model=debater.get("model", "gpt-4o-mini"), feature="debate", input_tokens=response.usage.prompt_tokens, output_tokens=response.usage.completion_tokens)
            db.commit()
        parsed = json.loads(response.choices[0].message.content)
        return parsed.get("message", "I have something to say about this.")
    except:
        return "Let me think about that differently."


def call_claude(debater: dict, system_prompt: str, user_prompt: str, db=None, student_id=None) -> str:
    try:
        import anthropic
        client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
        response = client.messages.create(
            model=debater.get("model", "claude-sonnet-4-20250514"),
            max_tokens=200,
            system=system_prompt + '\n\nRespond ONLY in JSON: {"message": "your statement"}',
            messages=[{"role": "user", "content": user_prompt}],
        )
        content = response.content[0].text.strip()
        if content.startswith("```"): content = content.split("\n", 1)[1] if "\n" in content else content[3:]
        if content.endswith("```"): content = content[:-3]
        parsed = json.loads(content.strip())
        # Track usage
        if db and student_id and response.usage:
            track_chat_usage(db=db, student_id=student_id, provider="anthropic", model=debater.get("model", "claude-sonnet-4-20250514"), feature="debate", input_tokens=response.usage.input_tokens, output_tokens=response.usage.output_tokens)
            db.commit()
        return parsed.get("message", "I see this differently.")
    except:
        return call_openai(debater, system_prompt, user_prompt, db, student_id)


@router.get("/characters")
def get_debaters():
    return {
        "debaters": [
            {"id": key, "name": val["name"], "avatar": val["avatar"], "personality": val["personality"], "voice": val["voice"], "provider": val["provider"], "style": val["style"]}
            for key, val in DEBATERS.items()
        ]
    }


@router.post("/start")
def start_debate(data: DebateStartRequest):
    """Start a realistic debate. Returns selected debaters with positions."""
    available = list(DEBATERS.keys())
    num = min(max(2, data.num_debaters), 6)

    if data.debater_ids and len(data.debater_ids) >= num:
        selected_ids = data.debater_ids[:num]
    else:
        selected_ids = random.sample(available, num)

    # Assign natural positions (not rigid FOR/AGAINST — more nuanced)
    positions = [
        "strongly supports this idea",
        "strongly opposes this idea",
        "sees both sides but leans against",
        "supports with conditions",
        "skeptical but open-minded",
        "has a completely unique angle",
    ]

    debaters = []
    for i, did in enumerate(selected_ids):
        if did in DEBATERS:
            debaters.append({
                "id": did,
                **DEBATERS[did],
                "position": positions[i % len(positions)],
            })

    return {"topic": data.topic, "debaters": debaters}


@router.post("/next-turn")
def next_turn(data: DebateNextRequest, student_id: int = Header(None, alias="X-Student-ID"), db: Session = Depends(get_db)):
    """
    Get the next speaker in the debate.
    The AI decides WHO speaks next and WHAT they say — including interruptions.
    """
    # First, decide who speaks next (could be interruption)
    speaker_id = _decide_next_speaker(data.topic, data.debater_ids, data.history, data.turn_count)

    if speaker_id not in DEBATERS:
        speaker_id = random.choice(data.debater_ids)

    debater = DEBATERS[speaker_id]

    # Build full debate context
    debate_transcript = "\n".join([
        f"{msg.get('name', 'Unknown')}: \"{msg.get('message', '')}\""
        for msg in data.history[-12:]  # Last 12 messages for context
    ])

    last_speaker = data.history[-1].get("name", "") if data.history else ""
    turn = data.turn_count

    system_prompt = f"""You are {debater['name']} in a live debate.
Your personality: {debater['personality']}
Your speaking style: {debater['style']}
Your position on the topic: {debater.get('position', 'has strong opinions')}

RULES FOR REALISTIC DEBATE:
1. You MUST respond to what was just said — don't ignore others
2. You can AGREE with someone ("I agree with Sarah, but...")
3. You can CHALLENGE ("That's simply not true because...")
4. You can BUILD on someone's point ("Adding to what Prof said...")
5. You can ask a QUESTION to another debater ("Robert, how do you explain...?")
6. Keep it to 1-3 sentences. Real debates are quick exchanges, not speeches.
7. Show emotion — get heated, laugh, be sarcastic, be moved
8. Speak at B1-B2 English level for language learners
{"9. This is the FIRST exchange — introduce your position clearly. Do NOT interrupt or say things like 'I need to jump in' since the debate just started." if turn <= 1 else "9. You can INTERRUPT if you feel strongly ('Sorry but I need to jump in here—')"}"""

    # Determine if this is an interruption
    is_interruption = _should_interrupt(debater, data.history)

    if turn <= 1:
        history_text = "No one has spoken yet." if not data.history else f"Debate so far:\n{debate_transcript}"
        user_prompt = f"""Debate topic: "{data.topic}"

{history_text}

This is exchange #{turn}. State your opening position on the topic clearly.

Respond in JSON: {{"message": "your opening statement (1-3 sentences)"}}"""
    else:
        user_prompt = f"""Debate topic: "{data.topic}"

Debate so far:
{debate_transcript}

The last person who spoke was {last_speaker}. This is exchange #{turn}.
{"You feel strongly about what was just said and want to INTERRUPT." if is_interruption else "It's your turn to respond."}

Respond in JSON: {{"message": "your response (1-3 sentences, natural and reactive)"}}"""

    message = call_ai(debater, system_prompt, user_prompt, db, student_id)

    # Check if debate should end
    should_end = _should_conclude(data.history, data.turn_count, len(data.debater_ids))

    return {
        "debater_id": speaker_id,
        "debater_name": debater["name"],
        "avatar": debater["avatar"],
        "message": message,
        "voice": debater["voice"],
        "is_interruption": is_interruption,
        "should_end": should_end,
    }


@router.post("/conclude")
def conclude_debate(data: DebateNextRequest, student_id: int = Header(None, alias="X-Student-ID"), db: Session = Depends(get_db)):
    """A debater gives a closing thought. Called multiple times for different debaters."""
    # Pick a debater who hasn't concluded yet (track via history — concluders have short messages at the end)
    recent_speakers = [msg.get("debater_id") for msg in data.history[-5:]]
    
    # Prefer calm debaters for conclusions, but allow anyone
    calm_debaters = [did for did in data.debater_ids if did in ["philosopher", "professor", "grandma", "historian", "scientist", "artist"] and did not in recent_speakers]
    other_debaters = [did for did in data.debater_ids if did not in recent_speakers]
    
    if calm_debaters:
        closer_id = random.choice(calm_debaters)
    elif other_debaters:
        closer_id = random.choice(other_debaters)
    else:
        closer_id = random.choice(data.debater_ids)
    
    debater = DEBATERS[closer_id]

    debate_transcript = "\n".join([
        f"{msg.get('name', 'Unknown')}: \"{msg.get('message', '')}\""
        for msg in data.history[-10:]
    ])

    system_prompt = f"""You are {debater['name']}. {debater['personality']}
The debate is wrapping up. Give a brief, natural closing thought. You can:
- Summarize your position in one sentence
- Acknowledge a good point someone else made
- End with a thought-provoking question for the audience
- Agree to disagree on something
Keep it to 1-2 sentences. Be natural, not formal."""

    user_prompt = f"""Topic: "{data.topic}"

Recent exchanges:
{debate_transcript}

Give your final thought to close out this debate naturally.

Respond in JSON: {{"message": "your closing thought"}}"""

    message = call_ai(debater, system_prompt, user_prompt, db, student_id)

    return {
        "debater_id": closer_id,
        "debater_name": debater["name"],
        "avatar": debater["avatar"],
        "message": message,
        "voice": debater["voice"],
    }


@router.post("/user-join")
def user_join_debate(data: UserJoinRequest, student_id: int = Header(None, alias="X-Student-ID"), db: Session = Depends(get_db)):
    """User joins. A relevant debater responds to them."""
    # Pick the debater most likely to respond based on context
    responder_id = _pick_responder(data.message, data.debater_ids, data.debate_history)
    debater = DEBATERS.get(responder_id, DEBATERS[data.debater_ids[0]])

    debate_context = "\n".join([
        f"{msg.get('name', 'Someone')}: \"{msg.get('message', '')}\""
        for msg in data.debate_history[-6:]
    ])

    system_prompt = f"You are {debater['name']} in a debate. {debater['personality']} A student just joined the debate. Respond to their argument, and if they made English mistakes, correct them gently while also arguing your point."

    user_prompt = f"""Topic: "{data.topic}"

Recent debate:
{debate_context}

The student says: "{data.message}"

Respond to their argument AND correct any grammar mistakes.
Respond in JSON: {{"message": "your response", "corrections": [{{"original": "...", "corrected": "...", "explanation": "..."}}]}}"""

    try:
        if debater["provider"] == "openai":
            client = OpenAI(api_key=settings.openai_api_key)
            response = client.chat.completions.create(
                model=debater["model"],
                messages=[{"role": "system", "content": system_prompt}, {"role": "user", "content": user_prompt}],
                max_tokens=250, temperature=0.9, response_format={"type": "json_object"},
            )
            parsed = json.loads(response.choices[0].message.content)
        else:
            import anthropic
            client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
            response = client.messages.create(
                model=debater["model"], max_tokens=250,
                system=system_prompt + '\nRespond in JSON: {"message": "...", "corrections": [...]}',
                messages=[{"role": "user", "content": user_prompt}],
            )
            content = response.content[0].text.strip()
            if content.startswith("```"): content = content.split("\n", 1)[1]
            if content.endswith("```"): content = content[:-3]
            parsed = json.loads(content.strip())

        message = parsed.get("message", "Interesting point!")
        corrections = parsed.get("corrections", [])
    except:
        message = "That's a thought-provoking point. Let me respond to that."
        corrections = []

    return {
        "debater_id": responder_id,
        "debater_name": debater["name"],
        "avatar": debater["avatar"],
        "message": message,
        "voice": debater["voice"],
        "corrections": corrections,
    }


def _decide_next_speaker(topic: str, debater_ids: List[str], history: List[dict], turn: int) -> str:
    """Decide who speaks next — avoids same person twice in a row, favors those who haven't spoken recently."""
    if not history:
        return random.choice(debater_ids)

    # Don't let same person speak twice in a row
    last_speaker_id = history[-1].get("debater_id", "")

    # Count recent appearances (last 4 messages)
    recent_speakers = [msg.get("debater_id") for msg in history[-4:]]
    candidates = [did for did in debater_ids if did != last_speaker_id]

    # Prefer those who haven't spoken recently
    quiet_ones = [did for did in candidates if did not in recent_speakers]
    if quiet_ones:
        return random.choice(quiet_ones)

    return random.choice(candidates) if candidates else random.choice(debater_ids)


def _should_interrupt(debater: dict, history: List[dict]) -> bool:
    """Determine if this debater would interrupt. NEVER on first message."""
    if not history or len(history) < 2:
        return False

    # Characters more likely to interrupt
    interrupt_prone = ["activist", "journalist", "comedian", "teenager", "lawyer"]
    debater_id = next((k for k, v in DEBATERS.items() if v["name"] == debater["name"]), "")

    if debater_id in interrupt_prone:
        return random.random() < 0.35  # 35% chance

    return random.random() < 0.10  # 10% for calm characters


def _should_conclude(history: List[dict], turn_count: int, num_debaters: int) -> bool:
    """Determine if the debate should conclude."""
    min_turns = num_debaters * 3  # At least 3 exchanges per person
    max_turns = num_debaters * 6  # Max 6 exchanges per person

    if turn_count < min_turns:
        return False
    if turn_count >= max_turns:
        return True

    # After minimum, 20% chance each turn to suggest conclusion
    return random.random() < 0.20


def _pick_responder(user_message: str, debater_ids: List[str], history: List[dict]) -> str:
    """Pick the most relevant debater to respond to the user."""
    # Simple: pick one who hasn't spoken recently
    recent = [msg.get("debater_id") for msg in history[-3:]]
    candidates = [did for did in debater_ids if did not in recent]
    if candidates:
        return random.choice(candidates)
    return random.choice(debater_ids)
