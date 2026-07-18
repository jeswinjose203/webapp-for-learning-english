from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from database.connection import get_db
from database.models import Student

router = APIRouter()


class RegisterRequest(BaseModel):
    name: str
    pin: str  # 4-digit PIN


class LoginRequest(BaseModel):
    name: str
    pin: str


class StudentResponse(BaseModel):
    id: int
    name: str
    native_language: str
    current_level: str
    grammar_score: float
    vocabulary_score: float
    speaking_score: float
    listening_score: float
    pronunciation_score: float
    confidence_score: float
    overall_score: float
    weaknesses: list
    xp_total: int
    xp_today: int
    streak_days: int
    achievements: list

    class Config:
        from_attributes = True


class StudentUpdate(BaseModel):
    name: Optional[str] = None
    native_language: Optional[str] = None
    current_level: Optional[str] = None


@router.post("/register", response_model=StudentResponse)
def register(data: RegisterRequest, db: Session = Depends(get_db)):
    """Create a new user with name + PIN."""
    # Validate PIN
    if len(data.pin) != 4 or not data.pin.isdigit():
        raise HTTPException(status_code=400, detail="PIN must be exactly 4 digits")

    if not data.name.strip():
        raise HTTPException(status_code=400, detail="Name cannot be empty")

    # Check if name already exists
    existing = db.query(Student).filter(Student.name == data.name.strip()).first()
    if existing:
        raise HTTPException(status_code=400, detail="This name is already taken. Choose another or login.")

    student = Student(
        name=data.name.strip(),
        pin=data.pin,
        native_language="unknown",
        current_level="A1",
    )
    db.add(student)
    db.commit()
    db.refresh(student)
    return student


@router.post("/login", response_model=StudentResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    """Login with name + PIN. Returns student profile."""
    student = db.query(Student).filter(Student.name == data.name.strip()).first()

    if not student:
        raise HTTPException(status_code=404, detail="User not found. Check your name or register.")

    if student.pin != data.pin:
        raise HTTPException(status_code=401, detail="Wrong PIN. Try again.")

    return student


@router.get("/profile/{student_id}", response_model=StudentResponse)
def get_student_profile(student_id: int, db: Session = Depends(get_db)):
    """Get student profile by ID."""
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    return student


@router.put("/profile/{student_id}", response_model=StudentResponse)
def update_student_profile(student_id: int, data: StudentUpdate, db: Session = Depends(get_db)):
    """Update student profile."""
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    if data.name is not None:
        # Check if new name conflicts
        existing = db.query(Student).filter(Student.name == data.name.strip(), Student.id != student_id).first()
        if existing:
            raise HTTPException(status_code=400, detail="This name is already taken")
        student.name = data.name.strip()
    if data.native_language is not None:
        student.native_language = data.native_language
    if data.current_level is not None:
        student.current_level = data.current_level

    db.commit()
    db.refresh(student)
    return student


@router.get("/list")
def list_users(db: Session = Depends(get_db)):
    """List all registered users (names only, for login screen)."""
    students = db.query(Student).all()
    return [{"id": s.id, "name": s.name, "level": s.current_level} for s in students]
