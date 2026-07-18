import { useEffect, useState } from 'react'
import api from '../services/api'

interface UsageData {
  student_name: string
  messages: {
    total: number
    sent_by_user: number
    sent_by_ai: number
    by_mode: Record<string, { user: number; ai: number }>
  }
  tokens: {
    openai_input: number
    openai_output: number
    openai_total: number
    claude_input: number
    claude_output: number
    claude_total: number
    total: number
  }
  tts: {
    characters: number
    cost_usd: number
  }
  cost: {
    openai: {
      input_usd: number
      output_usd: number
      subtotal_usd: number
    }
    claude: {
      input_usd: number
      output_usd: number
      subtotal_usd: number
    }
    tts_usd: number
    total_usd: number
    total_inr: number
  }
  by_feature: Record<string, { calls: number; tokens: number; cost: number }>
  lessons: {
    generated: number
    completed: number
  }
  xp: {
    total: number
    today: number
  }
  streak_days: number
  total_api_calls: number
  data_source: string
}

function Usage() {
  const [data, setData] = useState<UsageData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchUsage()
  }, [])

  const fetchUsage = async () => {
    try {
      const res = await api.get('/usage/summary')
      setData(res.data)
    } catch (err) {
      console.error('Failed to fetch usage:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="text-center py-10 text-gray-500">Loading usage report...</div>
  }

  if (!data) {
    return <div className="text-center py-10 text-gray-500">Failed to load report.</div>
  }

  const downloadAsPdf = () => {
    const printContent = `
      <html>
      <head>
        <title>Usage Report - ${data.student_name}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; color: #333; }
          h1 { color: #4f46e5; border-bottom: 2px solid #4f46e5; padding-bottom: 10px; }
          h2 { color: #555; margin-top: 30px; }
          table { width: 100%; border-collapse: collapse; margin: 15px 0; }
          th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
          th { background: #f3f4f6; font-weight: bold; }
          .total-row { background: #eef2ff; font-weight: bold; }
          .header-info { color: #666; font-size: 14px; margin-bottom: 30px; }
          .footer { margin-top: 40px; font-size: 12px; color: #999; border-top: 1px solid #ddd; padding-top: 10px; }
        </style>
      </head>
      <body>
        <h1>📋 English Learning AI - Usage Report</h1>
        <p class="header-info">Student: <strong>${data.student_name}</strong> | Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}</p>

        <h2>📊 Overview</h2>
        <table>
          <tr><th>Metric</th><th>Value</th></tr>
          <tr><td>Total Messages</td><td>${data.messages.total}</td></tr>
          <tr><td>Messages Sent by You</td><td>${data.messages.sent_by_user}</td></tr>
          <tr><td>AI Responses</td><td>${data.messages.sent_by_ai}</td></tr>
          <tr><td>Total API Calls</td><td>${data.total_api_calls}</td></tr>
          <tr><td>Total XP</td><td>${data.xp.total}</td></tr>
          <tr><td>Day Streak</td><td>${data.streak_days}</td></tr>
          <tr><td>Lessons Generated</td><td>${data.lessons.generated}</td></tr>
          <tr><td>Lessons Completed</td><td>${data.lessons.completed}</td></tr>
        </table>

        <h2>💬 Messages by Mode</h2>
        <table>
          <tr><th>Mode</th><th>User Messages</th><th>AI Messages</th><th>Total</th></tr>
          ${Object.entries(data.messages.by_mode).map(([mode, counts]) =>
            `<tr><td>${mode}</td><td>${counts.user}</td><td>${counts.ai}</td><td>${counts.user + counts.ai}</td></tr>`
          ).join('')}
        </table>

        <h2>🔢 Token Usage (Actual)</h2>
        <table>
          <tr><th>Provider</th><th>Input Tokens</th><th>Output Tokens</th><th>Total</th></tr>
          <tr><td>OpenAI (GPT-4o-mini)</td><td>${data.tokens.openai_input.toLocaleString()}</td><td>${data.tokens.openai_output.toLocaleString()}</td><td>${data.tokens.openai_total.toLocaleString()}</td></tr>
          <tr><td>Claude (Sonnet)</td><td>${data.tokens.claude_input.toLocaleString()}</td><td>${data.tokens.claude_output.toLocaleString()}</td><td>${data.tokens.claude_total.toLocaleString()}</td></tr>
          <tr class="total-row"><td>Total</td><td colspan="3">${data.tokens.total.toLocaleString()} tokens</td></tr>
        </table>

        <h2>💰 Cost (Real Token Tracking)</h2>
        <table>
          <tr><th>Item</th><th>Cost (USD)</th></tr>
          <tr><td>OpenAI GPT Input</td><td>$${data.cost.openai.input_usd}</td></tr>
          <tr><td>OpenAI GPT Output</td><td>$${data.cost.openai.output_usd}</td></tr>
          <tr><td>OpenAI Subtotal</td><td>$${data.cost.openai.subtotal_usd}</td></tr>
          <tr><td>Claude Input</td><td>$${data.cost.claude.input_usd}</td></tr>
          <tr><td>Claude Output</td><td>$${data.cost.claude.output_usd}</td></tr>
          <tr><td>Claude Subtotal</td><td>$${data.cost.claude.subtotal_usd}</td></tr>
          <tr><td>TTS (${data.tts.characters.toLocaleString()} chars)</td><td>$${data.cost.tts_usd}</td></tr>
          <tr class="total-row"><td>Total</td><td>$${data.cost.total_usd} (≈ ₹${data.cost.total_inr})</td></tr>
        </table>
        <p style="font-size: 12px; color: #888;">* GPT-4o-mini: $0.15/$0.60 per 1M tokens | Claude: $3/$15 per 1M tokens | TTS: $0.015/1K chars</p>

        <h2>📌 Usage by Feature</h2>
        <table>
          <tr><th>Feature</th><th>API Calls</th><th>Tokens</th><th>Cost</th></tr>
          ${Object.entries(data.by_feature || {}).map(([feature, stats]: [string, any]) =>
            `<tr><td>${feature}</td><td>${stats.calls}</td><td>${stats.tokens.toLocaleString()}</td><td>$${stats.cost.toFixed(4)}</td></tr>`
          ).join('')}
        </table>

        <div class="footer">
          English Learning AI — Usage Report — ${new Date().toISOString().split('T')[0]}<br>
          Data source: Real token tracking from API responses
        </div>
      </body>
      </html>
    `

    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(printContent)
      printWindow.document.close()
      setTimeout(() => {
        printWindow.print()
      }, 500)
    }
  }

  const downloadAsJson = () => {
    const json = JSON.stringify(data, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `usage-report-${data.student_name}-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">📋 Usage Report</h1>

      {/* Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
          <p className="text-2xl font-bold text-indigo-600">{data.messages.total}</p>
          <p className="text-xs text-gray-500">Total Messages</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
          <p className="text-2xl font-bold text-green-600">{data.tokens.total.toLocaleString()}</p>
          <p className="text-xs text-gray-500">Actual Tokens Used</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
          <p className="text-2xl font-bold text-orange-600">₹{data.cost.total_inr}</p>
          <p className="text-xs text-gray-500">Total Cost</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
          <p className="text-2xl font-bold text-purple-600">{data.total_api_calls}</p>
          <p className="text-xs text-gray-500">API Calls</p>
        </div>
      </div>

      {/* Messages Breakdown */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">💬 Messages Breakdown</h2>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-sm text-gray-500">You sent</p>
            <p className="text-xl font-bold text-gray-800">{data.messages.sent_by_user}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">AI responded</p>
            <p className="text-xl font-bold text-gray-800">{data.messages.sent_by_ai}</p>
          </div>
        </div>

        <h3 className="text-sm font-medium text-gray-700 mb-2">By Mode:</h3>
        <div className="space-y-2">
          {Object.entries(data.messages.by_mode).map(([mode, counts]) => (
            <div key={mode} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
              <span className="text-sm text-gray-700 capitalize">
                {mode === 'chat' && '💬 Chat'}
                {mode === 'grammar_check' && '✏️ Grammar'}
                {mode === 'vocabulary' && '📖 Vocabulary'}
                {mode === 'story' && '📝 Story'}
                {mode === 'call' && '📞 Call'}
                {mode === 'translate' && '🌐 Translate'}
                {!['chat', 'grammar_check', 'vocabulary', 'story', 'call', 'translate'].includes(mode) && `📌 ${mode}`}
              </span>
              <span className="text-sm text-gray-500">
                {counts.user + counts.ai} messages
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Cost Breakdown */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">💰 Actual Cost (Real Token Tracking)</h2>
        {data.data_source === 'no_data_yet' && (
          <p className="text-sm text-yellow-600 bg-yellow-50 rounded-lg px-3 py-2 mb-4">
            ⚠️ No API calls tracked yet. Costs will appear after you start chatting.
          </p>
        )}
        <div className="space-y-3">
          <p className="text-xs text-gray-500 font-medium uppercase">OpenAI (Chat + Lessons)</p>
          <div className="flex justify-between items-center py-2 border-b border-gray-100 pl-3">
            <span className="text-sm text-gray-600">GPT-4o-mini Input ({data.tokens.openai_input.toLocaleString()} tokens)</span>
            <span className="text-sm font-medium">${data.cost.openai.input_usd}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-100 pl-3">
            <span className="text-sm text-gray-600">GPT-4o-mini Output ({data.tokens.openai_output.toLocaleString()} tokens)</span>
            <span className="text-sm font-medium">${data.cost.openai.output_usd}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-100 pl-3">
            <span className="text-sm text-gray-600 font-medium">OpenAI Subtotal</span>
            <span className="text-sm font-medium">${data.cost.openai.subtotal_usd}</span>
          </div>

          <p className="text-xs text-gray-500 font-medium uppercase mt-4">Claude (Debate Characters)</p>
          <div className="flex justify-between items-center py-2 border-b border-gray-100 pl-3">
            <span className="text-sm text-gray-600">Claude Sonnet Input ({data.tokens.claude_input.toLocaleString()} tokens)</span>
            <span className="text-sm font-medium">${data.cost.claude.input_usd}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-100 pl-3">
            <span className="text-sm text-gray-600">Claude Sonnet Output ({data.tokens.claude_output.toLocaleString()} tokens)</span>
            <span className="text-sm font-medium">${data.cost.claude.output_usd}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-100 pl-3">
            <span className="text-sm text-gray-600 font-medium">Claude Subtotal</span>
            <span className="text-sm font-medium">${data.cost.claude.subtotal_usd}</span>
          </div>

          <p className="text-xs text-gray-500 font-medium uppercase mt-4">Voice</p>
          <div className="flex justify-between items-center py-2 border-b border-gray-100 pl-3">
            <span className="text-sm text-gray-600">OpenAI TTS ({data.tts.characters.toLocaleString()} characters)</span>
            <span className="text-sm font-medium">${data.cost.tts_usd}</span>
          </div>

          <div className="flex justify-between items-center py-3 bg-indigo-50 rounded-lg px-3 mt-4">
            <span className="text-sm font-semibold text-indigo-700">Total</span>
            <span className="text-sm font-bold text-indigo-700">
              ${data.cost.total_usd} (≈ ₹{data.cost.total_inr})
            </span>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-3">
          * Based on actual token counts from API responses. GPT-4o-mini: $0.15/$0.60 per 1M tokens | Claude Sonnet: $3/$15 per 1M tokens | TTS: $0.015/1K chars
        </p>
      </div>

      {/* Token Usage */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">🔢 Token Usage (Actual)</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <p className="text-lg font-bold text-gray-800">{data.tokens.openai_input.toLocaleString()}</p>
            <p className="text-xs text-gray-500">OpenAI Input</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-gray-800">{data.tokens.openai_output.toLocaleString()}</p>
            <p className="text-xs text-gray-500">OpenAI Output</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-gray-800">{data.tokens.claude_input.toLocaleString()}</p>
            <p className="text-xs text-gray-500">Claude Input</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-gray-800">{data.tokens.claude_output.toLocaleString()}</p>
            <p className="text-xs text-gray-500">Claude Output</p>
          </div>
        </div>
        <div className="text-center mt-3 pt-3 border-t border-gray-100">
          <p className="text-lg font-bold text-indigo-600">{data.tokens.total.toLocaleString()}</p>
          <p className="text-xs text-gray-500">Total Tokens</p>
        </div>
      </div>

      {/* Usage by Feature */}
      {data.by_feature && Object.keys(data.by_feature).length > 0 && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">📌 Usage by Feature</h2>
          <div className="space-y-2">
            {Object.entries(data.by_feature).map(([feature, stats]) => (
              <div key={feature} className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-2">
                <span className="text-sm text-gray-700 capitalize">
                  {feature === 'chat' && '💬 Chat'}
                  {feature === 'grammar_check' && '✏️ Grammar'}
                  {feature === 'vocabulary' && '📖 Vocabulary'}
                  {feature === 'story' && '📝 Story'}
                  {feature === 'call' && '📞 Call'}
                  {feature === 'translate' && '🌐 Translate'}
                  {feature === 'debate' && '🎭 Debate'}
                  {feature === 'lesson' && '📚 Lesson'}
                  {feature === 'tts' && '🔊 TTS'}
                  {!['chat','grammar_check','vocabulary','story','call','translate','debate','lesson','tts'].includes(feature) && `📌 ${feature}`}
                </span>
                <div className="text-right">
                  <span className="text-sm text-gray-500">{stats.calls} calls</span>
                  <span className="text-sm text-gray-400 mx-2">•</span>
                  <span className="text-sm text-gray-500">{stats.tokens.toLocaleString()} tokens</span>
                  <span className="text-sm text-gray-400 mx-2">•</span>
                  <span className="text-sm font-medium text-indigo-600">${stats.cost.toFixed(4)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Activity */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">📊 Activity</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <p className="text-lg font-bold text-gray-800">{data.lessons.generated}</p>
            <p className="text-xs text-gray-500">Lessons Generated</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-gray-800">{data.lessons.completed}</p>
            <p className="text-xs text-gray-500">Lessons Completed</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-gray-800">{data.streak_days}</p>
            <p className="text-xs text-gray-500">Day Streak</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-gray-800">{data.xp.today}</p>
            <p className="text-xs text-gray-500">XP Today</p>
          </div>
        </div>
      </div>

      {/* Download Button */}
      <div className="flex gap-3 mb-8">
        <button
          onClick={downloadAsPdf}
          className="bg-indigo-500 text-white px-6 py-3 rounded-lg hover:bg-indigo-600 font-medium flex items-center gap-2"
        >
          📥 Download as PDF
        </button>
        <button
          onClick={downloadAsJson}
          className="bg-gray-200 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-300 font-medium flex items-center gap-2"
        >
          📄 Download as JSON
        </button>
      </div>
    </div>
  )
}

export default Usage
