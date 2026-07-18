import { useState, useEffect, useRef } from 'react'
import useTextToSpeech from '../hooks/useTextToSpeech'
import api from '../services/api'

interface Debater {
  id: string
  name: string
  avatar: string
  personality: string
  voice: string
  provider: string
  style: string
  position?: string
}

interface DebateMessage {
  debater_id: string
  debater_name: string
  avatar: string
  message: string
  voice: string
  isUser?: boolean
  isInterruption?: boolean
  corrections?: any[]
}

function Debate() {
  const [phase, setPhase] = useState<'setup' | 'running' | 'ended'>('setup')
  const [topic, setTopic] = useState('')
  const [numDebaters, setNumDebaters] = useState(3)
  const [availableDebaters, setAvailableDebaters] = useState<Debater[]>([])
  const [activeDebaters, setActiveDebaters] = useState<Debater[]>([])
  const [selectedDebaterIds, setSelectedDebaterIds] = useState<string[]>([])
  const [messages, setMessages] = useState<DebateMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [speakingDebater, setSpeakingDebater] = useState<string | null>(null)
  const [userInput, setUserInput] = useState('')
  const [autoPlay, setAutoPlay] = useState(true)
  const [isDebating, setIsDebating] = useState(false)
  const [turnCount, setTurnCount] = useState(0)
  const debateRunningRef = useRef(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { speak, stop: stopSpeaking } = useTextToSpeech()

  useEffect(() => {
    fetchDebaters()
  }, [])

  useEffect(() => {
    // Don't auto-scroll — let user control scrolling
  }, [messages])

  const fetchDebaters = async () => {
    try {
      const res = await api.get('/debate/characters')
      setAvailableDebaters(res.data.debaters)
    } catch (err) {
      console.error('Failed to fetch debaters:', err)
    }
  }

  const startDebate = async () => {
    if (!topic.trim()) return
    setLoading(true)
    setPhase('running')
    setMessages([])
    setTurnCount(0)

    try {
      const res = await api.post('/debate/start', {
        topic: topic.trim(),
        num_debaters: numDebaters,
        debater_ids: selectedDebaterIds.length >= numDebaters ? selectedDebaterIds.slice(0, numDebaters) : null,
      })

      setActiveDebaters(res.data.debaters)
      const debaterIds = res.data.debaters.map((d: any) => d.id)

      setLoading(false)
      setIsDebating(true)
      debateRunningRef.current = true

      // Start the continuous debate loop
      runDebateLoop(res.data.debaters, debaterIds)
    } catch (err) {
      console.error('Failed to start debate:', err)
      setLoading(false)
    }
  }

  const runDebateLoop = async (debaters: Debater[], debaterIds: string[]) => {
    let history: DebateMessage[] = []
    let turn = 0
    let prefetchedNext: { msg: DebateMessage; audio: HTMLAudioElement | null } | null = null

    // Show "preparing" state while first speaker loads
    setSpeakingDebater('preparing')

    // Pre-fetch the FIRST speaker before anything starts
    prefetchedNext = await prefetchNextTurn(debaterIds, history, 1)

    if (!debateRunningRef.current || !prefetchedNext) {
      setLoading(false)
      return
    }

    while (debateRunningRef.current) {
      turn++
      setTurnCount(turn)

      let currentMsg: DebateMessage
      let currentAudio: HTMLAudioElement | null = null

      // Use prefetched data if available
      if (prefetchedNext) {
        currentMsg = prefetchedNext.msg
        currentAudio = prefetchedNext.audio
        prefetchedNext = null
        setLoading(false)
      } else {
        // Fetch current speaker
        setSpeakingDebater('thinking')
        setLoading(true)
        try {
          const res = await api.post('/debate/next-turn', {
            topic,
            debater_ids: debaterIds,
            history: history.map(m => ({ name: m.debater_name, message: m.message, debater_id: m.debater_id })),
            turn_count: turn,
          })

          if (!debateRunningRef.current) break

          currentMsg = {
            debater_id: res.data.debater_id,
            debater_name: res.data.debater_name,
            avatar: res.data.avatar,
            message: res.data.message,
            voice: res.data.voice,
            isInterruption: res.data.is_interruption,
          }

          // Only fetch audio if autoPlay is on
          if (autoPlay) {
            currentAudio = await fetchAudio(currentMsg.message, currentMsg.voice)
          }
          setLoading(false)
        } catch (err) {
          console.error('Debate turn failed:', err)
          setLoading(false)
          break
        }
      }

      if (!debateRunningRef.current) break

      // Add to history
      history.push(currentMsg)
      setSpeakingDebater(currentMsg.debater_id)

      // Start pre-fetching NEXT speaker while current one plays
      const prefetchPromise = autoPlay ? prefetchNextTurn(debaterIds, history, turn + 1) : prefetchNextTurnTextOnly(debaterIds, history, turn + 1)

      // Play current speaker (audio + word reveal)
      if (autoPlay && currentAudio) {
        await playWithTranscript(currentMsg, currentAudio)
      } else if (autoPlay) {
        await showTextOnly(currentMsg)
      } else {
        // No audio — show message with word-by-word reveal (faster)
        await showTextOnly(currentMsg)
      }

      // Wait for prefetch to complete
      if (debateRunningRef.current) {
        prefetchedNext = await prefetchPromise
      }

      if (!debateRunningRef.current) break

      // Small pause between speakers
      await new Promise(r => setTimeout(r, 400))
    }

    setSpeakingDebater(null)
    setIsDebating(false)
    setLoading(false)
  }

  // Pre-fetch next speaker's text AND audio while current one is playing
  const prefetchNextTurn = async (
    debaterIds: string[],
    history: DebateMessage[],
    nextTurn: number
  ): Promise<{ msg: DebateMessage; audio: HTMLAudioElement | null } | null> => {
    try {
      const res = await api.post('/debate/next-turn', {
        topic,
        debater_ids: debaterIds,
        history: history.map(m => ({ name: m.debater_name, message: m.message, debater_id: m.debater_id })),
        turn_count: nextTurn,
      })

      const msg: DebateMessage = {
        debater_id: res.data.debater_id,
        debater_name: res.data.debater_name,
        avatar: res.data.avatar,
        message: res.data.message,
        voice: res.data.voice,
        isInterruption: res.data.is_interruption,
      }

      // Pre-fetch audio too
      const audio = await fetchAudio(msg.message, msg.voice)

      return { msg, audio }
    } catch {
      return null
    }
  }

  // Pre-fetch next speaker's text only (no audio)
  const prefetchNextTurnTextOnly = async (
    debaterIds: string[],
    history: DebateMessage[],
    nextTurn: number
  ): Promise<{ msg: DebateMessage; audio: HTMLAudioElement | null } | null> => {
    try {
      const res = await api.post('/debate/next-turn', {
        topic,
        debater_ids: debaterIds,
        history: history.map(m => ({ name: m.debater_name, message: m.message, debater_id: m.debater_id })),
        turn_count: nextTurn,
      })

      const msg: DebateMessage = {
        debater_id: res.data.debater_id,
        debater_name: res.data.debater_name,
        avatar: res.data.avatar,
        message: res.data.message,
        voice: res.data.voice,
        isInterruption: res.data.is_interruption,
      }

      return { msg, audio: null }
    } catch {
      return null
    }
  }

  // Play audio and show text word-by-word simultaneously
  const playWithTranscript = (msg: DebateMessage, audio: HTMLAudioElement): Promise<void> => {
    return new Promise((resolve) => {
      const words = msg.message.split(' ')
      const msPerWord = 130

      // Add empty message
      setMessages(prev => [...prev, { ...msg, message: '' }])

      // Reveal words
      let revealedWords = 0
      const wordInterval = setInterval(() => {
        revealedWords++
        if (revealedWords <= words.length) {
          const partial = words.slice(0, revealedWords).join(' ')
          setMessages(prev => {
            const updated = [...prev]
            const lastIdx = updated.length - 1
            if (lastIdx >= 0) updated[lastIdx] = { ...msg, message: partial }
            return updated
          })
        } else {
          clearInterval(wordInterval)
        }
      }, msPerWord)

      ;(window as any).__currentAudio = audio

      audio.onended = () => {
        clearInterval(wordInterval)
        setMessages(prev => {
          const updated = [...prev]
          const lastIdx = updated.length - 1
          if (lastIdx >= 0) updated[lastIdx] = msg
          return updated
        })
        ;(window as any).__currentAudio = null
        resolve()
      }
      audio.onerror = () => {
        clearInterval(wordInterval)
        setMessages(prev => {
          const updated = [...prev]
          const lastIdx = updated.length - 1
          if (lastIdx >= 0) updated[lastIdx] = msg
          return updated
        })
        resolve()
      }

      audio.play()
    })
  }

  // Fallback: show text without audio
  const showTextOnly = (msg: DebateMessage): Promise<void> => {
    return new Promise(async (resolve) => {
      const words = msg.message.split(' ')
      const msPerWord = 130

      setMessages(prev => [...prev, { ...msg, message: '' }])

      let revealedWords = 0
      const wordInterval = setInterval(() => {
        revealedWords++
        if (revealedWords <= words.length) {
          const partial = words.slice(0, revealedWords).join(' ')
          setMessages(prev => {
            const updated = [...prev]
            const lastIdx = updated.length - 1
            if (lastIdx >= 0) updated[lastIdx] = { ...msg, message: partial }
            return updated
          })
        } else {
          clearInterval(wordInterval)
        }
      }, msPerWord)

      await new Promise(r => setTimeout(r, words.length * msPerWord + 300))
      clearInterval(wordInterval)
      setMessages(prev => {
        const updated = [...prev]
        const lastIdx = updated.length - 1
        if (lastIdx >= 0) updated[lastIdx] = msg
        return updated
      })
      resolve()
    })
  }

  const concludeDebate = async (debaterIds: string[], history: DebateMessage[]) => {
    // One of the debaters naturally wraps up
    try {
      const res = await api.post('/debate/conclude', {
        topic,
        debater_ids: debaterIds,
        history: history.map(m => ({ name: m.debater_name, message: m.message, debater_id: m.debater_id })),
        turn_count: turnCount,
      })

      const conclusion: DebateMessage = {
        debater_id: res.data.debater_id,
        debater_name: res.data.debater_name,
        avatar: res.data.avatar,
        message: res.data.message,
        voice: res.data.voice,
      }

      if (autoPlay) {
        await speakAndShowMessage(conclusion)
      } else {
        setMessages(prev => [...prev, conclusion])
      }
    } catch {}

    setSpeakingDebater(null)
    debateRunningRef.current = false
    setIsDebating(false)
    setPhase('ended')
  }

  // For non-loop scenarios (conclude, user-join)
  const speakAndShowMessage = async (msg: DebateMessage): Promise<void> => {
    const audio = await fetchAudio(msg.message, msg.voice)
    if (audio) {
      await playWithTranscript(msg, audio)
    } else {
      await showTextOnly(msg)
    }
  }

  // Fetch audio from TTS API — returns pre-loaded Audio element or null
  const fetchAudio = async (text: string, voice: string): Promise<HTMLAudioElement | null> => {
    try {
      const response = await fetch('/api/tts/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice, speed: 1.0 }),
      })
      if (!response.ok) return null
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      // Pre-load so it plays instantly
      await new Promise<void>((res) => {
        audio.oncanplaythrough = () => res()
        audio.onerror = () => res()
        audio.load()
      })
      return audio
    } catch {
      return null
    }
  }

  const [isEnding, setIsEnding] = useState(false)

  const stopDebate = async () => {
    if (isEnding) return // Prevent multiple clicks
    setIsEnding(true)
    debateRunningRef.current = false

    // Wait for current audio to finish naturally
    const currentAudio = (window as any).__currentAudio as HTMLAudioElement | undefined
    if (currentAudio && !currentAudio.paused && !currentAudio.ended) {
      await new Promise<void>((resolve) => {
        currentAudio.onended = () => resolve()
        setTimeout(resolve, 10000)
      })
      // Clear the reference after it ends
      ;(window as any).__currentAudio = null
    }

    // Small pause before conclusions
    await new Promise(r => setTimeout(r, 800))

    // Get conclusions from 2-3 debaters — ONE AT A TIME
    setSpeakingDebater('concluding')
    const numConclusions = Math.min(3, activeDebaters.length)
    const concludedIds: string[] = []

    for (let i = 0; i < numConclusions; i++) {
      try {
        const historyWithConclusions = [
          ...messages.map(m => ({ name: m.debater_name, message: m.message, debater_id: m.debater_id })),
          ...concludedIds.map(id => ({ name: id, message: '(concluded)', debater_id: id })),
        ]

        const res = await api.post('/debate/conclude', {
          topic,
          debater_ids: activeDebaters.map(d => d.id),
          history: historyWithConclusions,
          turn_count: turnCount,
        })

        concludedIds.push(res.data.debater_id)

        const conclusion: DebateMessage = {
          debater_id: res.data.debater_id,
          debater_name: res.data.debater_name,
          avatar: res.data.avatar,
          message: res.data.message,
          voice: res.data.voice,
        }

        if (autoPlay) {
          // Fetch audio
          const audio = await fetchAudio(conclusion.message, conclusion.voice)
          if (audio) {
            await playWithTranscript(conclusion, audio)
          } else {
            await showTextOnly(conclusion)
          }
          await new Promise(r => setTimeout(r, 600))
        } else {
          setMessages(prev => [...prev, conclusion])
        }
      } catch {
        break
      }
    }

    setSpeakingDebater(null)
    setIsDebating(false)
    setPhase('ended')
    setIsEnding(false)
  }

  const userJoinDebate = async () => {
    if (!userInput.trim() || loading) return

    const userMsg: DebateMessage = {
      debater_id: 'user',
      debater_name: 'You',
      avatar: '🙋',
      message: userInput.trim(),
      voice: '',
      isUser: true,
    }
    setMessages(prev => [...prev, userMsg])
    const text = userInput.trim()
    setUserInput('')

    try {
      const res = await api.post('/debate/user-join', {
        topic,
        message: text,
        debate_history: messages.slice(-6).map(m => ({ name: m.debater_name, message: m.message, debater_id: m.debater_id })),
        debater_ids: activeDebaters.map(d => d.id),
      })

      const aiResponse: DebateMessage = {
        debater_id: res.data.debater_id,
        debater_name: res.data.debater_name,
        avatar: res.data.avatar,
        message: res.data.message,
        voice: res.data.voice,
        corrections: res.data.corrections,
      }

      if (autoPlay) {
        await speakAndShowMessage(aiResponse)
      } else {
        setMessages(prev => [...prev, aiResponse])
      }
    } catch (err) {
      console.error('Failed to join debate:', err)
    }
  }

  const toggleDebater = (id: string) => {
    setSelectedDebaterIds(prev =>
      prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]
    )
  }

  const suggestedTopics = [
    "Social media is harmful for teenagers",
    "AI will replace most human jobs",
    "Working from home is better than office",
    "University education is overrated",
    "Money can buy happiness",
    "Space exploration is a waste of money",
    "Homework should be banned",
    "Animals should not be kept in zoos",
    "Technology makes us less social",
    "Everyone should learn to code",
  ]

  // SETUP SCREEN
  if (phase === 'setup') {
    return (
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">🎭 Debate Arena</h1>
        <p className="text-gray-600 text-sm mb-6">Watch AI characters have a real, flowing debate — they interrupt, agree, disagree, and reach conclusions naturally</p>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Topic</h2>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Enter a debate topic..."
            className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 focus:outline-none focus:border-indigo-500 text-lg mb-3"
          />
          <div className="flex flex-wrap gap-2">
            {suggestedTopics.map((t, i) => (
              <button key={i} onClick={() => setTopic(t)}
                className={`text-xs px-3 py-1.5 rounded-full ${topic === t ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-indigo-50'}`}>
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">Debaters ({numDebaters})</h2>
            <select value={numDebaters} onChange={(e) => setNumDebaters(parseInt(e.target.value))} className="border border-gray-300 rounded-lg px-3 py-1 text-sm">
              <option value={2}>2</option><option value={3}>3</option><option value={4}>4</option><option value={5}>5</option><option value={6}>6</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {availableDebaters.map((d) => (
              <button key={d.id} onClick={() => toggleDebater(d.id)}
                className={`p-2 rounded-lg border text-left text-xs ${selectedDebaterIds.includes(d.id) ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <span className="text-lg">{d.avatar}</span> <span className="font-medium">{d.name}</span>
                <span className={`ml-1 px-1 py-0.5 rounded text-[10px] ${d.provider === 'claude' ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'}`}>
                  {d.provider === 'claude' ? 'Claude' : 'GPT'}
                </span>
                <p className="text-gray-500 mt-0.5 truncate">{d.style}</p>
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-600 mb-4">
          <input type="checkbox" checked={autoPlay} onChange={(e) => setAutoPlay(e.target.checked)} className="rounded" />
          🔊 Enable AI voices (speaks each argument aloud)
        </label>

        <button onClick={startDebate} disabled={!topic.trim()}
          className="w-full bg-indigo-500 text-white py-4 rounded-xl font-semibold text-lg hover:bg-indigo-600 disabled:opacity-50">
          🎭 Start Debate
        </button>
      </div>
    )
  }

  // DEBATE SCREEN
  return (
    <div className="max-w-3xl mx-auto h-[calc(100vh-120px)] flex flex-col overflow-hidden">
      <div className="mb-3 flex justify-between items-center">
        <div>
          <h1 className="text-lg font-bold text-gray-800">🎭 {topic}</h1>
          <p className="text-xs text-gray-500">{turnCount} exchanges • {activeDebaters.length} debaters {isDebating && '• LIVE'}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={stopSpeaking} className="px-3 py-1.5 rounded-lg bg-gray-200 text-sm">🔇</button>
          <button onClick={stopDebate} disabled={isEnding} className={`px-3 py-1.5 rounded-lg text-sm ${isEnding ? 'bg-gray-200 text-gray-400' : 'bg-red-100 text-red-600 hover:bg-red-200'}`}>
            {isEnding ? '⏳ Ending...' : '⏹ End'}
          </button>
        </div>
      </div>

      {/* Active speakers */}
      <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1">
        {activeDebaters.map((d) => (
          <div key={d.id} className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs shrink-0 ${speakingDebater === d.id ? 'bg-indigo-500 text-white animate-pulse' : 'bg-gray-100 text-gray-600'}`}>
            <span>{d.avatar}</span><span>{d.name.split(' ')[0]}</span>
            {speakingDebater === d.id && <span>🎤</span>}
          </div>
        ))}
        {isDebating && <span className="text-xs text-green-500 self-center ml-2 animate-pulse">● LIVE</span>}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto bg-gray-50 rounded-xl p-4 mb-3 border border-gray-100 min-h-0">
        {messages.map((msg, i) => (
          <div key={i} className={`mb-3 ${msg.isUser ? 'text-right' : ''}`}>
            <div className={`inline-block max-w-[85%]`}>
              <div className={`flex items-center gap-1.5 mb-0.5 ${msg.isUser ? 'justify-end' : ''}`}>
                {!msg.isUser && <span>{msg.avatar}</span>}
                <span className="text-xs font-semibold text-gray-600">{msg.debater_name}</span>
                {msg.isInterruption && <span className="text-[10px] bg-red-100 text-red-600 px-1 rounded">interrupts!</span>}
                {!msg.isUser && <button onClick={() => speak(msg.message)} className="text-xs text-gray-400 hover:text-indigo-500">🔊</button>}
              </div>
              <div className={`rounded-xl px-3 py-2 text-sm ${msg.isUser ? 'bg-indigo-500 text-white' : 'bg-white border border-gray-200 text-gray-800'}`}>
                {msg.message}
              </div>
              {msg.corrections && msg.corrections.length > 0 && (
                <div className="mt-1 text-xs text-orange-600 bg-orange-50 rounded px-2 py-1">
                  {msg.corrections.map((c: any, j: number) => (
                    <p key={j}>💡 <span className="line-through">{c.original}</span> → <strong>{c.corrected}</strong></p>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && speakingDebater === 'thinking' && (
          <div className="text-center py-2"><p className="text-xs text-gray-400 animate-pulse">Next speaker preparing...</p></div>
        )}

        {speakingDebater === 'preparing' && (
          <div className="text-center py-8">
            <div className="flex justify-center gap-3 mb-4">
              {activeDebaters.map((d, i) => (
                <div key={d.id} className="animate-bounce" style={{ animationDelay: `${i * 0.2}s` }}>
                  <span className="text-2xl">{d.avatar}</span>
                </div>
              ))}
            </div>
            <p className="text-sm text-gray-500 animate-pulse">Debaters are gathering their thoughts...</p>
            <p className="text-xs text-gray-400 mt-1">Preparing opening arguments</p>
          </div>
        )}

        {speakingDebater === 'concluding' && (
          <div className="text-center py-4">
            <p className="text-sm text-gray-500 animate-pulse">Wrapping up the debate...</p>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* User input */}
      <div className="flex gap-2">
        <input type="text" value={userInput} onChange={(e) => setUserInput(e.target.value)}
          placeholder="Jump into the debate..."
          className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          onKeyDown={(e) => e.key === 'Enter' && userJoinDebate()} disabled={loading} />
        <button onClick={userJoinDebate} disabled={loading || !userInput.trim()}
          className="bg-indigo-500 text-white px-4 py-2.5 rounded-lg text-sm hover:bg-indigo-600 disabled:opacity-50">
          Speak
        </button>
      </div>
    </div>
  )
}

export default Debate
