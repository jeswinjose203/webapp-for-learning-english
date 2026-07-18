from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Text, JSON, Date
from sqlalchemy.sql import func
from database.connection import Base


class Student(Base):
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False, unique=True)
    pin = Column(String(4), nullable=False, default="0000")
    native_language = Column(String(50), default="unknown")
    current_level = Column(String(10), default="A1")
    grammar_score = Column(Float, default=0.0)
    vocabulary_score = Column(Float, default=0.0)
    speaking_score = Column(Float, default=0.0)
    listening_score = Column(Float, default=0.0)
    pronunciation_score = Column(Float, default=0.0)
    confidence_score = Column(Float, default=0.0)
    overall_score = Column(Float, default=0.0)
    weaknesses = Column(JSON, default=list)
    xp_total = Column(Integer, default=0)
    xp_today = Column(Integer, default=0)
    streak_days = Column(Integer, default=0)
    last_active_date = Column(Date, nullable=True)
    achievements = Column(JSON, default=list)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class VocabularyWord(Base):
    __tablename__ = "vocabulary_words"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, nullable=False, index=True)
    word = Column(String(100), nullable=False)
    meaning = Column(Text)
    example_sentence = Column(Text)
    difficulty_level = Column(String(10), default="A1")
    is_known = Column(Boolean, default=False)
    mastery_count = Column(Integer, default=0)
    times_tested = Column(Integer, default=0)
    times_correct = Column(Integer, default=0)
    next_review_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())


class GrammarMistake(Base):
    __tablename__ = "grammar_mistakes"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, nullable=False, index=True)
    original_text = Column(Text, nullable=False)
    corrected_text = Column(Text, nullable=False)
    error_type = Column(String(50))
    explanation = Column(Text)
    times_made = Column(Integer, default=1)
    is_resolved = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())


class ConversationHistory(Base):
    __tablename__ = "conversation_history"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, nullable=False, index=True)
    role = Column(String(10), nullable=False)
    message = Column(Text, nullable=False)
    corrections = Column(JSON, nullable=True)
    topic = Column(String(100), nullable=True)
    mode = Column(String(20), default="chat")
    created_at = Column(DateTime, server_default=func.now())


class ProgressRecord(Base):
    __tablename__ = "progress_records"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, nullable=False, index=True)
    grammar_score = Column(Float, default=0.0)
    vocabulary_score = Column(Float, default=0.0)
    speaking_score = Column(Float, default=0.0)
    listening_score = Column(Float, default=0.0)
    pronunciation_score = Column(Float, default=0.0)
    confidence_score = Column(Float, default=0.0)
    overall_score = Column(Float, default=0.0)
    xp_earned = Column(Integer, default=0)
    lessons_completed = Column(Integer, default=0)
    words_learned = Column(Integer, default=0)
    mistakes_fixed = Column(Integer, default=0)
    recorded_at = Column(DateTime, server_default=func.now())


class Lesson(Base):
    __tablename__ = "lessons"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, nullable=False, index=True)
    title = Column(String(200), nullable=False)
    lesson_type = Column(String(50))
    content = Column(JSON, nullable=False)
    difficulty_level = Column(String(10), default="A1")
    is_completed = Column(Boolean, default=False)
    score = Column(Float, nullable=True)
    xp_earned = Column(Integer, default=0)
    created_at = Column(DateTime, server_default=func.now())
    completed_at = Column(DateTime, nullable=True)


class Story(Base):
    __tablename__ = "stories"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, nullable=False, index=True)
    title = Column(String(200), default="Untitled Story")
    sentences = Column(JSON, default=list)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())


class ApiUsage(Base):
    __tablename__ = "api_usage"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, nullable=False, index=True)
    provider = Column(String(20), nullable=False)  # "openai" or "anthropic"
    model = Column(String(50), nullable=False)
    feature = Column(String(50), nullable=False)  # "chat", "lesson", "debate", "tts"
    input_tokens = Column(Integer, default=0)
    output_tokens = Column(Integer, default=0)
    total_tokens = Column(Integer, default=0)
    cost_usd = Column(Float, default=0.0)
    tts_characters = Column(Integer, default=0)
    created_at = Column(DateTime, server_default=func.now())
