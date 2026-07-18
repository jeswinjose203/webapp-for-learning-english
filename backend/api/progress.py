from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List

from database.connection import get_db
from database.models import Student, ProgressRecord, GrammarMistake, VocabularyWord, Lesson

router = APIRouter()


class ProgressResponse(BaseModel):
    grammar_score: float
    vocabulary_score: float
    speaking_score: float
    listening_score: float
    pronunciation_score: float
    confidence_score: float
    overall_score: float
    current_level: str
    weaknesses: list
    total_words_learned: int
    total_words_tracked: int
    total_lessons_completed: int
    total_mistakes_tracked: int
    mistakes_resolved: int
    xp_total: int
    xp_today: int
    streak_days: int
    achievements: list


class ProgressHistoryItem(BaseModel):
    grammar_score: float
    vocabulary_score: float
    speaking_score: float
    overall_score: float
    xp_earned: int
    recorded_at: str


@router.get("/current", response_model=ProgressResponse)
def get_current_progress(student_id: int = Header(..., alias="X-Student-ID"), db: Session = Depends(get_db)):
    """Get student's current progress."""
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    words_learned = db.query(VocabularyWord).filter(
        VocabularyWord.student_id == student_id, VocabularyWord.is_known == True
    ).count()
    total_words = db.query(VocabularyWord).filter(VocabularyWord.student_id == student_id).count()
    lessons_completed = db.query(Lesson).filter(
        Lesson.student_id == student_id, Lesson.is_completed == True
    ).count()
    total_mistakes = db.query(GrammarMistake).filter(GrammarMistake.student_id == student_id).count()
    resolved_mistakes = db.query(GrammarMistake).filter(
        GrammarMistake.student_id == student_id, GrammarMistake.is_resolved == True
    ).count()

    return ProgressResponse(
        grammar_score=student.grammar_score,
        vocabulary_score=student.vocabulary_score,
        speaking_score=student.speaking_score,
        listening_score=student.listening_score,
        pronunciation_score=student.pronunciation_score,
        confidence_score=student.confidence_score,
        overall_score=student.overall_score,
        current_level=student.current_level,
        weaknesses=student.weaknesses or [],
        total_words_learned=words_learned,
        total_words_tracked=total_words,
        total_lessons_completed=lessons_completed,
        total_mistakes_tracked=total_mistakes,
        mistakes_resolved=resolved_mistakes,
        xp_total=student.xp_total,
        xp_today=student.xp_today,
        streak_days=student.streak_days,
        achievements=student.achievements or [],
    )


@router.get("/history", response_model=List[ProgressHistoryItem])
def get_progress_history(limit: int = 30, student_id: int = Header(..., alias="X-Student-ID"), db: Session = Depends(get_db)):
    """Get progress history for charts."""
    records = (
        db.query(ProgressRecord)
        .filter(ProgressRecord.student_id == student_id)
        .order_by(ProgressRecord.recorded_at.desc())
        .limit(limit)
        .all()
    )
    records.reverse()
    return [
        ProgressHistoryItem(
            grammar_score=r.grammar_score,
            vocabulary_score=r.vocabulary_score,
            speaking_score=r.speaking_score,
            overall_score=r.overall_score,
            xp_earned=r.xp_earned,
            recorded_at=r.recorded_at.isoformat() if r.recorded_at else "",
        )
        for r in records
    ]


@router.get("/weaknesses")
def get_weaknesses(student_id: int = Header(..., alias="X-Student-ID"), db: Session = Depends(get_db)):
    """Get weakness analysis."""
    mistakes = (
        db.query(GrammarMistake)
        .filter(GrammarMistake.student_id == student_id, GrammarMistake.is_resolved == False)
        .order_by(GrammarMistake.times_made.desc())
        .limit(10)
        .all()
    )

    return {
        "grammar_weaknesses": [
            {
                "error_type": m.error_type,
                "example": m.original_text,
                "correction": m.corrected_text,
                "explanation": m.explanation,
                "times_made": m.times_made,
            }
            for m in mistakes
        ]
    }
