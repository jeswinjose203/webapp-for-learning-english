import { useEffect, useState } from 'react'
import { getTodaysLesson, completeLesson } from '../services/api'

interface Lesson {
  id: number
  title: string
  lesson_type: string
  content: any
  difficulty_level: string
  is_completed: boolean
  score: number | null
}

interface Exercise {
  instruction: string
  answer: string
  topic: string
}

interface VocabWord {
  word: string
  meaning: string
  example: string
}

function Learn() {
  const [lesson, setLesson] = useState<Lesson | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentSection, setCurrentSection] = useState<'grammar' | 'vocabulary' | 'speaking'>('grammar')
  const [currentExercise, setCurrentExercise] = useState(0)
  const [userAnswer, setUserAnswer] = useState('')
  const [feedback, setFeedback] = useState<string | null>(null)
  const [correctCount, setCorrectCount] = useState(0)
  const [totalAttempted, setTotalAttempted] = useState(0)
  const [lessonComplete, setLessonComplete] = useState(false)
  const [showMeaning, setShowMeaning] = useState(false)

  useEffect(() => {
    fetchLesson()
  }, [])

  const fetchLesson = async () => {
    setLoading(true)
    setLessonComplete(false)
    setCurrentSection('grammar')
    setCurrentExercise(0)
    setCorrectCount(0)
    setTotalAttempted(0)
    try {
      const res = await getTodaysLesson()
      setLesson(res.data)
    } catch (err) {
      console.error('Failed to fetch lesson:', err)
    } finally {
      setLoading(false)
    }
  }

  const getExercises = (): Exercise[] => {
    if (!lesson?.content?.sections) return []
    return lesson.content.sections.grammar || []
  }

  const getVocabulary = (): VocabWord[] => {
    if (!lesson?.content?.sections) return []
    return lesson.content.sections.vocabulary || []
  }

  const getSpeaking = (): string[] => {
    if (!lesson?.content?.sections) return []
    return lesson.content.sections.speaking || []
  }

  const getTotalItems = () => {
    return getExercises().length + getVocabulary().length + getSpeaking().length
  }

  const getCompletedItems = () => {
    let completed = 0
    if (currentSection === 'grammar') {
      completed = currentExercise
    } else if (currentSection === 'vocabulary') {
      completed = getExercises().length + currentExercise
    } else {
      completed = getExercises().length + getVocabulary().length + currentExercise
    }
    return completed
  }

  const checkAnswer = () => {
    const exercises = getExercises()
    if (exercises[currentExercise]) {
      const correct = exercises[currentExercise].answer.toLowerCase().trim()
      const userAns = userAnswer.toLowerCase().trim()
      setTotalAttempted(t => t + 1)

      if (userAns === correct || correct.includes(userAns) || userAns.includes(correct)) {
        setFeedback('✅ Correct! Well done!')
        setCorrectCount(c => c + 1)
      } else {
        setFeedback(`❌ Not quite.\n\nCorrect answer: "${exercises[currentExercise].answer}"`)
      }
    }
  }

  const nextItem = () => {
    setFeedback(null)
    setUserAnswer('')
    setShowMeaning(false)

    const exercises = getExercises()
    const vocab = getVocabulary()
    const speaking = getSpeaking()

    if (currentSection === 'grammar') {
      if (currentExercise < exercises.length - 1) {
        setCurrentExercise(e => e + 1)
      } else {
        setCurrentSection('vocabulary')
        setCurrentExercise(0)
      }
    } else if (currentSection === 'vocabulary') {
      if (currentExercise < vocab.length - 1) {
        setCurrentExercise(e => e + 1)
      } else {
        setCurrentSection('speaking')
        setCurrentExercise(0)
      }
    } else {
      if (currentExercise < speaking.length - 1) {
        setCurrentExercise(e => e + 1)
      } else {
        finishLesson()
      }
    }
  }

  const finishLesson = async () => {
    if (!lesson) return
    const total = getTotalItems()
    const score = total > 0 ? Math.round((correctCount / Math.max(totalAttempted, 1)) * 100) : 50
    try {
      await completeLesson(lesson.id, score)
    } catch (err) {
      console.error('Failed to complete lesson:', err)
    }
    setLessonComplete(true)
  }

  if (loading) {
    return (
      <div className="text-center py-10">
        <div className="text-4xl mb-4 animate-bounce">📚</div>
        <p className="text-gray-500">Generating your personalized lesson...</p>
      </div>
    )
  }

  if (lessonComplete) {
    return (
      <div className="max-w-2xl mx-auto text-center py-10">
        <div className="text-6xl mb-4">🎉</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Lesson Complete!</h1>
        <p className="text-gray-600 mb-2">Great work finishing today's lesson.</p>
        <p className="text-lg text-indigo-600 font-semibold mb-6">
          Score: {correctCount}/{totalAttempted} correct
        </p>
        <button
          onClick={fetchLesson}
          className="bg-indigo-500 text-white px-6 py-3 rounded-lg hover:bg-indigo-600 transition-colors"
        >
          Start New Lesson
        </button>
      </div>
    )
  }

  if (!lesson) {
    return <div className="text-center py-10 text-gray-500">No lesson available. Check if backend is running.</div>
  }

  const exercises = getExercises()
  const vocab = getVocabulary()
  const speaking = getSpeaking()
  const totalItems = getTotalItems()
  const completedItems = getCompletedItems()

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">{lesson.content.title || lesson.title}</h1>
        <p className="text-gray-500 text-sm">Level: {lesson.difficulty_level} • {totalItems} items</p>
      </div>

      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Progress</span>
          <span>{completedItems}/{totalItems}</span>
        </div>
        <div className="bg-gray-200 rounded-full h-3">
          <div
            className="bg-indigo-500 h-3 rounded-full transition-all duration-300"
            style={{ width: `${(completedItems / totalItems) * 100}%` }}
          />
        </div>
      </div>

      {/* Section indicator */}
      <div className="flex gap-2 mb-6">
        <div className={`px-4 py-2 rounded-lg text-sm font-medium ${
          currentSection === 'grammar' ? 'bg-purple-500 text-white' : 'bg-gray-100 text-gray-400'
        }`}>
          ✏️ Grammar ({exercises.length})
        </div>
        <div className={`px-4 py-2 rounded-lg text-sm font-medium ${
          currentSection === 'vocabulary' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-400'
        }`}>
          📖 Vocabulary ({vocab.length})
        </div>
        <div className={`px-4 py-2 rounded-lg text-sm font-medium ${
          currentSection === 'speaking' ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-400'
        }`}>
          🗣️ Speaking ({speaking.length})
        </div>
      </div>

      {/* Exercise Card */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">

        {/* GRAMMAR SECTION */}
        {currentSection === 'grammar' && exercises[currentExercise] && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="bg-purple-100 text-purple-700 text-xs font-semibold px-2 py-1 rounded">
                GRAMMAR — Question {currentExercise + 1} of {exercises.length}
              </span>
            </div>

            <p className="text-lg text-gray-800 mb-6">{exercises[currentExercise].instruction}</p>

            {!feedback && (
              <>
                <input
                  type="text"
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  placeholder="Type your answer here..."
                  className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 mb-4 focus:outline-none focus:border-indigo-500 text-lg"
                  onKeyDown={(e) => e.key === 'Enter' && userAnswer.trim() && checkAnswer()}
                  autoFocus
                />
                <button
                  onClick={checkAnswer}
                  disabled={!userAnswer.trim()}
                  className="bg-purple-500 text-white px-6 py-3 rounded-lg hover:bg-purple-600 disabled:opacity-50 font-medium"
                >
                  Check Answer
                </button>
              </>
            )}

            {feedback && (
              <div className="mt-4">
                <p className="text-lg whitespace-pre-wrap mb-4">{feedback}</p>
                <button
                  onClick={nextItem}
                  className="bg-indigo-500 text-white px-6 py-3 rounded-lg hover:bg-indigo-600 font-medium"
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        )}

        {/* VOCABULARY SECTION */}
        {currentSection === 'vocabulary' && vocab[currentExercise] && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="bg-green-100 text-green-700 text-xs font-semibold px-2 py-1 rounded">
                VOCABULARY — Word {currentExercise + 1} of {vocab.length}
              </span>
            </div>

            <div className="text-center py-4">
              <p className="text-3xl font-bold text-gray-800 mb-6">
                {vocab[currentExercise].word}
              </p>

              {!showMeaning ? (
                <button
                  onClick={() => setShowMeaning(true)}
                  className="bg-green-500 text-white px-6 py-3 rounded-lg hover:bg-green-600 font-medium"
                >
                  Show Meaning 👀
                </button>
              ) : (
                <div className="text-left bg-green-50 rounded-lg p-4 mb-6">
                  <p className="text-gray-700 mb-2">
                    <span className="font-semibold">Meaning:</span> {vocab[currentExercise].meaning}
                  </p>
                  <p className="text-gray-600 italic">
                    <span className="font-semibold not-italic">Example:</span> "{vocab[currentExercise].example}"
                  </p>
                </div>
              )}

              {showMeaning && (
                <button
                  onClick={nextItem}
                  className="bg-indigo-500 text-white px-6 py-3 rounded-lg hover:bg-indigo-600 font-medium"
                >
                  Got it! Next Word →
                </button>
              )}
            </div>
          </div>
        )}

        {/* SPEAKING SECTION */}
        {currentSection === 'speaking' && speaking[currentExercise] && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="bg-orange-100 text-orange-700 text-xs font-semibold px-2 py-1 rounded">
                SPEAKING — Prompt {currentExercise + 1} of {speaking.length}
              </span>
            </div>

            <div className="text-center py-4">
              <p className="text-4xl mb-6">🗣️</p>
              <p className="text-lg text-gray-800 mb-6">{speaking[currentExercise]}</p>
              <p className="text-sm text-gray-500 mb-6">
                Practice speaking this out loud. Take your time, then click "Done" when finished.
              </p>
              <button
                onClick={() => { setTotalAttempted(t => t + 1); setCorrectCount(c => c + 1); nextItem(); }}
                className="bg-orange-500 text-white px-6 py-3 rounded-lg hover:bg-orange-600 font-medium"
              >
                Done Speaking ✓ Next →
              </button>
            </div>
          </div>
        )}

        {/* Empty state */}
        {currentSection === 'grammar' && exercises.length === 0 && (
          <div className="text-center py-6">
            <p className="text-gray-500">No grammar exercises. Moving to vocabulary...</p>
            <button onClick={() => { setCurrentSection('vocabulary'); setCurrentExercise(0); }} className="mt-4 bg-indigo-500 text-white px-4 py-2 rounded-lg">
              Continue
            </button>
          </div>
        )}
        {currentSection === 'vocabulary' && vocab.length === 0 && (
          <div className="text-center py-6">
            <p className="text-gray-500">No vocabulary words. Moving to speaking...</p>
            <button onClick={() => { setCurrentSection('speaking'); setCurrentExercise(0); }} className="mt-4 bg-indigo-500 text-white px-4 py-2 rounded-lg">
              Continue
            </button>
          </div>
        )}
        {currentSection === 'speaking' && speaking.length === 0 && (
          <div className="text-center py-6">
            <p className="text-gray-500">No speaking prompts.</p>
            <button onClick={finishLesson} className="mt-4 bg-indigo-500 text-white px-4 py-2 rounded-lg">
              Finish Lesson
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default Learn
