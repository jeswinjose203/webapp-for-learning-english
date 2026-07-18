from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import date

from database.connection import get_db
from database.models import ConversationHistory, Student, GrammarMistake
from ai.brain.coordinator import AIBrain
from services.progress_updater import ProgressUpdater
from services.usage_tracker import track_chat_usage

router = APIRouter()


class ChatMessage(BaseModel):
    message: str
    mode: str = "chat"


class CorrectionItem(BaseModel):
    original: str
    corrected: str
    explanation: str
    error_type: str


class ChatResponse(BaseModel):
    reply: str
    corrections: List[CorrectionItem]
    new_words: List[dict]
    pronunciation_tip: Optional[str] = None
    follow_up: Optional[str] = None
    xp_earned: int = 0
    encouragement: Optional[str] = None


def get_student(student_id: int, db: Session) -> Student:
    """Get student or raise 404."""
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found. Please login first.")
    return student


@router.post("/send", response_model=ChatResponse)
def send_message(data: ChatMessage, student_id: int = Header(..., alias="X-Student-ID"), db: Session = Depends(get_db)):
    """Process a user message through Claude AI and update all progress."""
    student = get_student(student_id, db)

    # Get conversation history for this student
    recent_messages = (
        db.query(ConversationHistory)
        .filter(ConversationHistory.student_id == student_id, ConversationHistory.mode == data.mode)
        .order_by(ConversationHistory.created_at.desc())
        .limit(10)
        .all()
    )
    recent_messages.reverse()
    history = [{"role": msg.role, "message": msg.message} for msg in recent_messages]

    # Process through AI Brain (Claude)
    brain = AIBrain()
    result = brain.process(
        user_message=data.message,
        student_level=student.current_level,
        native_language=student.native_language,
        history=history,
        mode=data.mode,
    )

    corrections = result.get("corrections", [])

    # Save user message
    user_msg = ConversationHistory(
        student_id=student_id,
        role="user",
        message=data.message,
        corrections=corrections if corrections else None,
        mode=data.mode,
    )
    db.add(user_msg)

    # Save AI response
    ai_msg = ConversationHistory(
        student_id=student_id,
        role="ai",
        message=result.get("reply", ""),
        mode=data.mode,
    )
    db.add(ai_msg)

    # Track grammar mistakes
    for correction in corrections:
        existing = db.query(GrammarMistake).filter(
            GrammarMistake.student_id == student_id,
            GrammarMistake.original_text == correction.get("original", ""),
            GrammarMistake.is_resolved == False,
        ).first()

        if existing:
            existing.times_made += 1
        else:
            mistake = GrammarMistake(
                student_id=student_id,
                original_text=correction.get("original", ""),
                corrected_text=correction.get("corrected", ""),
                error_type=correction.get("error_type", "unknown"),
                explanation=correction.get("explanation", ""),
            )
            db.add(mistake)

    # If no corrections, check resolved mistakes
    if not corrections:
        _check_resolved_mistakes(db, student_id, data.message)

    # Save new vocabulary words
    updater = ProgressUpdater()
    new_words = result.get("new_words", [])
    if new_words:
        updater.save_new_words(db, student_id, new_words)

    # Track API usage (real token counts)
    usage_data = result.get("_usage")
    if usage_data:
        track_chat_usage(
            db=db,
            student_id=student_id,
            provider=usage_data["provider"],
            model=usage_data["model"],
            feature=data.mode,
            input_tokens=usage_data["input_tokens"],
            output_tokens=usage_data["output_tokens"],
        )

    # Update XP and streak
    xp = result.get("xp_earned", 5)
    if isinstance(xp, str):
        try:
            xp = int(xp)
        except:
            xp = 5
    if not isinstance(xp, int) or xp < 1:
        xp = 5
    if xp > 20:
        xp = 20
    student.xp_total += xp
    student.xp_today += xp

    today = date.today()
    if student.last_active_date != today:
        if student.last_active_date and (today - student.last_active_date).days == 1:
            student.streak_days += 1
        elif student.last_active_date and (today - student.last_active_date).days > 1:
            student.streak_days = 1
        else:
            student.streak_days = 1
        student.last_active_date = today
        student.xp_today = xp

    # Check achievements
    _check_achievements(student, db, student_id)

    db.commit()

    # Recalculate all scores
    updater.update_all(db, student_id)

    print(f"[DEBUG] XP earned this message: {xp}, total: {student.xp_total}")

    return ChatResponse(
        reply=result.get("reply", ""),
        corrections=[CorrectionItem(**c) for c in corrections],
        new_words=new_words,
        pronunciation_tip=result.get("pronunciation_tip"),
        follow_up=result.get("follow_up"),
        xp_earned=xp,
        encouragement=result.get("encouragement"),
    )


@router.get("/history")
def get_chat_history(limit: int = 50, mode: str = "chat", student_id: int = Header(..., alias="X-Student-ID"), db: Session = Depends(get_db)):
    """Get chat history for this student."""
    messages = (
        db.query(ConversationHistory)
        .filter(ConversationHistory.student_id == student_id, ConversationHistory.mode == mode)
        .order_by(ConversationHistory.created_at.desc())
        .limit(limit)
        .all()
    )
    messages.reverse()
    return [
        {
            "id": msg.id,
            "role": msg.role,
            "message": msg.message,
            "corrections": msg.corrections,
            "mode": msg.mode,
            "created_at": msg.created_at.isoformat() if msg.created_at else None,
        }
        for msg in messages
    ]


@router.delete("/history")
def clear_chat_history(mode: str = "chat", student_id: int = Header(..., alias="X-Student-ID"), db: Session = Depends(get_db)):
    """Clear conversation history for this student."""
    db.query(ConversationHistory).filter(
        ConversationHistory.student_id == student_id,
        ConversationHistory.mode == mode,
    ).delete()
    db.commit()
    return {"message": f"Chat history cleared for mode: {mode}"}


def _check_resolved_mistakes(db: Session, student_id: int, message: str):
    """Check if user used correct patterns for previously wrong things."""
    message_lower = message.lower()
    unresolved = db.query(GrammarMistake).filter(
        GrammarMistake.student_id == student_id,
        GrammarMistake.is_resolved == False,
    ).all()

    for mistake in unresolved:
        corrected = mistake.corrected_text.lower()
        if corrected in message_lower:
            mistake.times_made = max(0, mistake.times_made - 1)
            if mistake.times_made <= 0:
                mistake.is_resolved = True


def _check_achievements(student: Student, db: Session, student_id: int):
    """Check and award achievements."""
    achievements = student.achievements or []
    new_achievements = []

    msg_count = db.query(ConversationHistory).filter(
        ConversationHistory.student_id == student_id,
        ConversationHistory.role == "user",
    ).count()

    checks = [
        ("first_message", msg_count >= 1),
        ("ten_messages", msg_count >= 10),
        ("fifty_messages", msg_count >= 50),
        ("hundred_messages", msg_count >= 100),
        ("xp_100", student.xp_total >= 100),
        ("xp_500", student.xp_total >= 500),
        ("xp_1000", student.xp_total >= 1000),
        ("streak_3", student.streak_days >= 3),
        ("streak_7", student.streak_days >= 7),
        ("streak_14", student.streak_days >= 14),
        ("streak_30", student.streak_days >= 30),
    ]

    for achievement_id, condition in checks:
        if condition and achievement_id not in achievements:
            new_achievements.append(achievement_id)

    level_achievements = {"A2": "level_a2", "B1": "level_b1", "B2": "level_b2", "C1": "level_c1", "C2": "level_c2"}
    level_ach = level_achievements.get(student.current_level)
    if level_ach and level_ach not in achievements:
        new_achievements.append(level_ach)

    if new_achievements:
        student.achievements = achievements + new_achievements
