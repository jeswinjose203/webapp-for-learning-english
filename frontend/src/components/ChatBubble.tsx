interface ChatBubbleProps {
  role: 'user' | 'ai'
  message: string
  corrections?: Array<{
    original: string
    corrected: string
    explanation: string
  }>
  onSpeak?: () => void
}

function ChatBubble({ role, message, corrections, onSpeak }: ChatBubbleProps) {
  const isUser = role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div
        className={`max-w-[70%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-indigo-500 text-white rounded-br-md'
            : 'bg-white text-gray-800 border border-gray-200 rounded-bl-md shadow-sm'
        }`}
      >
        <p className="text-sm whitespace-pre-wrap">{message}</p>

        {/* Corrections */}
        {corrections && corrections.length > 0 && (
          <div className={`mt-2 pt-2 border-t ${isUser ? 'border-indigo-400/30' : 'border-gray-200'}`}>
            {corrections.map((c, i) => (
              <div key={i} className="text-xs mt-1">
                <span className={`line-through ${isUser ? 'text-red-200' : 'text-red-500'}`}>
                  {c.original}
                </span>
                {' → '}
                <span className={`font-semibold ${isUser ? 'text-green-200' : 'text-green-600'}`}>
                  {c.corrected}
                </span>
                <p className={`mt-0.5 ${isUser ? 'text-indigo-200' : 'text-gray-500'}`}>
                  {c.explanation}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Tap to hear button */}
        {onSpeak && (
          <button
            onClick={onSpeak}
            className={`mt-2 text-xs flex items-center gap-1 ${
              isUser ? 'text-indigo-200 hover:text-white' : 'text-gray-400 hover:text-indigo-500'
            }`}
            title="Listen to pronunciation"
          >
            🔊 Listen
          </button>
        )}
      </div>
    </div>
  )
}

export default ChatBubble
