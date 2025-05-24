import { Plus } from 'lucide-react'
import { categories } from './CategorySelector'

interface QuickAddButtonsProps {
  onQuickAdd: (type: 'income' | 'expense', category?: string) => void
}

const QuickAddButtons = ({ onQuickAdd }: QuickAddButtonsProps) => {
  const quickCategories = [
    { ...categories.find(c => c.value === 'Food')!, type: 'expense' as const },
    { ...categories.find(c => c.value === 'Transport')!, type: 'expense' as const },
    { ...categories.find(c => c.value === 'Shopping')!, type: 'expense' as const },
    { ...categories.find(c => c.value === 'Income')!, type: 'income' as const },
  ]

  return (
    <div className="space-y-4">
      {/* Main Quick Add Buttons */}
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => onQuickAdd('income')}
          className="group relative bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl p-4 flex items-center justify-center space-x-3 hover:shadow-lg transition-all transform hover:scale-105"
        >
          <div className="p-2 bg-white bg-opacity-20 rounded-lg group-hover:bg-opacity-30 transition-colors">
            <Plus className="h-5 w-5" />
          </div>
          <span className="font-medium">Add Income</span>
        </button>
        
        <button
          onClick={() => onQuickAdd('expense')}
          className="group relative bg-gradient-to-r from-red-500 to-pink-600 text-white rounded-xl p-4 flex items-center justify-center space-x-3 hover:shadow-lg transition-all transform hover:scale-105"
        >
          <div className="p-2 bg-white bg-opacity-20 rounded-lg group-hover:bg-opacity-30 transition-colors">
            <Plus className="h-5 w-5" />
          </div>
          <span className="font-medium">Add Expense</span>
        </button>
      </div>

      {/* Quick Category Buttons */}
      <div className="grid grid-cols-4 gap-3">
        {quickCategories.map((category) => (
          <button
            key={category.value}
            onClick={() => onQuickAdd(category.type, category.value)}
            className="group bg-white border border-gray-200 rounded-xl p-3 flex flex-col items-center space-y-2 hover:border-gray-300 hover:shadow-md transition-all transform hover:scale-105"
          >
            <span className="text-2xl group-hover:scale-110 transition-transform">
              {category.icon}
            </span>
            <span className="text-xs text-gray-600 font-medium">
              {category.label.split(' ')[0]}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default QuickAddButtons