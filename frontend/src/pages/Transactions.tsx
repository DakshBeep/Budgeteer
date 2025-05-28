import React, { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Plus, Search, Calendar, DollarSign, Tag, Edit2, Trash2, Clock } from 'lucide-react'
import axios from 'axios'
import { useAuth } from '../hooks/useAuth'
import TransactionModal from '../components/TransactionModal'
import { buildApiUrl } from '../utils/api'

interface Transaction {
  id: number
  tx_date: string
  amount: number
  label: string
  notes?: string
  recurring?: boolean
}

const Transactions = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [showTransactionModal, setShowTransactionModal] = useState(false)
  const [modalType, setModalType] = useState<'income' | 'expense'>('expense')
  const [modalCategory, setModalCategory] = useState<string | undefined>()
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [loading, setLoading] = useState(true)
  const [showFutureTransactions, setShowFutureTransactions] = useState(false)
  const { token } = useAuth()
  const location = useLocation()


  useEffect(() => {
    fetchTransactions()
  }, [])

  useEffect(() => {
    // Check if we should open the form from navigation state
    if (location.state?.openForm) {
      setModalType(location.state?.type || 'expense')
      setShowTransactionModal(true)
    }
  }, [location])

  useEffect(() => {
    const filtered = transactions.filter(tx =>
      tx.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (tx.notes && tx.notes.toLowerCase().includes(searchTerm.toLowerCase()))
    )
    setFilteredTransactions(filtered)
  }, [searchTerm, transactions])

  const fetchTransactions = async () => {
    if (!token) return

    try {
      const response = await axios.get(buildApiUrl('/tx'), {
        headers: { Authorization: `Bearer ${token}` },
      })
      setTransactions(response.data)
      setFilteredTransactions(response.data)
    } catch (error) {
      console.error('Error fetching transactions:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddClick = () => {
    setEditingTransaction(null)
    setModalType('expense')
    setModalCategory(undefined)
    setShowTransactionModal(true)
  }

  const handleDelete = async (id: number) => {
    
    if (window.confirm('Are you sure you want to delete this transaction?')) {
      try {
        await axios.delete(buildApiUrl(`/tx/${id}`), {
          headers: { Authorization: `Bearer ${token}` },
        })
        fetchTransactions()
      } catch (error) {
        console.error('Error deleting transaction:', error)
      }
    }
  }

  const handleEdit = (transaction: Transaction) => {
    setEditingTransaction(transaction)
    setModalType(transaction.amount < 0 ? 'expense' : 'income')
    setModalCategory(transaction.label)
    setShowTransactionModal(true)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-full">
      <div className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h2 className="text-4xl font-bold text-gray-900 tracking-tight">Transactions</h2>
              <p className="mt-2 text-lg text-gray-600">Manage and track all your income and expenses</p>
            </div>
            <button
              onClick={handleAddClick}
              className="flex items-center bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-2 rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all shadow-md hover:shadow-lg"
            >
              <Plus className="h-5 w-5 mr-2" />
              Add Transaction
            </button>
          </div>

          <div className="mb-8">
            <div className="flex gap-4 items-start">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search transactions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-full px-4 py-3 border border-gray-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                />
              </div>
              
              {/* Future transactions toggle */}
              {(() => {
                const today = new Date().toISOString().split('T')[0]
                const futureCount = transactions.filter(tx => tx.tx_date > today && tx.recurring).length
                
                if (futureCount > 0) {
                  return (
                    <button
                      onClick={() => setShowFutureTransactions(!showFutureTransactions)}
                      className={`flex items-center gap-2 px-4 py-3 rounded-xl border transition-all ${
                        showFutureTransactions 
                          ? 'bg-blue-50 border-blue-300 text-blue-700' 
                          : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <Clock className="h-5 w-5" />
                      <span className="font-medium">
                        {showFutureTransactions ? 'Hide' : 'Show'} Future
                      </span>
                      <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-semibold">
                        {futureCount}
                      </span>
                    </button>
                  )
                }
                return null
              })()}
            </div>
          </div>


          <div className="bg-white shadow-lg rounded-2xl overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Notes
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {transactions
                  .filter(transaction => {
                    // First filter by search term
                    const matchesSearch = transaction.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      (transaction.notes && transaction.notes.toLowerCase().includes(searchTerm.toLowerCase()))
                    
                    if (!matchesSearch) return false
                    
                    // Then filter by date based on toggle
                    const today = new Date().toISOString().split('T')[0]
                    const isFuture = transaction.tx_date > today
                    
                    // If not showing future, exclude future transactions
                    if (!showFutureTransactions && isFuture) return false
                    
                    // If showing future, include all
                    return true
                  })
                  .map(transaction => {
                    const today = new Date().toISOString().split('T')[0]
                    const isToday = transaction.tx_date === today
                    const isFuture = transaction.tx_date > today
                    
                    return (
                      <tr key={transaction.id} className={isFuture ? 'bg-blue-50/30 hover:bg-blue-50/50 transition-colors' : 'hover:bg-gray-50'}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div className="flex items-center gap-2">
                            {isFuture && (
                              <div className="flex items-center gap-1 bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-medium">
                                <Clock className="h-3 w-3" />
                                <span>Scheduled</span>
                              </div>
                            )}
                            {new Date(transaction.tx_date).toLocaleDateString()}
                            {isToday && <span className="text-xs font-medium bg-green-100 text-green-700 px-2 py-0.5 rounded-full ml-1">Today</span>}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {transaction.label}
                          {transaction.recurring && (
                            <span className="ml-2 text-xs text-blue-600">(Recurring)</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {transaction.notes}
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${
                          transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {transaction.amount >= 0 ? '+' : '-'}${Math.abs(transaction.amount).toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => handleEdit(transaction)}
                            className="text-blue-600 hover:text-blue-900 mr-3"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(transaction.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
            
            {/* Empty state */}
            {transactions.length === 0 && (
              <div className="text-center py-12">
                <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No transactions yet</h3>
                <p className="text-gray-600 mb-6">Start tracking your money by adding your first transaction!</p>
                <button
                  onClick={handleAddClick}
                  className="inline-flex items-center bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-2 rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all shadow-md hover:shadow-lg"
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Add Your First Transaction
                </button>
              </div>
            )}
            
            {/* Hidden future transactions notice */}
            {!showFutureTransactions && (() => {
              const today = new Date().toISOString().split('T')[0]
              const hiddenCount = transactions.filter(tx => tx.tx_date > today && tx.recurring).length
              if (hiddenCount > 0) {
                return (
                  <div className="border-t border-gray-200 px-6 py-4 bg-gray-50">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-gray-600">
                        {hiddenCount} future recurring {hiddenCount === 1 ? 'transaction' : 'transactions'} hidden
                      </p>
                      <button
                        onClick={() => setShowFutureTransactions(true)}
                        className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                      >
                        Show future →
                      </button>
                    </div>
                  </div>
                )
              }
              return null
            })()}
          </div>

          {/* Transaction Modal */}
          <TransactionModal
        isOpen={showTransactionModal}
        onClose={() => setShowTransactionModal(false)}
        onSuccess={fetchTransactions}
        initialType={modalType}
        initialCategory={modalCategory}
          />
        </div>
      </div>
    </div>
  )
}

export default Transactions