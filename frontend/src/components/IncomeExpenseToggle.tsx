import { TrendingUp, TrendingDown } from 'lucide-react'

interface IncomeExpenseToggleProps {
  value: 'income' | 'expense'
  onChange: (value: 'income' | 'expense') => void
}

const IncomeExpenseToggle = ({ value, onChange }: IncomeExpenseToggleProps) => {
  return (
    <div className="relative bg-gray-100 rounded-xl p-1 flex">
      {/* Sliding background */}
      <div
        className={`absolute top-1 bottom-1 w-1/2 bg-white rounded-lg shadow-sm transition-transform duration-200 ease-out ${
          value === 'expense' ? 'transform translate-x-full' : ''
        }`}
      />
      
      {/* Income button */}
      <button
        type="button"
        onClick={() => onChange('income')}
        className={`relative flex-1 flex items-center justify-center py-3 px-4 rounded-lg font-medium transition-colors duration-200 ${
          value === 'income'
            ? 'text-green-700'
            : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        <TrendingDown className="w-5 h-5 mr-2" />
        Income
      </button>
      
      {/* Expense button */}
      <button
        type="button"
        onClick={() => onChange('expense')}
        className={`relative flex-1 flex items-center justify-center py-3 px-4 rounded-lg font-medium transition-colors duration-200 ${
          value === 'expense'
            ? 'text-red-700'
            : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        <TrendingUp className="w-5 h-5 mr-2" />
        Expense
      </button>
    </div>
  )
}

export default IncomeExpenseToggle