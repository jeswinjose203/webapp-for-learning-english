import { useEffect, useState } from 'react'
import { getStudentProfile, updateStudentProfile } from '../services/api'
import useTextToSpeech from '../hooks/useTextToSpeech'

interface Student {
  id: number
  name: string
  native_language: string
  current_level: string
}

const LANGUAGES = [
  'unknown', 'hindi', 'spanish', 'chinese', 'arabic', 'portuguese',
  'russian', 'japanese', 'korean', 'french', 'german', 'tamil',
  'telugu', 'malayalam', 'bengali', 'urdu',
]

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

function Settings() {
  const [student, setStudent] = useState<Student | null>(null)
  const [name, setName] = useState('')
  const [nativeLanguage, setNativeLanguage] = useState('unknown')
  const [level, setLevel] = useState('A1')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const { speak, voices, selectedVoice, setSelectedVoice, speed, setSpeed, useAIVoice, setUseAIVoice } = useTextToSpeech()

  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    try {
      const res = await getStudentProfile()
      setStudent(res.data)
      setName(res.data.name)
      setNativeLanguage(res.data.native_language)
      setLevel(res.data.current_level)
    } catch (err) {
      console.error('Failed to fetch profile:', err)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)
    try {
      await updateStudentProfile({
        name,
        native_language: nativeLanguage,
        current_level: level,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      console.error('Failed to save:', err)
    } finally {
      setSaving(false)
    }
  }

  const testVoice = () => {
    speak('Hello! I am your English tutor. Let me help you improve your pronunciation.')
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Settings</h1>

      {/* Profile Settings */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">👤 Profile</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Native Language</label>
            <select
              value={nativeLanguage}
              onChange={(e) => setNativeLanguage(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang} value={lang}>
                  {lang === 'unknown' ? 'Select your language' : lang.charAt(0).toUpperCase() + lang.slice(1)}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Helps the AI give pronunciation tips specific to your language.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Current Level</label>
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {LEVELS.map((lvl) => (
                <option key={lvl} value={lvl}>
                  {lvl} - {getLevelDescription(lvl)}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              This auto-updates as you improve, but you can set it manually too.
            </p>
          </div>

          <div className="pt-4 flex items-center gap-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-indigo-500 text-white px-6 py-2 rounded-lg hover:bg-indigo-600 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            {saved && <span className="text-green-600 text-sm">✓ Saved!</span>}
          </div>
        </div>
      </div>

      {/* Voice Settings */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">🔊 AI Voice</h2>

        <div className="space-y-4">
          {/* AI Voice Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">Use AI Voice (OpenAI TTS)</p>
              <p className="text-xs text-gray-500">Natural, human-like voices. Falls back to browser voice if unavailable.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={useAIVoice}
                onChange={(e) => setUseAIVoice(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-indigo-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Voice
            </label>
            <select
              value={selectedVoice}
              onChange={(e) => setSelectedVoice(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {voices.map((voice) => (
                <option key={voice.id} value={voice.id}>
                  {voice.name} — {voice.description}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Speed: {speed.toFixed(1)}x
            </label>
            <input
              type="range"
              min="0.5"
              max="1.5"
              step="0.1"
              value={speed}
              onChange={(e) => setSpeed(parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>Slow (0.5x)</span>
              <span>Normal (1.0x)</span>
              <span>Fast (1.5x)</span>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              💡 Slower speed helps you hear pronunciation clearly.
            </p>
          </div>

          <button
            onClick={testVoice}
            className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors text-sm"
          >
            🔊 Test Voice
          </button>
        </div>
      </div>

      {/* Chat Settings */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">💬 Chat Behavior</h2>

        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            <strong>Auto-send on silence:</strong> When using voice, your message is automatically
            sent after 2 seconds of silence. Toggle this in the chat page header.
          </p>
          <p className="text-sm text-gray-600">
            <strong>Auto-listen after AI response:</strong> After the AI speaks, the mic
            automatically turns back on for continuous conversation.
          </p>
          <p className="text-sm text-gray-600">
            <strong>Modes:</strong>
          </p>
          <ul className="text-sm text-gray-600 list-disc list-inside space-y-1 ml-2">
            <li><strong>Chat</strong> — Free conversation with gentle corrections</li>
            <li><strong>Grammar</strong> — Every error is caught and explained in detail</li>
            <li><strong>Vocabulary</strong> — Learns new words every message (never repeats)</li>
            <li><strong>Story</strong> — Co-write a story while practicing grammar</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

function getLevelDescription(level: string): string {
  const descriptions: Record<string, string> = {
    A1: 'Beginner — Basic words and phrases',
    A2: 'Elementary — Simple conversations',
    B1: 'Intermediate — Handle most situations',
    B2: 'Upper Intermediate — Fluent conversation',
    C1: 'Advanced — Complex topics',
    C2: 'Proficient — Near-native',
  }
  return descriptions[level] || ''
}

export default Settings
