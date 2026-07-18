from fastapi import APIRouter, Depends, Header
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from openai import OpenAI
from config import settings
from database.connection import get_db
from services.usage_tracker import track_chat_usage
import chess
import json
import random

router = APIRouter()

CHESS_CHARACTERS = {
    "professor": {
        "name": "Prof. Williams",
        "avatar": "🎓",
        "style": "Methodical and educational. Explains the theory behind every move. Quotes chess masters.",
        "provider": "openai",
        "model": "gpt-4o-mini",
        "voice": "onyx",
    },
    "businessman": {
        "name": "Robert Sterling",
        "avatar": "💼",
        "style": "Aggressive, goes for quick wins. 'Time is money.' Prefers attacks over defense. Impatient.",
        "provider": "openai",
        "model": "gpt-4o-mini",
        "voice": "echo",
    },
    "philosopher": {
        "name": "Dr. Marcus",
        "avatar": "🤔",
        "style": "Deep thinker. Sacrifices pieces for long-term advantage. Relates chess to life philosophy.",
        "provider": "openai",
        "model": "gpt-4o-mini",
        "voice": "fable",
    },
    "comedian": {
        "name": "Dave Murphy",
        "avatar": "😂",
        "style": "Names his pieces, makes jokes. 'My bishop just went on vacation!' Never takes the game too seriously.",
        "provider": "openai",
        "model": "gpt-4o-mini",
        "voice": "alloy",
    },
    "grandma": {
        "name": "Nana Rose",
        "avatar": "👵",
        "style": "Slow, patient, sets traps. 'Oh dear, did I just do that?' Surprisingly ruthless. Knits between moves.",
        "provider": "claude",
        "model": "claude-sonnet-4-20250514",
        "voice": "nova",
    },
    "lawyer": {
        "name": "Attorney Park",
        "avatar": "⚖️",
        "style": "'Objection!' when opponent makes good moves. Argues with the chess rules. Cross-examines opponent's strategy.",
        "provider": "openai",
        "model": "gpt-4o-mini",
        "voice": "onyx",
    },
    "teenager": {
        "name": "Alex Rivera",
        "avatar": "🧑‍💻",
        "style": "Speed chess mindset. 'GG EZ.' Uses gaming lingo. Plays modern openings. Gets tilted when losing.",
        "provider": "openai",
        "model": "gpt-4o-mini",
        "voice": "alloy",
    },
    "scientist": {
        "name": "Dr. Elena Rossi",
        "avatar": "🔬",
        "style": "Calculates everything. 'The probability of winning increases by 12% with this move.' Precise and cold.",
        "provider": "claude",
        "model": "claude-sonnet-4-20250514",
        "voice": "shimmer",
    },
    "historian": {
        "name": "Prof. Okafor",
        "avatar": "📜",
        "style": "'This opening was first used in 1851...' Tells stories about chess history. Plays classical openings.",
        "provider": "claude",
        "model": "claude-sonnet-4-20250514",
        "voice": "fable",
    },
    "artist": {
        "name": "Luna Frost",
        "avatar": "🎨",
        "style": "'The knight dances across the board like a poem.' Sees beauty in chess. Plays creatively, not optimally.",
        "provider": "claude",
        "model": "claude-sonnet-4-20250514",
        "voice": "shimmer",
    },
}


class ChessStartRequest(BaseModel):
    white_player: str  # character id
    black_player: str  # character id


class ChessMoveRequest(BaseModel):
    fen: str  # Current board state
    player_id: str  # Who's moving
    move_history: List[str]  # List of moves in UCI notation
    commentary_history: List[dict]  # Previous commentary


class UserMoveRequest(BaseModel):
    fen: str
    user_move: str  # UCI notation e.g. "e2e4"
    opponent_id: str
    move_history: List[str]
    commentary_history: List[dict]


def get_ai_move(character: dict, fen: str, move_history: List[str], commentary_history: List[dict], opponent_name: str, db=None, student_id=None) -> dict:
    """Get a chess move and commentary from an AI character."""
    board = chess.Board(fen)
    legal_moves = [move.uci() for move in board.legal_moves]

    if not legal_moves:
        return {"move": None, "commentary": "No legal moves available."}

    # Build context
    recent_commentary = "\n".join([
        f"{c.get('name', '?')}: \"{c.get('text', '')}\""
        for c in commentary_history[-6:]
    ])

    move_list = " ".join(move_history[-10:]) if move_history else "Game just started"

    system_prompt = f"""You are {character['name']} playing chess.
Your personality: {character['style']}
You are playing {'white' if board.turn == chess.WHITE else 'black'}.
Your opponent is {opponent_name}.

IMPORTANT RULES:
1. Choose a legal move from the list provided
2. Give a short commentary (1-2 sentences) in your personality about your move
3. You can trash-talk your opponent, explain your strategy, or make jokes — stay in character
4. Speak at B1-B2 English level for language learners
5. Sometimes teach a chess vocabulary word in English"""

    user_prompt = f"""Current position (FEN): {fen}
Recent moves: {move_list}
Legal moves available: {', '.join(legal_moves[:20])}

Recent commentary:
{recent_commentary}

Choose your move and give commentary.
Respond in JSON: {{"move": "e2e4", "commentary": "your commentary about this move"}}"""

    provider = character.get("provider", "openai")

    try:
        if provider == "openai":
            client = OpenAI(api_key=settings.openai_api_key)
            response = client.chat.completions.create(
                model=character.get("model", "gpt-4o-mini"),
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                max_tokens=200,
                temperature=0.9,
                response_format={"type": "json_object"},
            )
            if db and student_id and response.usage:
                track_chat_usage(db=db, student_id=student_id, provider="openai", model=character.get("model", "gpt-4o-mini"), feature="chess", input_tokens=response.usage.prompt_tokens, output_tokens=response.usage.completion_tokens)
                db.commit()
            parsed = json.loads(response.choices[0].message.content)
        else:
            import anthropic
            client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
            response = client.messages.create(
                model=character.get("model", "claude-sonnet-4-20250514"),
                max_tokens=200,
                system=system_prompt + '\n\nRespond ONLY in JSON: {"move": "e2e4", "commentary": "your comment"}',
                messages=[{"role": "user", "content": user_prompt}],
            )
            if db and student_id and response.usage:
                track_chat_usage(db=db, student_id=student_id, provider="anthropic", model=character.get("model", "claude-sonnet-4-20250514"), feature="chess", input_tokens=response.usage.input_tokens, output_tokens=response.usage.output_tokens)
                db.commit()
            content = response.content[0].text.strip()
            if content.startswith("```"): content = content.split("\n", 1)[1] if "\n" in content else content[3:]
            if content.endswith("```"): content = content[:-3]
            parsed = json.loads(content.strip())

        move = parsed.get("move", "")
        commentary = parsed.get("commentary", "Hmm, interesting position.")

        # Validate the move is legal
        if move not in legal_moves:
            # AI suggested illegal move — pick a random legal one
            move = random.choice(legal_moves)
            commentary = commentary + " (I had to adjust my move slightly.)"

        return {"move": move, "commentary": commentary}

    except Exception as e:
        # Fallback: random move with generic commentary
        move = random.choice(legal_moves)
        return {"move": move, "commentary": "Let me try this move..."}


@router.get("/characters")
def get_chess_characters():
    """Get available chess characters."""
    return {
        "characters": [
            {"id": key, "name": val["name"], "avatar": val["avatar"], "style": val["style"], "voice": val["voice"], "provider": val["provider"]}
            for key, val in CHESS_CHARACTERS.items()
        ]
    }


@router.post("/start")
def start_game(data: ChessStartRequest):
    """Start a new chess game between two characters."""
    board = chess.Board()

    white = CHESS_CHARACTERS.get(data.white_player)
    black = CHESS_CHARACTERS.get(data.black_player)

    if not white or not black:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Invalid character IDs")

    return {
        "fen": board.fen(),
        "white": {"id": data.white_player, **white},
        "black": {"id": data.black_player, **black},
        "turn": "white",
        "move_history": [],
        "status": "playing",
    }


@router.post("/ai-move")
def make_ai_move(data: ChessMoveRequest, student_id: int = Header(None, alias="X-Student-ID"), db: Session = Depends(get_db)):
    """Get an AI character's next chess move with commentary."""
    character = CHESS_CHARACTERS.get(data.player_id)
    if not character:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Invalid character")

    board = chess.Board(data.fen)

    # Determine opponent name
    opponent_name = "the opponent"
    for c in data.commentary_history:
        if c.get("player_id") != data.player_id:
            opponent_name = c.get("name", "the opponent")
            break

    result = get_ai_move(character, data.fen, data.move_history, data.commentary_history, opponent_name, db, student_id)

    if result["move"]:
        # Apply the move
        move = chess.Move.from_uci(result["move"])
        board.push(move)

        # Check game status
        status = "playing"
        if board.is_checkmate():
            status = "checkmate"
        elif board.is_stalemate():
            status = "stalemate"
        elif board.is_check():
            status = "check"

        return {
            "move": result["move"],
            "commentary": result["commentary"],
            "fen": board.fen(),
            "status": status,
            "turn": "white" if board.turn == chess.WHITE else "black",
            "player_name": character["name"],
            "player_avatar": character["avatar"],
            "player_voice": character["voice"],
        }
    else:
        return {
            "move": None,
            "commentary": "The game is over.",
            "fen": data.fen,
            "status": "ended",
            "turn": None,
        }


@router.post("/user-move")
def make_user_move(data: UserMoveRequest, student_id: int = Header(None, alias="X-Student-ID"), db: Session = Depends(get_db)):
    """User makes a move, then AI opponent responds."""
    board = chess.Board(data.fen)

    # Validate user move
    try:
        move = chess.Move.from_uci(data.user_move)
        if move not in board.legal_moves:
            from fastapi import HTTPException
            raise HTTPException(status_code=400, detail="Illegal move")
        board.push(move)
    except ValueError:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Invalid move format")

    # Check if game ended after user's move
    if board.is_checkmate() or board.is_stalemate():
        status = "checkmate" if board.is_checkmate() else "stalemate"
        return {
            "user_move_applied": True,
            "fen_after_user": board.fen(),
            "status": status,
            "ai_move": None,
            "ai_commentary": "Good game!",
        }

    # AI responds
    opponent = CHESS_CHARACTERS.get(data.opponent_id)
    if not opponent:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Invalid opponent")

    new_history = data.move_history + [data.user_move]
    ai_result = get_ai_move(opponent, board.fen(), new_history, data.commentary_history, "you", db, student_id)

    if ai_result["move"]:
        ai_move = chess.Move.from_uci(ai_result["move"])
        board.push(ai_move)

        status = "playing"
        if board.is_checkmate():
            status = "checkmate"
        elif board.is_stalemate():
            status = "stalemate"
        elif board.is_check():
            status = "check"

        return {
            "user_move_applied": True,
            "fen_after_user": chess.Board(data.fen).fen(),
            "ai_move": ai_result["move"],
            "ai_commentary": ai_result["commentary"],
            "fen_after_ai": board.fen(),
            "status": status,
            "player_name": opponent["name"],
            "player_avatar": opponent["avatar"],
            "player_voice": opponent["voice"],
        }

    return {
        "user_move_applied": True,
        "fen_after_user": board.fen(),
        "ai_move": None,
        "ai_commentary": "The game is over.",
        "status": "ended",
    }
