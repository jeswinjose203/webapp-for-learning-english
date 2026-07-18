import { useState, useEffect } from 'react'
import api from '../services/api'

interface Character {
  id: string
  name: string
  avatar: string
  style: string
  voice: string
  provider: string
}

interface Commentary {
  name: string
  avatar: string
  text: string
  player_id: string
}

// Simple chess board renderer using Unicode pieces
const PIECE_UNICODE: Record<string, string> = {
  'K': '♔', 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘', 'P': '♙',
  'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟',
}

function fenToBoard(fen: string): string[][] {
  const rows = fen.split(' ')[0].split('/')
  return rows.map(row => {
    const cells: string[] = []
    for (const ch of row) {
      if (ch >= '1' && ch <= '8') {
        for (let i = 0; i < parseInt(ch); i++) cells.push('')
      } else {
        cells.push(ch)
      }
    }
    return cells
  })
}

function Chess() {
  const [phase, setPhase] = useState<'setup' | 'playing' | 'ended'>('setup')
  const [characters, setCharacters] = useState<Character[]>([])
  const [whitePlayer, setWhitePlayer] = useState<string>('')
  const [blackPlayer, setBlackPlayer] = useState<string>('')
  const [mode, setMode] = useState<'watch'>('watch')

  // Game state
  const [fen, setFen] = useState('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')
  const [moveHistory, setMoveHistory] = useState<string[]>([])
  const [commentary, setCommentary] = useState<Commentary[]>([])
  const [turn, setTurn] = useState<'white' | 'black'>('white')
  const [status, setStatus] = useState('playing')
  const [loading, setLoading] = useState(false)
  const [whiteChar, setWhiteChar] = useState<Character | null>(null)
  const [blackChar, setBlackChar] = useState<Character | null>(null)

  useEffect(() => {
    fetchCharacters()
  }, [])

  const fetchCharacters = async () => {
    try {
      const res = await api.get('/chess/characters')
      setCharacters(res.data.characters)
      if (res.data.characters.length >= 2) {
        setWhitePlayer(res.data.characters[0].id)
        setBlackPlayer(res.data.characters[1].id)
      }
    } catch (err) {
      console.error('Failed to fetch characters:', err)
    }
  }

  const startGame = async () => {
    if (!whitePlayer || !blackPlayer) return
    setLoading(true)

    try {
      const res = await api.post('/chess/start', {
        white_player: whitePlayer,
        black_player: blackPlayer,
      })

      setFen(res.data.fen)
      setWhiteChar(res.data.white)
      setBlackChar(res.data.black)
      setTurn('white')
      setStatus('playing')
      setMoveHistory([])
      setCommentary([])
      setPhase('playing')

      // Start AI vs AI loop
      setTimeout(() => aiVsAiLoop(res.data.fen, [], [], res.data.white, res.data.black), 500)
    } catch (err) {
      console.error('Failed to start game:', err)
    } finally {
      setLoading(false)
    }
  }

  const aiVsAiLoop = async (currentFen: string, moves: string[], comments: Commentary[], white: Character, black: Character) => {
    let gameFen = currentFen
    let gameMoves = [...moves]
    let gameComments = [...comments]
    let gameOver = false
    let currentTurn: 'white' | 'black' = 'white'

    while (!gameOver) {
      const currentPlayer = currentTurn === 'white' ? white : black
      setLoading(true)
      setTurn(currentTurn)

      try {
        const res = await api.post('/chess/ai-move', {
          fen: gameFen,
          player_id: currentPlayer.id,
          move_history: gameMoves,
          commentary_history: gameComments,
        })

        if (!res.data.move) {
          gameOver = true
          break
        }

        gameFen = res.data.fen
        gameMoves.push(res.data.move)

        const newComment: Commentary = {
          name: res.data.player_name,
          avatar: res.data.player_avatar,
          text: res.data.commentary,
          player_id: currentPlayer.id,
        }
        gameComments.push(newComment)

        setFen(gameFen)
        setMoveHistory([...gameMoves])
        setCommentary([...gameComments])
        setStatus(res.data.status)
        setLoading(false)

        // Pause between moves
        await new Promise(r => setTimeout(r, 1500))

        if (res.data.status === 'checkmate' || res.data.status === 'stalemate') {
          gameOver = true
          setPhase('ended')
          break
        }

        currentTurn = currentTurn === 'white' ? 'black' : 'white'
      } catch (err) {
        console.error('AI move failed:', err)
        gameOver = true
        setLoading(false)
        break
      }
    }
  }

  const board = fenToBoard(fen)

  // SETUP
  if (phase === 'setup') {
    return (
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">♟️ AI Chess</h1>
        <p className="text-gray-600 text-sm mb-6">Watch AI characters play chess with personality-filled commentary — learn English through the game!</p>

        {/* Character Selection */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Choose Players</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">⬜ White</label>
              <select value={whitePlayer} onChange={(e) => setWhitePlayer(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2">
                {characters.map(c => (
                  <option key={c.id} value={c.id}>{c.avatar} {c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">⬛ Black</label>
              <select value={blackPlayer} onChange={(e) => setBlackPlayer(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2">
                {characters.map(c => (
                  <option key={c.id} value={c.id}>{c.avatar} {c.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <button onClick={startGame} disabled={loading}
          className="w-full bg-indigo-500 text-white py-4 rounded-xl font-semibold text-lg hover:bg-indigo-600 disabled:opacity-50">
          ♟️ Start Game
        </button>
      </div>
    )
  }

  // GAME SCREEN
  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-120px)] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-3">
          <span className="text-lg">{whiteChar?.avatar}</span>
          <span className="text-sm font-medium">vs</span>
          <span className="text-lg">{blackChar?.avatar}</span>
          {status === 'check' && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded">CHECK!</span>}
          {status === 'checkmate' && <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded">CHECKMATE!</span>}
        </div>
        <div className="flex gap-2">
          <span className="text-xs text-gray-500">{moveHistory.length} moves</span>
          <button onClick={() => { setPhase('setup'); setCommentary([]); }}
            className="px-3 py-1 rounded-lg bg-gray-200 text-sm">New Game</button>
        </div>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Board */}
        <div className="flex-shrink-0">
          <div className="grid grid-cols-8 border-2 border-gray-800 rounded-lg overflow-hidden" style={{ width: '320px', height: '320px' }}>
            {board.map((row, rowIdx) =>
              row.map((piece, colIdx) => {
                const isLight = (rowIdx + colIdx) % 2 === 0

                return (
                  <div
                    key={`${rowIdx}-${colIdx}`}
                    className={`flex items-center justify-center text-2xl
                      ${isLight ? 'bg-amber-100' : 'bg-amber-700'}
                    `}
                    style={{ width: '40px', height: '40px' }}
                  >
                    {piece ? PIECE_UNICODE[piece] || '' : ''}
                  </div>
                )
              })
            )}
          </div>
          {/* Turn indicator */}
          <div className="text-center mt-2 text-sm text-gray-600">
            {turn === 'white' ? `⬜ ${whiteChar?.name}` : `⬛ ${blackChar?.name}`}
            {loading && ' thinking...'}
          </div>
        </div>

        {/* Commentary */}
        <div className="flex-1 overflow-y-auto bg-gray-50 rounded-xl p-3 border border-gray-100 min-h-0">
          <p className="text-xs text-gray-400 mb-2">Commentary</p>
          {commentary.map((c, i) => (
            <div key={i} className="mb-2">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-sm">{c.avatar}</span>
                <span className="text-xs font-semibold text-gray-600">{c.name}</span>
              </div>
              <p className="text-sm text-gray-700 bg-white rounded-lg px-3 py-2 border border-gray-100">
                {c.text}
              </p>
            </div>
          ))}
          {loading && (
            <p className="text-xs text-gray-400 animate-pulse">Thinking about the next move...</p>
          )}
        </div>
      </div>

    </div>
  )
}

export default Chess
