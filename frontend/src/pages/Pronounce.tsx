import { useState } from 'react'
import useTextToSpeech from '../hooks/useTextToSpeech'

function Pronounce() {
  const [inputText, setInputText] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [speed, setSpeed] = useState(0.8)
  const { speak, stop, voices, selectedVoice, setSelectedVoice } = useTextToSpeech()

  const handleSpeak = (text?: string) => {
    const toSpeak = text || inputText.trim()
    if (!toSpeak) return

    speak(toSpeak)

    // Add to history if not already there
    if (!history.includes(toSpeak)) {
      setHistory(prev => [toSpeak, ...prev].slice(0, 20))
    }
  }

  const handleSpeakSlow = (text?: string) => {
    const toSpeak = text || inputText.trim()
    if (!toSpeak) return

    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(toSpeak)
    utterance.lang = 'en-US'
    utterance.rate = 0.5 // Very slow
    utterance.pitch = 1.0

    const allVoices = window.speechSynthesis.getVoices()
    const voice = allVoices.find((v) => v.voiceURI === selectedVoice)
    if (voice) utterance.voice = voice

    window.speechSynthesis.speak(utterance)
  }

  const handleSpeakByWord = (text?: string) => {
    const toSpeak = text || inputText.trim()
    if (!toSpeak) return

    const words = toSpeak.split(/\s+/)
    let delay = 0

    words.forEach((word, i) => {
      setTimeout(() => {
        if (!('speechSynthesis' in window)) return
        const utterance = new SpeechSynthesisUtterance(word)
        utterance.lang = 'en-US'
        utterance.rate = 0.7
        const allVoices = window.speechSynthesis.getVoices()
        const voice = allVoices.find((v) => v.voiceURI === selectedVoice)
        if (voice) utterance.voice = voice
        window.speechSynthesis.speak(utterance)
      }, delay)
      delay += 1000 // 1 second between words
    })
  }

  // Common phrases for quick practice
  const quickPhrases = [
    "Hello, how are you?",
    "My name is",
    "Where is the nearest hospital?",
    "I would like to order food",
    "Thank you very much",
    "Could you please repeat that?",
    "I don't understand",
    "What time is it?",
    "How much does this cost?",
    "Nice to meet you",
  ]

  // Tongue twisters for pronunciation practice
  const tongueTwisters = [
    "She sells seashells by the seashore",
    "Peter Piper picked a peck of pickled peppers",
    "How much wood would a woodchuck chuck",
    "Red lorry, yellow lorry",
    "Unique New York",
    "Toy boat, toy boat, toy boat",
    "The thirty-three thieves thought that they thrilled the throne",
  ]

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">🔊 Pronunciation Practice</h1>
        <p className="text-gray-600 text-sm">Type any word or sentence — hear exactly how it's pronounced</p>
      </div>

      {/* Main Input */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-6">
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Type a word, phrase, or sentence..."
          className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 focus:outline-none focus:border-indigo-500 text-lg resize-none h-24"
        />

        {/* Speak buttons */}
        <div className="flex flex-wrap gap-2 mt-4">
          <button
            onClick={() => handleSpeak()}
            disabled={!inputText.trim()}
            className="bg-indigo-500 text-white px-5 py-2.5 rounded-lg hover:bg-indigo-600 disabled:opacity-50 font-medium flex items-center gap-2"
          >
            🔊 Speak Normal
          </button>
          <button
            onClick={() => handleSpeakSlow()}
            disabled={!inputText.trim()}
            className="bg-green-500 text-white px-5 py-2.5 rounded-lg hover:bg-green-600 disabled:opacity-50 font-medium flex items-center gap-2"
          >
            🐢 Speak Slow
          </button>
          <button
            onClick={() => handleSpeakByWord()}
            disabled={!inputText.trim()}
            className="bg-orange-500 text-white px-5 py-2.5 rounded-lg hover:bg-orange-600 disabled:opacity-50 font-medium flex items-center gap-2"
          >
            📝 Word by Word
          </button>
          <button
            onClick={stop}
            className="bg-gray-200 text-gray-700 px-5 py-2.5 rounded-lg hover:bg-gray-300 font-medium"
          >
            ⏹️ Stop
          </button>
        </div>

        {/* Speed control */}
        <div className="mt-4 flex items-center gap-3">
          <span className="text-xs text-gray-500">Voice:</span>
          <select
            value={selectedVoice}
            onChange={(e) => setSelectedVoice(e.target.value)}
            className="text-xs border border-gray-200 rounded px-2 py-1 max-w-[200px]"
          >
            {voices.map((v) => (
              <option key={v.id} value={v.id}>{v.name.slice(0, 30)}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Quick Phrases */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">💡 Common Phrases</h2>
        <p className="text-xs text-gray-500 mb-3">Click any phrase to hear its pronunciation</p>
        <div className="flex flex-wrap gap-2">
          {quickPhrases.map((phrase, i) => (
            <button
              key={i}
              onClick={() => { setInputText(phrase); handleSpeak(phrase); }}
              className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-2 rounded-lg text-sm transition-colors"
            >
              {phrase}
            </button>
          ))}
        </div>
      </div>

      {/* Tongue Twisters */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">👅 Tongue Twisters</h2>
        <p className="text-xs text-gray-500 mb-3">Practice these for better pronunciation fluency</p>
        <div className="space-y-2">
          {tongueTwisters.map((twister, i) => (
            <div
              key={i}
              className="flex items-center justify-between bg-purple-50 rounded-lg px-4 py-3 hover:bg-purple-100 transition-colors"
            >
              <p className="text-sm text-gray-800 flex-1">{twister}</p>
              <div className="flex gap-1 ml-3">
                <button
                  onClick={() => handleSpeak(twister)}
                  className="text-xs bg-purple-200 hover:bg-purple-300 text-purple-700 px-2 py-1 rounded"
                  title="Normal speed"
                >
                  🔊
                </button>
                <button
                  onClick={() => handleSpeakSlow(twister)}
                  className="text-xs bg-green-200 hover:bg-green-300 text-green-700 px-2 py-1 rounded"
                  title="Slow speed"
                >
                  🐢
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">🕐 Recent</h2>
          <div className="space-y-1">
            {history.map((text, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-2 px-3 rounded hover:bg-gray-50 cursor-pointer"
                onClick={() => { setInputText(text); handleSpeak(text); }}
              >
                <span className="text-sm text-gray-700 truncate flex-1">{text}</span>
                <span className="text-gray-400 text-xs ml-2">🔊</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default Pronounce
