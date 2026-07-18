import { useEffect, useState, useRef } from 'react'
import { sendMessage, getChatHistory } from '../services/api'
import ChatBubble from '../components/ChatBubble'
import useSpeechRecognition from '../hooks/useSpeechRecognition'
import useTextToSpeech from '../hooks/useTextToSpeech'

interface Message {
  id: number
  role: 'user' | 'ai'
  message: string
  corrections?: Array<{
    original: string
    corrected: string
    explanation: string
  }>
  xp_earned?: number
}

function Chat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<string>('chat')
  const [totalXp, setTotalXp] = useState(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const { isListening, transcript, interimText, error: micError, startListening, stopListening, resetTranscript, onSpeechEnd } = useSpeechRecognition()
  const { speak, stop: stopSpeaking } = useTextToSpeech()

  const doSendRef = useRef<(text: string) => void>(() => {})

  // When speech recognition ends (user stopped talking), auto-send
  useEffect(() => {
    onSpeechEnd.current = (finalText: string) => {
      if (finalText) {
        doSendRef.current(finalText)
      }
    }
  }, [])

  useEffect(() => {
    fetchHistory()
  }, [mode])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Show transcript in input as user speaks
  useEffect(() => {
    if (transcript) {
      setInput(transcript)
    }
  }, [transcript])

  const fetchHistory = async () => {
    try {
      const res = await getChatHistory(50, mode)
      if (res.data && Array.isArray(res.data)) {
        const mapped = res.data.map((msg: any) => ({
          id: msg.id,
          role: msg.role,
          message: msg.message,
          corrections: msg.corrections || [],
        }))
        setMessages(mapped)
      }
    } catch (err) {
      console.error('Failed to fetch chat history:', err)
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleSend = async () => {
    if (!input.trim() || loading) return
    const userMessage = input.trim()
    setInput('')
    resetTranscript()
    if (isListening) stopListening()
    await doSend(userMessage)
  }

  const doSend = async (userMessage: string) => {
    setLoading(true)
    setInput('')
    resetTranscript()

    const tempUserMsg: Message = { id: Date.now(), role: 'user', message: userMessage }
    setMessages(prev => [...prev, tempUserMsg])

    try {
      // Detect if message contains non-English text
      const hasNonEnglish = /[^\x00-\x7F]/.test(userMessage)
      let messageToSend = userMessage

      if (hasNonEnglish) {
        messageToSend = `[The student wrote this message which contains non-English text: "${userMessage}"]. Please translate any non-English parts to English, show the translation, and then respond normally. Help them learn how to say it in English.`
      }

      const res = await sendMessage(messageToSend, mode)

      setMessages(prev => [
        ...prev.filter(m => m.id !== tempUserMsg.id),
        { id: tempUserMsg.id, role: 'user', message: userMessage },
        {
          id: Date.now() + 1,
          role: 'ai',
          message: res.data.reply,
          corrections: res.data.corrections,
          xp_earned: res.data.xp_earned,
        },
      ])

      // Speak the AI response
      speak(res.data.reply)
      setTotalXp(prev => prev + (res.data.xp_earned || 0))
    } catch (err) {
      console.error('Failed to send message:', err)
      setMessages(prev => [
        ...prev,
        { id: Date.now() + 1, role: 'ai', message: '⚠️ Failed to get response. Check backend and API key.' },
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleVoiceToggle = () => {
    if (isListening) {
      stopListening()
      // stopListening will trigger onend → onSpeechEnd callback → auto-sends
    } else {
      resetTranscript()
      setInput('')
      startListening('en-IN')
    }
  }

  // Keep ref updated so the speech callback always has the latest doSend
  doSendRef.current = doSend

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-4 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Chat with AI Tutor</h1>
          <p className="text-gray-600 text-sm">Speak or type — get instant corrections and learn naturally.</p>
        </div>
        <div className="text-sm font-bold text-indigo-600"></div>
      </div>

      {/* Mode Selector */}
      <div className="flex gap-2 mb-4">
        {[
          { id: 'chat', label: '💬 Chat', desc: 'Free conversation' },
          { id: 'grammar_check', label: '✏️ Grammar', desc: 'Detailed grammar focus' },
          { id: 'vocabulary', label: '📖 Vocab', desc: 'Learn new words each time' },
          { id: 'story', label: '📝 Story', desc: 'Write a story together' },
        ].map((m) => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
              mode === m.id
                ? 'bg-indigo-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            title={m.desc}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto bg-gray-100 rounded-xl p-4 mb-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 py-10">
            <p className="text-4xl mb-2">🎓</p>
            <p className="font-medium">Hi! I'm your English tutor.</p>
            <p className="text-sm mt-1">
              {mode === 'chat' && 'Start talking or typing. I\'ll help you improve!'}
              {mode === 'grammar_check' && 'Write a sentence and I\'ll check every grammar detail.'}
              {mode === 'vocabulary' && 'Let\'s learn new words! Say anything to begin.'}
              {mode === 'story' && 'Let\'s write a story together! Start with an opening sentence.'}
            </p>
            <p className="text-xs mt-2 text-gray-400">Click 🎤 to speak — auto-sends when you stop talking</p>
          </div>
        )}

        {messages.map((msg) => (
          <ChatBubble
            key={msg.id}
            role={msg.role}
            message={msg.message}
            corrections={msg.corrections}
            onSpeak={() => speak(msg.message)}
          />
        ))}

        {loading && (
          <div className="flex justify-start mb-4">
            <div className="bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-200">
              <p className="text-sm text-gray-500 animate-pulse">Thinking...</p>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Listening indicator */}
      {isListening && (
        <div className="flex items-center gap-2 mb-2 px-2">
          <span className="inline-block w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
          <span className="text-xs text-red-600 font-medium">Listening... (sends when you stop talking)</span>
          {interimText && <span className="text-xs text-gray-400 italic truncate max-w-[200px]">{interimText}</span>}
        </div>
      )}

      {/* Mic Error */}
      {micError && <p className="text-red-500 text-xs mb-2">{micError}</p>}

      {/* Input Area */}
      <div className="flex gap-2">
        <button
          onClick={handleVoiceToggle}
          className={`px-4 py-3 rounded-lg font-medium transition-all ${
            isListening
              ? 'bg-red-500 text-white animate-pulse'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
          title={isListening ? 'Stop & send' : 'Start speaking'}
        >
          {isListening ? '⏹️' : '🎤'}
        </button>

        <input
          type="text"
          value={isListening ? (transcript + (interimText ? ' ' + interimText : '')) : input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={isListening ? '🎤 Listening...' : 'Type or speak your message...'}
          className="flex-1 border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          disabled={loading || isListening}
        />

        <button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          className="bg-indigo-500 text-white px-6 py-3 rounded-lg hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Send
        </button>

        <button
          onClick={stopSpeaking}
          className="px-4 py-3 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300"
          title="Stop AI speaking"
        >
          🔇
        </button>
      </div>
    </div>
  )
}

export default Chat
