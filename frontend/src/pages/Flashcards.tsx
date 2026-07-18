import { useState, useEffect, useRef } from 'react'
import useTextToSpeech from '../hooks/useTextToSpeech'
import api from '../services/api'

interface FlashCard {
  id: number
  word: string
  meaning: string
  example: string
  difficulty: string
  mastery: number
}

function Flashcards() {
  const [cards, setCards] = useState<FlashCard[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [loading, setLoading] = useState(true)
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null)
  const [stats, setStats] = useState({ known: 0, learning: 0, total: 0 })
  const [sessionStats, setSessionStats] = useState({ correct: 0, wrong: 0 })
  const cardRef = useRef<HTMLDivElement>(null)
  const touchStartRef = useRef<number>(0)
  const { speak } = useTextToSpeech()

  useEffect(() => {
    fetchCards()
  }, [])

  const fetchCards = async () => {
    setLoading(true)
    try {
      // Get words from vocabulary + generate new ones if needed
      const res = await api.get('/progress/vocabulary')
      let allCards: FlashCard[] = []

      // Words being learned (priority)
      if (res.data.learning) {
        allCards.push(...res.data.learning.map((w: any, i: number) => ({
          id: i,
          word: w.word,
          meaning: w.meaning,
          example: w.example || `Use "${w.word}" in a sentence.`,
          difficulty: 'learning',
          mastery: w.mastery || 0,
        })))
      }

      // Unknown words
      if (res.data.unknown) {
        allCards.push(...res.data.unknown.map((w: any, i: number) => ({
          id: 100 + i,
          word: w.word,
          meaning: w.meaning,
          example: w.example || `Learn the word "${w.word}".`,
          difficulty: 'new',
          mastery: 0,
        })))
      }

      // If we don't have enough cards, generate some
      if (allCards.length < 5) {
        const generated = await generateNewCards()
        allCards.push(...generated)
      }

      // Shuffle
      allCards.sort(() => Math.random() - 0.5)

      setCards(allCards)
      setStats({
        known: res.data.known_count || 0,
        learning: res.data.learning_count || 0,
        total: res.data.total || 0,
      })
    } catch (err) {
      // Fallback cards
      setCards(getDefaultCards())
    } finally {
      setLoading(false)
    }
  }

  const generateNewCards = async (): Promise<FlashCard[]> => {
    try {
      const res = await api.post('/chat/send', {
        message: 'Give me 5 useful English vocabulary words to learn. Make them practical everyday words.',
        mode: 'vocabulary',
      })
      const newWords = res.data.new_words || []
      return newWords.map((w: any, i: number) => ({
        id: 200 + i,
        word: w.word,
        meaning: w.meaning,
        example: w.example || '',
        difficulty: 'new',
        mastery: 0,
      }))
    } catch {
      return getDefaultCards()
    }
  }

  const getDefaultCards = (): FlashCard[] => [
    { id: 1, word: 'persevere', meaning: 'to continue trying despite difficulties', example: 'You must persevere to learn a new language.', difficulty: 'new', mastery: 0 },
    { id: 2, word: 'eloquent', meaning: 'fluent and persuasive in speaking', example: 'She gave an eloquent speech.', difficulty: 'new', mastery: 0 },
    { id: 3, word: 'inevitable', meaning: 'certain to happen', example: 'Change is inevitable in life.', difficulty: 'new', mastery: 0 },
    { id: 4, word: 'ambiguous', meaning: 'having more than one meaning', example: 'The instructions were ambiguous.', difficulty: 'new', mastery: 0 },
    { id: 5, word: 'pragmatic', meaning: 'dealing with things practically', example: 'Take a pragmatic approach to the problem.', difficulty: 'new', mastery: 0 },
  ]

  const handleSwipe = (direction: 'left' | 'right') => {
    setSwipeDirection(direction)

    if (direction === 'right') {
      // Known — swipe right
      setSessionStats(prev => ({ ...prev, correct: prev.correct + 1 }))
    } else {
      // Don't know — swipe left
      setSessionStats(prev => ({ ...prev, wrong: prev.wrong + 1 }))
    }

    // Animate out
    setTimeout(() => {
      setSwipeDirection(null)
      setFlipped(false)
      if (currentIndex < cards.length - 1) {
        setCurrentIndex(prev => prev + 1)
      } else {
        // End of deck — reload
        setCurrentIndex(0)
        fetchCards()
      }
    }, 300)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = e.touches[0].clientX
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    const touchEnd = e.changedTouches[0].clientX
    const diff = touchEnd - touchStartRef.current

    if (Math.abs(diff) > 80) {
      handleSwipe(diff > 0 ? 'right' : 'left')
    }
  }

  const currentCard = cards[currentIndex]

  if (loading) {
    return (
      <div className="h-[calc(100vh-120px)] flex items-center justify-center">
        <div className="text-center">
          <p className="text-4xl mb-3 animate-bounce">📇</p>
          <p className="text-gray-500">Loading flashcards...</p>
        </div>
      </div>
    )
  }

  if (!currentCard) {
    return (
      <div className="h-[calc(100vh-120px)] flex items-center justify-center">
        <div className="text-center">
          <p className="text-4xl mb-3">🎉</p>
          <p className="text-xl font-bold text-gray-800 mb-2">Session Complete!</p>
          <p className="text-gray-600 mb-4">
            ✅ {sessionStats.correct} known · ❌ {sessionStats.wrong} to review
          </p>
          <button
            onClick={() => { setCurrentIndex(0); fetchCards(); setSessionStats({ correct: 0, wrong: 0 }); }}
            className="bg-indigo-500 text-white px-6 py-3 rounded-lg hover:bg-indigo-600"
          >
            New Session
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col items-center max-w-md mx-auto">
      {/* Header */}
      <div className="w-full flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold text-gray-800">📇 Flashcards</h1>
        <div className="text-sm text-gray-500">
          {currentIndex + 1} / {cards.length}
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-200 rounded-full h-1.5 mb-6">
        <div
          className="bg-indigo-500 h-1.5 rounded-full transition-all"
          style={{ width: `${((currentIndex + 1) / cards.length) * 100}%` }}
        />
      </div>

      {/* Session stats */}
      <div className="flex gap-4 mb-4 text-sm">
        <span className="text-green-600">✅ {sessionStats.correct}</span>
        <span className="text-red-600">❌ {sessionStats.wrong}</span>
      </div>

      {/* Card */}
      <div
        ref={cardRef}
        className={`w-full flex-1 max-h-[400px] perspective-1000 cursor-pointer select-none transition-transform duration-300 ${
          swipeDirection === 'right' ? 'translate-x-[120%] rotate-12 opacity-0' :
          swipeDirection === 'left' ? '-translate-x-[120%] -rotate-12 opacity-0' : ''
        }`}
        onClick={() => setFlipped(!flipped)}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className={`w-full h-full transition-transform duration-500 relative ${flipped ? '[transform:rotateY(180deg)]' : ''}`} style={{ transformStyle: 'preserve-3d' }}>
          {/* Front — Word */}
          <div className="absolute inset-0 bg-white rounded-2xl shadow-lg border-2 border-gray-100 flex flex-col items-center justify-center p-8 [backface-visibility:hidden]">
            <div className={`text-xs px-2 py-1 rounded-full mb-4 ${
              currentCard.difficulty === 'new' ? 'bg-blue-100 text-blue-600' :
              currentCard.difficulty === 'learning' ? 'bg-yellow-100 text-yellow-600' :
              'bg-green-100 text-green-600'
            }`}>
              {currentCard.difficulty === 'new' ? '🆕 New Word' : 
               currentCard.difficulty === 'learning' ? '📖 Learning' : '✅ Review'}
            </div>

            <p className="text-4xl font-bold text-gray-800 mb-4">{currentCard.word}</p>

            <button
              onClick={(e) => { e.stopPropagation(); speak(currentCard.word); }}
              className="text-indigo-500 hover:text-indigo-700 mb-6"
            >
              🔊 Listen
            </button>

            <p className="text-sm text-gray-400">Tap to reveal meaning</p>
          </div>

          {/* Back — Meaning */}
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-lg flex flex-col items-center justify-center p-8 text-white [backface-visibility:hidden] [transform:rotateY(180deg)]">
            <p className="text-3xl font-bold mb-4">{currentCard.word}</p>
            <p className="text-lg text-center mb-4 text-indigo-100">{currentCard.meaning}</p>
            <p className="text-sm text-center italic text-indigo-200 mb-4">"{currentCard.example}"</p>

            <button
              onClick={(e) => { e.stopPropagation(); speak(currentCard.example || currentCard.word); }}
              className="text-indigo-200 hover:text-white"
            >
              🔊 Listen to example
            </button>
          </div>
        </div>
      </div>

      {/* Swipe instructions */}
      <div className="w-full flex justify-between items-center mt-6 px-4">
        <button
          onClick={() => handleSwipe('left')}
          className="flex flex-col items-center gap-1"
        >
          <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center text-2xl hover:bg-red-200 transition-colors">
            ❌
          </div>
          <span className="text-xs text-gray-500">Don't know</span>
        </button>

        <p className="text-xs text-gray-400">← swipe or tap buttons →</p>

        <button
          onClick={() => handleSwipe('right')}
          className="flex flex-col items-center gap-1"
        >
          <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center text-2xl hover:bg-green-200 transition-colors">
            ✅
          </div>
          <span className="text-xs text-gray-500">Know it!</span>
        </button>
      </div>
    </div>
  )
}

export default Flashcards
