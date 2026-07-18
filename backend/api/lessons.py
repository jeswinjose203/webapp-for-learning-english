from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from database.connection import get_db
from database.models import Lesson, Student
from ai.brain.coordinator import AIBrain
from ai.recommendation.engine import RecommendationEngine
from services.progress_updater import ProgressUpdater

router = APIRouter()


class LessonResponse(BaseModel):
    id: int
    title: str
    lesson_type: Optional[str]
    content: dict
    difficulty_level: str
    is_completed: bool
    score: Optional[float]
    xp_earned: int

    class Config:
        from_attributes = True


class LessonCompleteRequest(BaseModel):
    score: float


@router.get("/today", response_model=LessonResponse)
def get_todays_lesson(student_id: int = Header(..., alias="X-Student-ID"), db: Session = Depends(get_db)):
    """Generate today's personalized lesson."""
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    rec_engine = RecommendationEngine()
    focus = rec_engine.get_daily_focus(
        grammar_score=student.grammar_score,
        vocabulary_score=student.vocabulary_score,
        speaking_score=student.speaking_score,
    )

    brain = AIBrain()
    lesson_content = brain.generate_lesson(
        level=student.current_level,
        weaknesses=student.weaknesses or [],
        focus=focus,
    )

    lesson = Lesson(
        student_id=student_id,
        title=lesson_content.get("title", f"Lesson - {student.current_level}"),
        lesson_type=lesson_content.get("type", "mixed"),
        content=lesson_content,
        difficulty_level=student.current_level,
    )
    db.add(lesson)
    db.commit()
    db.refresh(lesson)
    return lesson


@router.get("/history", response_model=List[LessonResponse])
def get_lesson_history(limit: int = 20, student_id: int = Header(..., alias="X-Student-ID"), db: Session = Depends(get_db)):
    """Get past lessons for this student."""
    lessons = (
        db.query(Lesson)
        .filter(Lesson.student_id == student_id)
        .order_by(Lesson.created_at.desc())
        .limit(limit)
        .all()
    )
    return lessons


@router.post("/{lesson_id}/complete", response_model=LessonResponse)
def complete_lesson(lesson_id: int, data: LessonCompleteRequest, student_id: int = Header(..., alias="X-Student-ID"), db: Session = Depends(get_db)):
    """Mark lesson as completed."""
    lesson = db.query(Lesson).filter(Lesson.id == lesson_id, Lesson.student_id == student_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    lesson.is_completed = True
    lesson.score = data.score
    lesson.completed_at = datetime.utcnow()

    xp = max(10, int(data.score / 2))
    lesson.xp_earned = xp

    student = db.query(Student).filter(Student.id == student_id).first()
    if student:
        student.xp_total += xp
        student.xp_today += xp

    db.commit()
    db.refresh(lesson)

    updater = ProgressUpdater()
    updater.update_all(db, student_id)

    return lesson
