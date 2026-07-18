from fastapi import APIRouter, Depends, Header
from sqlalchemy.orm import Session
from sqlalchemy import func
from database.connection import get_db
from database.models import ConversationHistory, Lesson, Student, ApiUsage


router = APIRouter()


@router.get("/summary")
def get_usage_summary(student_id: int = Header(..., alias="X-Student-ID"), db: Session = Depends(get_db)):
    """Get usage report with REAL token counts from API responses."""
    student = db.query(Student).filter(Student.id == student_id).first()

    # Messages breakdown
    mode_counts = {}
    all_messages = db.query(ConversationHistory).filter(
        ConversationHistory.student_id == student_id
    ).all()

    total_user_messages = 0
    total_ai_messages = 0

    for msg in all_messages:
        mode = msg.mode or "chat"
        if mode not in mode_counts:
            mode_counts[mode] = {"user": 0, "ai": 0}
        mode_counts[mode][msg.role] += 1
        if msg.role == "user":
            total_user_messages += 1
        else:
            total_ai_messages += 1

    # Real API usage from api_usage table
    usage_records = db.query(ApiUsage).filter(ApiUsage.student_id == student_id).all()

    # Aggregate by provider
    openai_input_tokens = 0
    openai_output_tokens = 0
    openai_cost = 0.0
    claude_input_tokens = 0
    claude_output_tokens = 0
    claude_cost = 0.0
    tts_characters = 0
    tts_cost = 0.0

    by_feature = {}

    for record in usage_records:
        if record.provider == "openai" and record.feature != "tts":
            openai_input_tokens += record.input_tokens
            openai_output_tokens += record.output_tokens
            openai_cost += record.cost_usd
        elif record.provider == "anthropic":
            claude_input_tokens += record.input_tokens
            claude_output_tokens += record.output_tokens
            claude_cost += record.cost_usd
        
        if record.feature == "tts":
            tts_characters += record.tts_characters
            tts_cost += record.cost_usd

        # Track by feature
        feature = record.feature or "other"
        if feature not in by_feature:
            by_feature[feature] = {"calls": 0, "tokens": 0, "cost": 0.0}
        by_feature[feature]["calls"] += 1
        by_feature[feature]["tokens"] += record.total_tokens
        by_feature[feature]["cost"] += record.cost_usd

    total_cost = openai_cost + claude_cost + tts_cost

    # Lessons
    total_lessons = db.query(Lesson).filter(Lesson.student_id == student_id).count()
    completed_lessons = db.query(Lesson).filter(
        Lesson.student_id == student_id, Lesson.is_completed == True
    ).count()

    return {
        "student_name": student.name if student else "Unknown",
        "messages": {
            "total": total_user_messages + total_ai_messages,
            "sent_by_user": total_user_messages,
            "sent_by_ai": total_ai_messages,
            "by_mode": mode_counts,
        },
        "tokens": {
            "openai_input": openai_input_tokens,
            "openai_output": openai_output_tokens,
            "openai_total": openai_input_tokens + openai_output_tokens,
            "claude_input": claude_input_tokens,
            "claude_output": claude_output_tokens,
            "claude_total": claude_input_tokens + claude_output_tokens,
            "total": openai_input_tokens + openai_output_tokens + claude_input_tokens + claude_output_tokens,
        },
        "tts": {
            "characters": tts_characters,
            "cost_usd": round(tts_cost, 6),
        },
        "cost": {
            "openai": {
                "input_usd": round((openai_input_tokens / 1_000_000) * 0.15, 6),
                "output_usd": round((openai_output_tokens / 1_000_000) * 0.60, 6),
                "subtotal_usd": round(openai_cost, 6),
            },
            "claude": {
                "input_usd": round((claude_input_tokens / 1_000_000) * 3.0, 6),
                "output_usd": round((claude_output_tokens / 1_000_000) * 15.0, 6),
                "subtotal_usd": round(claude_cost, 6),
            },
            "tts_usd": round(tts_cost, 6),
            "total_usd": round(total_cost, 4),
            "total_inr": round(total_cost * 84, 2),
        },
        "by_feature": by_feature,
        "pricing_reference": {
            "gpt-4o-mini": "$0.15 input / $0.60 output per 1M tokens",
            "claude-sonnet": "$3.00 input / $15.00 output per 1M tokens",
            "tts-1": "$0.015 per 1K characters",
        },
        "lessons": {
            "generated": total_lessons,
            "completed": completed_lessons,
        },
        "xp": {
            "total": student.xp_total if student else 0,
            "today": student.xp_today if student else 0,
        },
        "streak_days": student.streak_days if student else 0,
        "total_api_calls": len(usage_records),
        "data_source": "real" if len(usage_records) > 0 else "no_data_yet",
    }


@router.get("/all-users")
def get_all_users_usage(db: Session = Depends(get_db)):
    """Admin report: usage across all users with real data."""
    students = db.query(Student).all()

    report = []
    for student in students:
        msg_count = db.query(ConversationHistory).filter(
            ConversationHistory.student_id == student.id
        ).count()

        # Real cost from api_usage table
        total_cost = db.query(func.sum(ApiUsage.cost_usd)).filter(
            ApiUsage.student_id == student.id
        ).scalar() or 0.0

        total_tokens = db.query(func.sum(ApiUsage.total_tokens)).filter(
            ApiUsage.student_id == student.id
        ).scalar() or 0

        api_calls = db.query(ApiUsage).filter(
            ApiUsage.student_id == student.id
        ).count()

        report.append({
            "id": student.id,
            "name": student.name,
            "level": student.current_level,
            "messages": msg_count,
            "api_calls": api_calls,
            "total_tokens": total_tokens,
            "xp": student.xp_total,
            "streak": student.streak_days,
            "cost_usd": round(total_cost, 4),
            "cost_inr": round(total_cost * 84, 2),
        })

    total_cost = sum(u["cost_usd"] for u in report)
    total_tokens = sum(u["total_tokens"] for u in report)
    total_messages = sum(u["messages"] for u in report)

    return {
        "total_users": len(students),
        "total_messages": total_messages,
        "total_api_calls": sum(u["api_calls"] for u in report),
        "total_tokens": total_tokens,
        "total_cost_usd": round(total_cost, 4),
        "total_cost_inr": round(total_cost * 84, 2),
        "users": report,
        "data_source": "real_token_tracking",
    }
