import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import ProgressBar from '../components/ProgressBar'
import { getStudentProfile, getCurrentProgress } from '../services/api'

interface StudentData {
  name: string
  current_level: string
  grammar_score: number
  vocabulary_score: number
  speaking_score: number
  overall_score: number
  weaknesses: string[]
  xp_total: number
  xp_today: number
  streak_days: number
  achievements: string[]
  total_words_learned: number
  total_lessons_completed: number
}

const ACHIEVEMENT_INFO: Record<string, { icon: string; label: string }> = {
  first_message: { icon: '💬', label: 'First Message' },
  ten_messages: { icon: '🗣️', label: '10 Messages' },
  fifty_messages: { icon: '🏆', label: '50 Messages' },
  xp_100: { icon: '⭐', label: '100 XP' },
  xp_500: { icon: '🌟', label: '500 XP' },
  streak_7: { icon: '🔥', label: '7-Day Streak' },
  streak_30: { icon: '💎', label: '30-Day Streak' },
}

function Home() {
  const [student, setStudent] = useState<StudentData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [profileRes, progressRes] = await Promise.all([
          getStudentProfile(),
          getCurrentProgress(),
        ])
        setStudent({ ...profileRes.data, ...progressRes.data })
      } catch (err) {
        console.error('Failed to fetch data:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) {
    return <div className="text-center py-10 text-gray-500">Loading...</div>
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Welcome + Streak */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">
            Welcome back, {student?.name || 'Learner'}! 👋
          </h1>
          <p className="text-gray-600 mt-1">
            Level: <span className="font-semibold text-indigo-600">{student?.current_level || 'A1'}</span>
          </p>
        </div>
        <div className="text-right">
          <div className="bg-orange-100 rounded-lg px-4 py-2 inline-block">
            <span className="text-2xl">🔥</span>
            <span className="text-xl font-bold text-orange-600 ml-1">{student?.streak_days || 0}</span>
            <p className="text-xs text-orange-600">day streak</p>
          </div>
        </div>
      </div>

      {/* XP + Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-5 text-white">
          <h3 className="text-sm opacity-80 mb-1">Total XP</h3>
          <p className="text-3xl font-bold">{student?.xp_total || 0}</p>
          <p className="text-xs opacity-70 mt-1">+{student?.xp_today || 0} today</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h3 className="text-sm text-gray-500 mb-1">Overall Progress</h3>
          <p className="text-3xl font-bold text-indigo-600">{Math.round(student?.overall_score || 0)}%</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h3 className="text-sm text-gray-500 mb-1">Words Learned</h3>
          <p className="text-3xl font-bold text-green-600">{student?.total_words_learned || 0}</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h3 className="text-sm text-gray-500 mb-1">Lessons Done</h3>
          <p className="text-3xl font-bold text-purple-600">{student?.total_lessons_completed || 0}</p>
        </div>
      </div>

      {/* Skill Progress */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-8">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Your Skills</h2>
        <ProgressBar label="Grammar" value={student?.grammar_score || 0} color="bg-purple-500" />
        <ProgressBar label="Vocabulary" value={student?.vocabulary_score || 0} color="bg-green-500" />
        <ProgressBar label="Speaking" value={student?.speaking_score || 0} color="bg-orange-500" />
      </div>

      {/* Achievements */}
      {student?.achievements && student.achievements.length > 0 && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">🏅 Achievements</h2>
          <div className="flex flex-wrap gap-3">
            {student.achievements.map((a) => (
              <div
                key={a}
                className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 text-sm flex items-center gap-2"
              >
                <span>{ACHIEVEMENT_INFO[a]?.icon || '🏅'}</span>
                <span className="font-medium text-gray-700">{ACHIEVEMENT_INFO[a]?.label || a}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          to="/learn"
          className="bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl p-6 transition-colors"
        >
          <h3 className="text-lg font-semibold mb-2">📚 Today's Lesson</h3>
          <p className="text-indigo-100 text-sm">AI-generated lesson just for you.</p>
        </Link>
        <Link
          to="/call"
          className="bg-green-500 hover:bg-green-600 text-white rounded-xl p-6 transition-colors"
        >
          <h3 className="text-lg font-semibold mb-2">📞 Call Tutor</h3>
          <p className="text-green-100 text-sm">Live voice conversation with AI.</p>
        </Link>
        <Link
          to="/chat"
          className="bg-purple-500 hover:bg-purple-600 text-white rounded-xl p-6 transition-colors"
        >
          <h3 className="text-lg font-semibold mb-2">💬 Text Chat</h3>
          <p className="text-purple-100 text-sm">Type or speak — grammar, vocab, stories.</p>
        </Link>
      </div>
    </div>
  )
}

export default Home
