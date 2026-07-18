# Chess MCP Server ♟️

An MCP (Model Context Protocol) server that lets AI assistants play chess against AI characters with unique personalities. Characters speak at B1-B2 English level for language learners.

## Tools

| Tool | Description |
|------|-------------|
| `list_characters` | Get available chess opponents |
| `start_game` | Start a new game against a character |
| `get_board_state` | Get current board, legal moves, status |
| `make_move` | Make a move (UCI notation, e.g. "e2e4") |
| `get_ai_move` | Have the AI opponent play their turn |
| `resign` | Resign the current game |

## Setup

```bash
cd chess-mcp
pip install -r requirements.txt
```

## Environment Variables

```
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key
MCP_API_TOKEN=optional-auth-token       # For remote SSE mode
MCP_TRANSPORT=sse                        # Set to "sse" for remote, omit for stdio
PORT=8080                                # Port for SSE mode
```

## Running

### Local (stdio) — for personal use

```bash
python3 server.py
```

### Remote (SSE) — for sharing with others

```bash
python3 server.py --sse
# or
MCP_TRANSPORT=sse python3 server.py
```

Server starts on `http://0.0.0.0:8080` with endpoints:
- `GET /sse` — SSE connection endpoint (MCP clients connect here)
- `POST /messages/` — Message handling
- `GET /health` — Health check

## Connecting as a Client

### Remote (SSE) — Anyone can use this

Once deployed, share your URL. Others add to their MCP config:

**Claude Desktop** (`claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "chess": {
      "url": "https://chess-mcp.onrender.com/sse?token=YOUR_MCP_API_TOKEN"
    }
  }
}
```

**Kiro / Cursor / other MCP clients:**
```json
{
  "mcpServers": {
    "chess": {
      "url": "https://chess-mcp.onrender.com/sse?token=YOUR_MCP_API_TOKEN"
    }
  }
}
```

### Local (stdio) — Personal use

**Claude Desktop:**
```json
{
  "mcpServers": {
    "chess": {
      "command": "python3",
      "args": ["/path/to/chess-mcp/server.py"],
      "env": {
        "OPENAI_API_KEY": "your-key",
        "ANTHROPIC_API_KEY": "your-key"
      }
    }
  }
}
```

## Deployment (Render)

Already configured in the root `render.yaml`. Just push to your repo and Render will deploy it automatically.

The deployed URL will be something like: `https://chess-mcp.onrender.com`

## Characters

| ID | Name | Style |
|----|------|-------|
| `professor` | 🎓 Prof. Williams | Educational, quotes chess masters |
| `businessman` | 💼 Robert Sterling | Aggressive, time is money |
| `philosopher` | 🤔 Dr. Marcus | Deep thinker, life philosophy |
| `comedian` | 😂 Dave Murphy | Jokes, names his pieces |
| `grandma` | 👵 Nana Rose | Patient traps, surprisingly ruthless |
| `lawyer` | ⚖️ Attorney Park | Objection! Cross-examines strategy |
| `teenager` | 🧑‍💻 Alex Rivera | GG EZ, gaming lingo |
| `scientist` | 🔬 Dr. Elena Rossi | Calculates probabilities |
| `historian` | 📜 Prof. Okafor | Chess history stories |
| `artist` | 🎨 Luna Frost | Sees beauty in chess |

## Docker

```bash
docker build -t chess-mcp .
docker run -p 8080:8080 \
  -e OPENAI_API_KEY=your-key \
  -e ANTHROPIC_API_KEY=your-key \
  -e MCP_API_TOKEN=secret-token \
  chess-mcp
```
