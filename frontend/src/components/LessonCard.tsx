interface LessonCardProps {
  title: string
  type: string
  items: number
  onClick?: () => void
}

function LessonCard({ title, type, items, onClick }: LessonCardProps) {
  const typeIcons: Record<string, string> = {
    grammar: '✏️',
    vocabulary: '📖',
    speaking: '🗣️',
    mixed: '📚',
  }

  const typeColors: Record<string, string> = {
    grammar: 'bg-purple-50 border-purple-200',
    vocabulary: 'bg-green-50 border-green-200',
    speaking: 'bg-orange-50 border-orange-200',
    mixed: 'bg-indigo-50 border-indigo-200',
  }

  return (
    <div
      onClick={onClick}
      className={`p-4 rounded-lg border-2 cursor-pointer transition-all hover:shadow-md ${
        typeColors[type] || typeColors.mixed
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-2xl">{typeIcons[type] || typeIcons.mixed}</span>
        <h3 className="font-semibold text-gray-800">{title}</h3>
      </div>
      <p className="text-sm text-gray-600">{items} exercises</p>
      <button className="mt-3 text-sm text-indigo-600 font-medium hover:text-indigo-800">
        Start Lesson →
      </button>
    </div>
  )
}

export default LessonCard
