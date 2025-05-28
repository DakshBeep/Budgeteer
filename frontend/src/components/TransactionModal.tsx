import { useState, useEffect, useRef } from 'react'
import { X, Calendar, FileText, CheckCircle, Repeat } from 'lucide-react'
import axios from 'axios'
import { useAuth } from '../hooks/useAuth'
import IncomeExpenseToggle from './IncomeExpenseToggle'
import CategorySelector, { categories } from './CategorySelector'
import { formatCurrency, parseCurrency, formatCurrencyInput } from '../utils/currency'
import { buildApiUrl } from '../utils/api'

interface TransactionModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
  initialType?: 'income' | 'expense'
  initialCategory?: string
  initialRecurring?: boolean
}

const TransactionModal = ({ isOpen, onClose, onSuccess, initialType = 'expense', initialCategory, initialRecurring = false }: TransactionModalProps) => {
  const [type, setType] = useState<'income' | 'expense'>(initialType)
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState(initialCategory || '')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')
  const [recurring, setRecurring] = useState(initialRecurring)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showSuccess, setShowSuccess] = useState(false)
  
  const amountInputRef = useRef<HTMLInputElement>(null)
  const { token } = useAuth()

  // Load last used category from localStorage or use initial
  useEffect(() => {
    if (initialCategory) {
      setCategory(initialCategory)
    } else {
      const lastCategory = localStorage.getItem('lastCategory_' + type) || (type === 'income' ? 'Income' : 'Food')
      setCategory(lastCategory)
    }
  }, [type, initialCategory])
  
  // Reset form when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      // Reset form when closing
      setAmount('')
      setNotes('')
      setRecurring(initialRecurring)
      setError('')
      setShowSuccess(false)
      setDate(new Date().toISOString().split('T')[0])
    } else {
      // Set recurring when opening
      setRecurring(initialRecurring)
    }
  }, [isOpen, initialRecurring])

  // Focus on amount input when modal opens
  useEffect(() => {
    if (isOpen && amountInputRef.current) {
      setTimeout(() => amountInputRef.current?.focus(), 100)
    }
  }, [isOpen])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return
      
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'Enter' && e.ctrlKey) {
        handleSubmit()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, amount, category])

  const handleAmountChange = (value: string) => {
    const formatted = formatCurrencyInput(value)
    setAmount(formatted)
  }

  const handleSubmit = async () => {
    setError('')
    
    // Validation
    const amountNum = parseCurrency(amount)
    if (amountNum <= 0) {
      setError('Please enter a valid amount')
      return
    }
    
    if (!category) {
      setError('Please select a category')
      return
    }

    setLoading(true)
    
    try {
      const finalAmount = type === 'expense' ? -amountNum : amountNum
      
      console.log('Submitting transaction:', {
        tx_date: date,
        amount: finalAmount,
        label: category,
        notes: notes || undefined,
        recurring,
      })
      console.log('Using token:', token)
      
      const response = await axios.post(
        buildApiUrl('/tx'),
        {
          tx_date: date,
          amount: finalAmount,
          label: category,
          notes: notes || undefined,
          recurring,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      )
      
      console.log('Transaction response:', response.data)

      // Save last used category
      localStorage.setItem('lastCategory_' + type, category)

      // Show success feedback
      setShowSuccess(true)
      setTimeout(() => {
        setShowSuccess(false)
        resetForm()
        onSuccess?.()
        onClose()
      }, 1500)
    } catch (err: any) {
      console.error('Transaction error:', err)
      console.error('Error response:', err.response)
      setError(err.response?.data?.detail || 'Failed to save transaction')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setAmount('')
    setNotes('')
    setRecurring(false)
    setDate(new Date().toISOString().split('T')[0])
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-gray-900 bg-opacity-50 z-40 transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="fixed inset-x-0 bottom-0 z-50 sm:inset-0 sm:flex sm:items-center sm:justify-center">
        <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-xl w-full sm:max-w-md sm:mx-4 max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-100">
            <h2 className="text-xl font-semibold text-gray-900">
              Add Transaction
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Success Message */}
            {showSuccess && (
              <div className="flex items-center justify-center p-4 bg-green-50 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                <span className="text-green-700 font-medium">Transaction saved successfully!</span>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Income/Expense Toggle */}
            <IncomeExpenseToggle value={type} onChange={setType} />

            {/* Amount Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Amount
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-3xl text-gray-400">
                  $
                </span>
                <input
                  ref={amountInputRef}
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-12 pr-4 py-4 text-3xl font-semibold border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Category Selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category
              </label>
              <CategorySelector
                value={category}
                onChange={setCategory}
                type={type}
              />
            </div>

            {/* Date Picker */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes (optional)
              </label>
              <div className="relative">
                <FileText className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add a note..."
                  rows={3}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>
            </div>

            {/* Recurring Checkbox */}
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={recurring}
                onChange={(e) => setRecurring(e.target.checked)}
                className="h-5 w-5 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
              />
              <div className="flex items-center">
                <Repeat className="h-4 w-4 text-gray-500 mr-2" />
                <span className="text-gray-700">This is a recurring transaction</span>
              </div>
            </label>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-gray-100 flex space-x-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || !amount || !category}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Saving...' : 'Save Transaction'}
            </button>
          </div>

          {/* Keyboard shortcuts hint */}
          <div className="px-6 pb-4 text-xs text-gray-500 text-center">
            Press <kbd className="px-2 py-1 bg-gray-100 rounded">Ctrl</kbd> + <kbd className="px-2 py-1 bg-gray-100 rounded">Enter</kbd> to save • <kbd className="px-2 py-1 bg-gray-100 rounded">Esc</kbd> to cancel
          </div>
        </div>
      </div>
    </>
  )
}

export default TransactionModal