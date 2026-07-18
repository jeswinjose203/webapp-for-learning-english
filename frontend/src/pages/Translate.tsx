import { useState, useEffect, useRef } from 'react'
import { sendMessage } from '../services/api'
import useSpeechRecognition from '../hooks/useSpeechRecognition'
import useTextToSpeech from '../hooks/useTextToSpeech'

interface TranslationEntry {
  id: number
  original: string
  language: string
  translation: string
  pronunciation_tip?: string
  direction: 'to-english' | 'from-english'
}

const LANGUAGES = [
  { code: 'ml-IN', label: 'Malayalam', name: 'malayalam' },
  { code: 'hi-IN', label: 'Hindi', name: 'hindi' },
  { code: 'ta-IN', label: 'Tamil', name: 'tamil' },
  { code: 'te-IN', label: 'Telugu', name: 'telugu' },
  { code: 'kn-IN', label: 'Kannada', name: 'kannada' },
  { code: 'bn-IN', label: 'Bengali', name: 'bengali' },
  { code: 'mr-IN', label: 'Marathi', name: 'marathi' },
  { code: 'gu-IN', label: 'Gujarati', name: 'gujarati' },
  { code: 'pa-IN', label: 'Punjabi', name: 'punjabi' },
  { code: 'ur-IN', label: 'Urdu', name: 'urdu' },
  { code: 'es-ES', label: 'Spanish', name: 'spanish' },
  { code: 'fr-FR', label: 'French', name: 'french' },
  { code: 'ar-SA', label: 'Arabic', name: 'arabic' },
  { code: 'ja-JP', label: 'Japanese', name: 'japanese' },
  { code: 'ko-KR', label: 'Korean', name: 'korean' },
  { code: 'zh-CN', label: 'Chinese', name: 'chinese' },
]

function Translate() {
  const [selectedLang, setSelectedLang] = useState(LANGUAGES[0])
  const [entries, setEntries] = useState<TranslationEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [inputText, setInputText] = useState('')
  const [mode, setMode] = useState<'speak' | 'type'>('speak')
  const [direction, setDirection] = useState<'to-english' | 'from-english'>('to-english')
  const entriesEndRef = useRef<HTMLDivElement>(null)

  const { isListening, transcript, interimText, error: micError, startListening, stopListening, resetTranscript } = useSpeechRecognition()
  const { speak } = useTextToSpeech()

  // Override speech recognition language
  const startListeningInLanguage = () => {
    resetTranscript()
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) return

    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = true
    // Use selected language when translating TO English, use English when translating FROM English
    recognition.lang = direction === 'to-english' ? selectedLang.code : 'en-US'

    recognition.onresult = (event: any) => {
      let final = ''
      let interim = ''
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript
        } else {
          interim += event.results[i][0].transcript
        }
      }
      if (final) {
        setInputText(final)
        handleTranslate(final)
      } else {
        setInputText(interim)
      }
    }

    recognition.onerror = () => {}
    recognition.onend = () => {}

    recognition.start()
  }

  useEffect(() => {
    entriesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [entries])

  const handleTranslate = async (text: string) => {
    if (!text.trim()) return
    setLoading(true)

    let prompt: string

    if (direction === 'to-english') {
      prompt = `The student spoke in ${selectedLang.label} and said: "${text}"

Translate this to English and help them learn how to say it in English.

Respond in this JSON format:
{
  "reply": "Here's how to say that in English: [translation]. [brief explanation of grammar/structure]",
  "corrections": [],
  "new_words": [{"word": "key English word", "meaning": "meaning in context", "example": "example sentence"}],
  "pronunciation_tip": "how to pronounce the English translation",
  "follow_up": "Now try saying it in English!",
  "xp_earned": 10,
  "encouragement": "Great effort!"
}`
    } else {
      prompt = `The student wants to know how to say this English phrase in ${selectedLang.label}: "${text}"

Translate this to ${selectedLang.label} and help them understand it.

Respond in this JSON format:
{
  "reply": "In ${selectedLang.label}: [translation in ${selectedLang.label} script]. [brief explanation of how the sentence works in ${selectedLang.label}]",
  "corrections": [],
  "new_words": [{"word": "key word in ${selectedLang.label}", "meaning": "meaning in English", "example": "example usage"}],
  "pronunciation_tip": "how to pronounce it in ${selectedLang.label}",
  "follow_up": "Try using this in a sentence!",
  "xp_earned": 10,
  "encouragement": "Great effort!"
}`
    }

    try {
      const res = await sendMessage(prompt, "translate")

      const entry: TranslationEntry = {
        id: Date.now(),
        original: text,
        language: selectedLang.label,
        translation: res.data.reply,
        pronunciation_tip: res.data.pronunciation_tip,
        direction: direction,
      }
      setEntries(prev => [...prev, entry])

      // Speak the translation
      if (direction === 'to-english') {
        speak(res.data.reply) // Speak English
      }
      // For from-english, we can't reliably speak in regional language with browser TTS
    } catch (err) {
      const entry: TranslationEntry = {
        id: Date.now(),
        original: text,
        language: selectedLang.label,
        translation: '⚠️ Failed to translate. Check if backend is running and API key has credits.',
        direction: direction,
      }
      setEntries(prev => [...prev, entry])
    } finally {
      setLoading(false)
      setInputText('')
    }
  }

  const handleManualSubmit = () => {
    if (inputText.trim()) {
      handleTranslate(inputText.trim())
    }
  }

  return (
    <div className="max-w-3xl mx-auto h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-800">🌐 Translation Practice</h1>
        <p className="text-gray-600 text-sm">Speak in your language → Learn how to say it in English</p>
      </div>

      {/* Language Selector */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-4">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 mb-1">
              {direction === 'to-english' ? 'I speak in:' : 'Translate to:'}
            </label>
            <select
              value={selectedLang.code}
              onChange={(e) => {
                const lang = LANGUAGES.find(l => l.code === e.target.value)
                if (lang) setSelectedLang(lang)
              }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>{lang.label}</option>
              ))}
            </select>
          </div>

          {/* Swap button */}
          <button
            onClick={() => setDirection(d => d === 'to-english' ? 'from-english' : 'to-english')}
            className="mt-4 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 w-10 h-10 rounded-full flex items-center justify-center transition-colors"
            title="Swap direction"
          >
            ⇄
          </button>

          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 mb-1">
              {direction === 'to-english' ? 'Translate to:' : 'I speak in:'}
            </label>
            <div className="border border-gray-300 rounded-lg px-3 py-2 bg-gray-50 text-gray-700">
              {direction === 'to-english' ? '🇬🇧 English' : '🇬🇧 English'}
            </div>
          </div>
        </div>

        <p className="text-xs text-center text-gray-400 mt-2">
          {direction === 'to-english'
            ? `${selectedLang.label} → English (Learn how to say it in English)`
            : `English → ${selectedLang.label} (Learn how to say it in ${selectedLang.label})`
          }
        </p>
      </div>

      {/* Mode Toggle */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setMode('speak')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            mode === 'speak' ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-600'
          }`}
        >
          🎤 Speak
        </button>
        <button
          onClick={() => setMode('type')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            mode === 'type' ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-600'
          }`}
        >
          ⌨️ Type
        </button>
      </div>

      {/* Translation History */}
      <div className="flex-1 overflow-y-auto bg-gray-50 rounded-xl p-4 mb-4 border border-gray-100">
        {entries.length === 0 && (
          <div className="text-center text-gray-500 py-10">
            <p className="text-4xl mb-3">🌐</p>
            <p className="font-medium">
              {direction === 'to-english'
                ? `Say something in ${selectedLang.label}!`
                : 'Say something in English!'
              }
            </p>
            <p className="text-sm mt-1">
              {direction === 'to-english'
                ? "I'll teach you how to say it in English."
                : `I'll show you how to say it in ${selectedLang.label}.`
              }
            </p>
            <p className="text-xs mt-3 text-gray-400">
              {mode === 'speak' ? 'Click the mic button below and speak' : 'Type below and hit Translate'}
            </p>
          </div>
        )}

        {entries.map((entry) => (
          <div key={entry.id} className="mb-4">
            {/* User's original text */}
            <div className="flex justify-end mb-2">
              <div className="bg-indigo-100 rounded-xl px-4 py-2 max-w-[80%]">
                <p className="text-xs text-indigo-500 font-medium mb-1">{entry.language}</p>
                <p className="text-gray-800">{entry.original}</p>
              </div>
            </div>
            {/* AI translation */}
            <div className="flex justify-start">
              <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 max-w-[80%] shadow-sm">
                <p className="text-xs text-green-600 font-medium mb-1">English Translation</p>
                <p className="text-gray-800 text-sm">{entry.translation}</p>
                {entry.pronunciation_tip && (
                  <p className="text-xs text-gray-500 mt-2 italic">🔊 {entry.pronunciation_tip}</p>
                )}
                <button
                  onClick={() => speak(entry.translation)}
                  className="text-xs text-indigo-500 hover:text-indigo-700 mt-2 flex items-center gap-1"
                >
                  🔊 Listen in English
                </button>
              </div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start mb-4">
            <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm">
              <p className="text-sm text-gray-500 animate-pulse">Translating...</p>
            </div>
          </div>
        )}

        <div ref={entriesEndRef} />
      </div>

      {/* Input Area */}
      {micError && <p className="text-red-500 text-xs mb-2">{micError}</p>}

      <div className="flex gap-2">
        {mode === 'speak' ? (
          <>
            <button
              onClick={startListeningInLanguage}
              className="px-6 py-3 rounded-lg font-medium bg-red-500 text-white hover:bg-red-600 transition-all"
            >
              🎤 Speak in {direction === 'to-english' ? selectedLang.label : 'English'}
            </button>
            {inputText && (
              <div className="flex-1 border border-gray-300 rounded-lg px-4 py-3 bg-gray-50 text-gray-600 italic">
                {inputText}
              </div>
            )}
          </>
        ) : (
          <>
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={direction === 'to-english' ? `Type in ${selectedLang.label}...` : 'Type in English...'}
              className="flex-1 border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
              disabled={loading}
            />
            <button
              onClick={handleManualSubmit}
              disabled={loading || !inputText.trim()}
              className="bg-indigo-500 text-white px-6 py-3 rounded-lg hover:bg-indigo-600 disabled:opacity-50 transition-colors"
            >
              Translate
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default Translate
