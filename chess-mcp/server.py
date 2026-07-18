"""
Chess MCP Server — Remote (SSE) + Local (stdio) transport.
Play chess against AI characters with unique personalities.
Characters speak at B1-B2 English level for language learners.
"""

import json
import os
import random
from typing import Any

import chess
from dotenv import load_dotenv
from mcp.server import Server
from mcp.types import Tool, TextContent

load_dotenv()

# --- Configuration ---

API_TOKEN = os.getenv("MCP_API_TOKEN", "")  # Optional auth token

# --- AI Characters ---

CHESS_CHARACTERS = {
    "professor": {
        "name": "Prof. Williams",
        "avatar": "🎓",
        "style": "Methodical and educational. Explains the theory behind every move. Quotes chess masters.",
        "provider": "openai",
        "model": "gpt-4o-mini",
    },
    "businessman": {
        "name": "Robert Sterling",
        "avatar": "💼",
        "style": "Aggressive, goes for quick wins. 'Time is money.' Prefers attacks over defense. Impatient.",
        "provider": "openai",
        "model": "gpt-4o-mini",
    },
    "philosopher": {
        "name": "Dr. Marcus",
        "avatar": "🤔",
        "style": "Deep thinker. Sacrifices pieces for long-term advantage. Relates chess to life philosophy.",
        "provider": "openai",
        "model": "gpt-4o-mini",
    },
    "comedian": {
        "name": "Dave Murphy",
        "avatar": "😂",
        "style": "Names his pieces, makes jokes. 'My bishop just went on vacation!' Never takes the game too seriously.",
        "provider": "openai",
        "model": "gpt-4o-mini",
    },
    "grandma": {
        "name": "Nana Rose",
        "avatar": "👵",
        "style": "Slow, patient, sets traps. 'Oh dear, did I just do that?' Surprisingly ruthless. Knits between moves.",
        "provider": "claude",
        "model": "claude-sonnet-4-20250514",
    },
    "lawyer": {
        "name": "Attorney Park",
        "avatar": "⚖️",
        "style": "'Objection!' when opponent makes good moves. Argues with the chess rules. Cross-examines opponent's strategy.",
        "provider": "openai",
        "model": "gpt-4o-mini",
    },
    "teenager": {
        "name": "Alex Rivera",
        "avatar": "🧑‍💻",
        "style": "Speed chess mindset. 'GG EZ.' Uses gaming lingo. Plays modern openings. Gets tilted when losing.",
        "provider": "openai",
        "model": "gpt-4o-mini",
    },
    "scientist": {
        "name": "Dr. Elena Rossi",
        "avatar": "🔬",
        "style": "Calculates everything. 'The probability of winning increases by 12% with this move.' Precise and cold.",
        "provider": "claude",
        "model": "claude-sonnet-4-20250514",
    },
    "historian": {
        "name": "Prof. Okafor",
        "avatar": "📜",
        "style": "'This opening was first used in 1851...' Tells stories about chess history. Plays classical openings.",
        "provider": "claude",
        "model": "claude-sonnet-4-20250514",
    },
    "artist": {
        "name": "Luna Frost",
        "avatar": "🎨",
        "style": "'The knight dances across the board like a poem.' Sees beauty in chess. Plays creatively, not optimally.",
        "provider": "claude",
        "model": "claude-sonnet-4-20250514",
    },
}

# --- Game State (in-memory, per session) ---

games: dict[str, dict[str, Any]] = {}


def generate_game_id() -> str:
    return f"game_{random.randint(1000, 9999)}"


# --- AI Move Logic ---

def get_ai_move(character: dict, fen: str, move_history: list[str], commentary_history: list[dict], opponent_name: str) -> dict:
    """Get a chess move and commentary from an AI character."""
    board = chess.Board(fen)
    legal_moves = [move.uci() for move in board.legal_moves]

    if not legal_moves:
        return {"move": None, "commentary": "No legal moves available."}

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
            from openai import OpenAI
            client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
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
            parsed = json.loads(response.choices[0].message.content)
        else:
            import anthropic
            client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
            response = client.messages.create(
                model=character.get("model", "claude-sonnet-4-20250514"),
                max_tokens=200,
                system=system_prompt + '\n\nRespond ONLY in JSON: {"move": "e2e4", "commentary": "your comment"}',
                messages=[{"role": "user", "content": user_prompt}],
            )
            content = response.content[0].text.strip()
            if content.startswith("```"):
                content = content.split("\n", 1)[1] if "\n" in content else content[3:]
            if content.endswith("```"):
                content = content[:-3]
            parsed = json.loads(content.strip())

        move = parsed.get("move", "")
        commentary = parsed.get("commentary", "Hmm, interesting position.")

        if move not in legal_moves:
            move = random.choice(legal_moves)
            commentary = commentary + " (I had to adjust my move slightly.)"

        return {"move": move, "commentary": commentary}

    except Exception as e:
        move = random.choice(legal_moves)
        return {"move": move, "commentary": f"Let me try this move..."}


def get_game_status(board: chess.Board) -> str:
    if board.is_checkmate():
        winner = "Black" if board.turn == chess.WHITE else "White"
        return f"checkmate — {winner} wins!"
    elif board.is_stalemate():
        return "stalemate — draw"
    elif board.is_insufficient_material():
        return "draw — insufficient material"
    elif board.is_check():
        return "check"
    else:
        return "playing"


def format_board(board: chess.Board) -> str:
    return str(board)


# --- MCP Server ---

server = Server("chess-mcp")


@server.list_tools()
async def list_tools() -> list[Tool]:
    return [
        Tool(
            name="list_characters",
            description="List all available chess opponents with their personalities.",
            inputSchema={
                "type": "object",
                "properties": {},
            },
        ),
        Tool(
            name="start_game",
            description="Start a new chess game. You play as white, the AI character plays as black.",
            inputSchema={
                "type": "object",
                "properties": {
                    "opponent": {
                        "type": "string",
                        "description": "Character ID to play against (e.g. 'professor', 'grandma', 'comedian')",
                    },
                    "play_as": {
                        "type": "string",
                        "enum": ["white", "black"],
                        "description": "Which color to play as (default: white)",
                        "default": "white",
                    },
                },
                "required": ["opponent"],
            },
        ),
        Tool(
            name="get_board_state",
            description="Get the current board state, legal moves, and game status.",
            inputSchema={
                "type": "object",
                "properties": {
                    "game_id": {
                        "type": "string",
                        "description": "The game ID returned from start_game",
                    },
                },
                "required": ["game_id"],
            },
        ),
        Tool(
            name="make_move",
            description="Make a chess move in UCI notation (e.g. 'e2e4', 'g1f3', 'e7e8q' for promotion).",
            inputSchema={
                "type": "object",
                "properties": {
                    "game_id": {
                        "type": "string",
                        "description": "The game ID",
                    },
                    "move": {
                        "type": "string",
                        "description": "Move in UCI notation (e.g. 'e2e4')",
                    },
                },
                "required": ["game_id", "move"],
            },
        ),
        Tool(
            name="get_ai_move",
            description="Have the AI opponent make their move. Call this after your own move when it's the AI's turn.",
            inputSchema={
                "type": "object",
                "properties": {
                    "game_id": {
                        "type": "string",
                        "description": "The game ID",
                    },
                },
                "required": ["game_id"],
            },
        ),
        Tool(
            name="resign",
            description="Resign the current game.",
            inputSchema={
                "type": "object",
                "properties": {
                    "game_id": {
                        "type": "string",
                        "description": "The game ID",
                    },
                },
                "required": ["game_id"],
            },
        ),
    ]


@server.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    if name == "list_characters":
        chars = []
        for char_id, char in CHESS_CHARACTERS.items():
            chars.append(f"{char['avatar']} **{char['name']}** (`{char_id}`)\n   _{char['style']}_")
        result = "## Available Chess Opponents\n\n" + "\n\n".join(chars)
        return [TextContent(type="text", text=result)]

    elif name == "start_game":
        opponent_id = arguments.get("opponent")
        play_as = arguments.get("play_as", "white")

        if opponent_id not in CHESS_CHARACTERS:
            return [TextContent(type="text", text=f"❌ Unknown character '{opponent_id}'. Use list_characters to see options.")]

        opponent = CHESS_CHARACTERS[opponent_id]
        game_id = generate_game_id()
        board = chess.Board()

        games[game_id] = {
            "board": board,
            "opponent_id": opponent_id,
            "opponent": opponent,
            "player_color": play_as,
            "move_history": [],
            "commentary_history": [],
        }

        result = f"""♟️ **New Game Started!**

**Game ID:** `{game_id}`
**You:** {play_as.capitalize()}
**Opponent:** {opponent['avatar']} {opponent['name']}
_"{opponent['style']}"_

{format_board(board)}

{"Your turn! Use `make_move` with UCI notation (e.g. 'e2e4')." if play_as == "white" else "AI plays first. Call `get_ai_move` to let them move."}"""

        if play_as == "black":
            ai_result = get_ai_move(opponent, board.fen(), [], [], "You")
            if ai_result["move"]:
                move = chess.Move.from_uci(ai_result["move"])
                board.push(move)
                games[game_id]["move_history"].append(ai_result["move"])
                games[game_id]["commentary_history"].append({
                    "name": opponent["name"],
                    "text": ai_result["commentary"],
                    "player_id": opponent_id,
                })
                result += f"\n\n---\n{opponent['avatar']} **{opponent['name']}** plays `{ai_result['move']}`\n> {ai_result['commentary']}\n\n{format_board(board)}\n\nYour turn!"

        return [TextContent(type="text", text=result)]

    elif name == "get_board_state":
        game_id = arguments.get("game_id")
        if game_id not in games:
            return [TextContent(type="text", text=f"❌ Game `{game_id}` not found.")]

        game = games[game_id]
        board = game["board"]
        status = get_game_status(board)
        legal_moves = [move.uci() for move in board.legal_moves]
        turn = "White" if board.turn == chess.WHITE else "Black"

        result = f"""**Game:** `{game_id}`
**Status:** {status}
**Turn:** {turn}
**Moves played:** {len(game['move_history'])}
**FEN:** `{board.fen()}`

{format_board(board)}

**Legal moves ({len(legal_moves)}):** {', '.join(legal_moves[:30])}{"..." if len(legal_moves) > 30 else ""}"""

        if game["commentary_history"]:
            last = game["commentary_history"][-1]
            result += f"\n\n**Last comment:** {last.get('name', '?')}: \"{last.get('text', '')}\""

        return [TextContent(type="text", text=result)]

    elif name == "make_move":
        game_id = arguments.get("game_id")
        move_uci = arguments.get("move")

        if game_id not in games:
            return [TextContent(type="text", text=f"❌ Game `{game_id}` not found.")]

        game = games[game_id]
        board = game["board"]

        player_color = game["player_color"]
        current_turn = "white" if board.turn == chess.WHITE else "black"
        if current_turn != player_color:
            return [TextContent(type="text", text=f"❌ It's not your turn. It's {current_turn}'s turn. Call `get_ai_move` for the AI to play.")]

        try:
            move = chess.Move.from_uci(move_uci)
            if move not in board.legal_moves:
                legal = [m.uci() for m in board.legal_moves]
                return [TextContent(type="text", text=f"❌ Illegal move `{move_uci}`. Legal moves: {', '.join(legal[:20])}")]
            board.push(move)
        except ValueError:
            return [TextContent(type="text", text=f"❌ Invalid move format `{move_uci}`. Use UCI notation like 'e2e4', 'g1f3'.")]

        game["move_history"].append(move_uci)
        status = get_game_status(board)

        result = f"""✅ You played `{move_uci}`

{format_board(board)}

**Status:** {status}"""

        if status in ("checkmate", "stalemate", "draw — insufficient material"):
            result += "\n\n🏁 **Game over!**"
        else:
            result += "\n\nCall `get_ai_move` for your opponent's response."

        return [TextContent(type="text", text=result)]

    elif name == "get_ai_move":
        game_id = arguments.get("game_id")

        if game_id not in games:
            return [TextContent(type="text", text=f"❌ Game `{game_id}` not found.")]

        game = games[game_id]
        board = game["board"]
        opponent = game["opponent"]
        opponent_id = game["opponent_id"]

        player_color = game["player_color"]
        current_turn = "white" if board.turn == chess.WHITE else "black"
        if current_turn == player_color:
            return [TextContent(type="text", text=f"❌ It's your turn, not the AI's. Use `make_move` to play.")]

        status = get_game_status(board)
        if status in ("checkmate", "stalemate", "draw — insufficient material"):
            return [TextContent(type="text", text=f"🏁 Game is already over. Status: {status}")]

        ai_result = get_ai_move(
            opponent,
            board.fen(),
            game["move_history"],
            game["commentary_history"],
            "You",
        )

        if ai_result["move"]:
            move = chess.Move.from_uci(ai_result["move"])
            board.push(move)
            game["move_history"].append(ai_result["move"])
            game["commentary_history"].append({
                "name": opponent["name"],
                "text": ai_result["commentary"],
                "player_id": opponent_id,
            })

            status = get_game_status(board)

            result = f"""{opponent['avatar']} **{opponent['name']}** plays `{ai_result['move']}`

> {ai_result['commentary']}

{format_board(board)}

**Status:** {status}"""

            if status in ("checkmate", "stalemate", "draw — insufficient material"):
                result += "\n\n🏁 **Game over!**"
            else:
                result += "\n\nYour turn! Use `make_move`."

            return [TextContent(type="text", text=result)]
        else:
            return [TextContent(type="text", text="🏁 Game over — no moves available.")]

    elif name == "resign":
        game_id = arguments.get("game_id")

        if game_id not in games:
            return [TextContent(type="text", text=f"❌ Game `{game_id}` not found.")]

        game = games[game_id]
        opponent = game["opponent"]
        del games[game_id]

        return [TextContent(type="text", text=f"🏳️ You resigned. {opponent['avatar']} {opponent['name']} wins!\n\nGood game! Start a new one with `start_game`.")]

    return [TextContent(type="text", text=f"❌ Unknown tool: {name}")]


# --- Transport: SSE (remote) or stdio (local) ---

def run_sse():
    """Run as a remote SSE server (for deployment)."""
    from starlette.applications import Starlette
    from starlette.routing import Route, Mount
    from starlette.requests import Request
    from starlette.responses import JSONResponse
    from mcp.server.sse import SseServerTransport
    import uvicorn

    sse = SseServerTransport("/messages/")

    async def handle_sse(request: Request):
        # Optional token auth
        if API_TOKEN:
            auth = request.headers.get("Authorization", "")
            token = request.query_params.get("token", "")
            if not (auth == f"Bearer {API_TOKEN}" or token == API_TOKEN):
                return JSONResponse({"error": "Unauthorized"}, status_code=401)

        async with sse.connect_sse(
            request.scope, request.receive, request._send
        ) as streams:
            await server.run(
                streams[0], streams[1], server.create_initialization_options()
            )

    async def handle_messages(request: Request):
        await sse.handle_post_message(request.scope, request.receive, request._send)

    async def health(request: Request):
        return JSONResponse({
            "status": "ok",
            "server": "chess-mcp",
            "characters": len(CHESS_CHARACTERS),
            "active_games": len(games),
        })

    app = Starlette(
        routes=[
            Route("/health", health),
            Route("/sse", handle_sse),
            Route("/messages/", handle_messages, methods=["POST"]),
        ],
    )

    port = int(os.getenv("PORT", "8080"))
    print(f"♟️  Chess MCP Server (SSE) running on http://0.0.0.0:{port}")
    print(f"   Connect your MCP client to: http://your-host:{port}/sse")
    uvicorn.run(app, host="0.0.0.0", port=port)


async def run_stdio():
    """Run as a local stdio server."""
    from mcp.server.stdio import stdio_server
    async with stdio_server() as (read_stream, write_stream):
        await server.run(read_stream, write_stream, server.create_initialization_options())


if __name__ == "__main__":
    import sys

    if "--sse" in sys.argv or os.getenv("MCP_TRANSPORT") == "sse":
        run_sse()
    else:
        import asyncio
        asyncio.run(run_stdio())
