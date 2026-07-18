import { useEffect, useState } from 'react'
import ProgressBar from '../components/ProgressBar'
import { getCurrentProgress, getWeaknesses } from '../services/api'

interface ProgressData {
  grammar_score: number
  vocabulary_score: number
  speaking_score: number
  listening_score: number
  pronunciation_score: number
  confidence_score: number
  overall_score: number
  current_level: string
  weaknesses: string[]
  total_words_learned: number
  total_lessons_completed: number
  total_mistakes_tracked: number
  mistakes_resolved: number
}

interface Weakness {
  error_type: string
  example: string
  correction: string
  times_made: number
}

function Progress() {
  const [progress, setProgress] = useState<ProgressData | null>(null)
  const [weaknesses, setWeaknesses] = useState<{ grammar_weaknesses: Weakness[] } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [progressRes, weaknessRes] = await Promise.all([
          getCurrentProgress(),
          getWeaknesses(),
        ])
        setProgress(progressRes.data)
        setWeaknesses(weaknessRes.data)
      } catch (err) {
        console.error('Failed to fetch progress:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) {
    return <div className="text-center py-10 text-gray-500">Loading your progress...</div>
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Your Progress</h1>

      {/* Level & Overall */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-6 text-white">
          <h2 className="text-sm opacity-80 mb-1">Current Level</h2>
          <p className="text-4xl font-bold">{progress?.current_level || 'A1'}</p>
          <p className="text-sm opacity-80 mt-2">Overall: {Math.round(progress?.overall_score || 0)}%</p>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-sm text-gray-500 mb-2">Confidence Score</h2>
          <p className="text-4xl font-bold text-green-500">{Math.round(progress?.confidence_score || 0)}%</p>
          <p className="text-sm text-gray-500 mt-2">Keep practicing!</p>
        </div>
      </div>

      {/* Skills */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-8">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Skill Breakdown</h2>
        <ProgressBar label="Grammar" value={progress?.grammar_score || 0} color="bg-purple-500" />
        <ProgressBar label="Vocabulary" value={progress?.vocabulary_score || 0} color="bg-green-500" />
        <ProgressBar label="Speaking" value={progress?.speaking_score || 0} color="bg-orange-500" />
        <ProgressBar label="Listening" value={progress?.listening_score || 0} color="bg-blue-500" />
        <ProgressBar label="Pronunciation" value={progress?.pronunciation_score || 0} color="bg-pink-500" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
          <p className="text-2xl font-bold text-indigo-600">{progress?.total_words_learned || 0}</p>
          <p className="text-sm text-gray-500">Words Learned</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
          <p className="text-2xl font-bold text-green-600">{progress?.total_lessons_completed || 0}</p>
          <p className="text-sm text-gray-500">Lessons Done</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
          <p className="text-2xl font-bold text-orange-600">{progress?.total_mistakes_tracked || 0}</p>
          <p className="text-sm text-gray-500">Mistakes Tracked</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
          <p className="text-2xl font-bold text-purple-600">{progress?.mistakes_resolved || 0}</p>
          <p className="text-sm text-gray-500">Mistakes Fixed</p>
        </div>
      </div>

      {/* Weaknesses */}
      {weaknesses?.grammar_weaknesses && weaknesses.grammar_weaknesses.length > 0 && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Areas to Improve</h2>
          <div className="space-y-3">
            {weaknesses.grammar_weaknesses.map((w, i) => (
              <div key={i} className="bg-red-50 rounded-lg p-3">
                <p className="text-sm text-gray-800">
                  <span className="font-medium">{w.error_type}:</span>{' '}
                  <span className="line-through text-red-600">{w.example}</span>
                  {' → '}
                  <span className="text-green-600">{w.correction}</span>
                </p>
                <p className="text-xs text-gray-500 mt-1">Made {w.times_made} time(s)</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default Progress
