import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

export interface Category {
  value: string
  label: string
  icon: string
  color: string
}

export const categories: Category[] = [
  { value: 'Food', label: 'Food & Dining', icon: '🍕', color: 'bg-orange-100 text-orange-700' },
  { value: 'Transport', label: 'Transportation', icon: '🚗', color: 'bg-blue-100 text-blue-700' },
  { value: 'Shopping', label: 'Shopping', icon: '🛍️', color: 'bg-pink-100 text-pink-700' },
  { value: 'Entertainment', label: 'Entertainment', icon: '🎬', color: 'bg-purple-100 text-purple-700' },
  { value: 'Bills', label: 'Bills & Utilities', icon: '📱', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'Healthcare', label: 'Healthcare', icon: '🏥', color: 'bg-red-100 text-red-700' },
  { value: 'Education', label: 'Education', icon: '📚', color: 'bg-indigo-100 text-indigo-700' },
  { value: 'Travel', label: 'Travel', icon: '✈️', color: 'bg-cyan-100 text-cyan-700' },
  { value: 'Personal', label: 'Personal Care', icon: '💅', color: 'bg-rose-100 text-rose-700' },
  { value: 'Gifts', label: 'Gifts & Donations', icon: '🎁', color: 'bg-amber-100 text-amber-700' },
  { value: 'Savings', label: 'Savings', icon: '💰', color: 'bg-green-100 text-green-700' },
  { value: 'Income', label: 'Income', icon: '💸', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'Other', label: 'Other', icon: '📌', color: 'bg-gray-100 text-gray-700' },
]

interface CategorySelectorProps {
  value: string
  onChange: (value: string) => void
  type: 'income' | 'expense'
}

const CategorySelector = ({ value, onChange, type }: CategorySelectorProps) => {
  const [isOpen, setIsOpen] = useState(false)
  
  // Filter categories based on type
  const filteredCategories = type === 'income' 
    ? categories.filter(cat => ['Income', 'Savings', 'Other'].includes(cat.value))
    : categories.filter(cat => !['Income'].includes(cat.value))

  const selectedCategory = categories.find(cat => cat.value === value) || categories[0]

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 bg-white border border-gray-300 rounded-lg hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
      >
        <div className="flex items-center space-x-3">
          <span className="text-2xl">{selectedCategory.icon}</span>
          <span className="text-gray-900 font-medium">{selectedCategory.label}</span>
        </div>
        <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute z-20 mt-2 w-full bg-white rounded-lg shadow-lg border border-gray-200 max-h-64 overflow-y-auto">
            {filteredCategories.map((category) => (
              <button
                key={category.value}
                type="button"
                onClick={() => {
                  onChange(category.value)
                  setIsOpen(false)
                }}
                className={`w-full flex items-center space-x-3 px-4 py-3 hover:bg-gray-50 transition-colors ${
                  value === category.value ? 'bg-gray-50' : ''
                }`}
              >
                <span className="text-2xl">{category.icon}</span>
                <span className="text-gray-900">{category.label}</span>
                {value === category.value && (
                  <div className="ml-auto w-2 h-2 bg-indigo-600 rounded-full" />
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default CategorySelector