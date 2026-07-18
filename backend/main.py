from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

from api.students import router as students_router
from api.lessons import router as lessons_router
from api.chat import router as chat_router
from api.progress import router as progress_router
from api.tts import router as tts_router
from api.usage import router as usage_router
from api.debate import router as debate_router
from api.chess_game import router as chess_router
from database.connection import engine, Base

# Create all tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="English Learning AI", version="3.0.0")

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost", "http://localhost:80", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(students_router, prefix="/api/students", tags=["students"])
app.include_router(lessons_router, prefix="/api/lessons", tags=["lessons"])
app.include_router(chat_router, prefix="/api/chat", tags=["chat"])
app.include_router(progress_router, prefix="/api/progress", tags=["progress"])
app.include_router(tts_router, prefix="/api/tts", tags=["tts"])
app.include_router(usage_router, prefix="/api/usage", tags=["usage"])
app.include_router(debate_router, prefix="/api/debate", tags=["debate"])
app.include_router(chess_router, prefix="/api/chess", tags=["chess"])


@app.get("/api")
def root():
    return {
        "message": "English Learning AI API",
        "version": "3.0.0",
        "powered_by": "OpenAI GPT + TTS + Claude",
    }


# Serve frontend static files in production
static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.exists(static_dir):
    app.mount("/assets", StaticFiles(directory=os.path.join(static_dir, "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        """Serve React app for all non-API routes."""
        file_path = os.path.join(static_dir, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(static_dir, "index.html"))
