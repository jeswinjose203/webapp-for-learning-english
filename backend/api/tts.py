from fastapi import APIRouter, Header, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from openai import OpenAI
from config import settings
from database.connection import get_db
from services.usage_tracker import track_tts_usage
import io

router = APIRouter()


class TTSRequest(BaseModel):
    text: str
    voice: str = ""
    speed: float = 1.0


@router.post("/speak")
def text_to_speech(data: TTSRequest, student_id: int = Header(None, alias="X-Student-ID"), db: Session = Depends(get_db)):
    """Convert text to speech using OpenAI TTS. Returns audio/mpeg stream."""
    client = OpenAI(api_key=settings.openai_api_key)

    voice = data.voice or settings.tts_voice
    valid_voices = ["alloy", "echo", "fable", "nova", "onyx", "shimmer"]
    if voice not in valid_voices:
        voice = "nova"

    speed = max(0.25, min(4.0, data.speed))

    try:
        response = client.audio.speech.create(
            model=settings.tts_model,
            voice=voice,
            input=data.text,
            speed=speed,
        )

        # Track TTS usage
        if student_id and db:
            track_tts_usage(
                db=db,
                student_id=student_id,
                model=settings.tts_model,
                characters=len(data.text),
            )
            db.commit()

        audio_bytes = io.BytesIO(response.content)
        return StreamingResponse(
            audio_bytes,
            media_type="audio/mpeg",
            headers={"Content-Disposition": "inline; filename=speech.mp3"},
        )

    except Exception as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail=f"TTS failed: {str(e)}")


@router.get("/voices")
def get_available_voices():
    """Get list of available OpenAI TTS voices."""
    return {
        "voices": [
            {"id": "alloy", "name": "Alloy", "description": "Neutral, balanced"},
            {"id": "echo", "name": "Echo", "description": "Male, warm"},
            {"id": "fable", "name": "Fable", "description": "British, narrative"},
            {"id": "nova", "name": "Nova", "description": "Female, friendly"},
            {"id": "onyx", "name": "Onyx", "description": "Male, deep"},
            {"id": "shimmer", "name": "Shimmer", "description": "Female, expressive"},
        ],
        "current_default": settings.tts_voice,
    }
