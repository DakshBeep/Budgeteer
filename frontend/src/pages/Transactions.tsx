import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Plus, Search, Calendar, DollarSign, Tag, Edit2, Trash2, Clock, History } from 'lucide-react'
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
  const [viewMode, setViewMode] = useState<'actual' | 'timeline'>('actual')
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
    let filtered = transactions
    
    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(tx =>
        tx.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (tx.notes && tx.notes.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    }
    
    // Filter by view mode
    if (viewMode === 'actual') {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      filtered = filtered.filter(tx => new Date(tx.tx_date) <= today)
    }
    
    setFilteredTransactions(filtered)
  }, [searchTerm, transactions, viewMode])

  const fetchTransactions = async () => {
    if (!token) return

    try {
      // Always fetch all transactions including future ones
      const response = await axios.get(buildApiUrl('/tx'), {
        headers: { Authorization: `Bearer ${token}` },
      })
      setTransactions(response.data)
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

          <div className="mb-8 space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
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
              
              <button
                onClick={() => setViewMode(viewMode === 'actual' ? 'timeline' : 'actual')}
                className={`flex items-center px-6 py-3 rounded-xl font-medium transition-all shadow-sm hover:shadow-md ${
                  viewMode === 'timeline'
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white'
                    : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {viewMode === 'actual' ? (
                  <>
                    <History className="h-4 w-4 mr-2" />
                    Actual Spending
                  </>
                ) : (
                  <>
                    <Clock className="h-4 w-4 mr-2" />
                    Full Timeline
                  </>
                )}
              </button>
            </div>
            
            {viewMode === 'timeline' && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
                <p className="text-sm text-blue-800">
                  <span className="font-medium">Timeline View:</span> Showing all transactions including future scheduled payments. Future transactions don't affect your current budget.
                </p>
              </div>
            )}
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
                {filteredTransactions.map((transaction) => (
                  <tr key={transaction.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(transaction.tx_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      <div className="flex items-center">
                        {transaction.label}
                        {transaction.recurring && (
                          <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">Recurring</span>
                        )}
                        {new Date(transaction.tx_date) > new Date() && (
                          <span className="ml-2 text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">Scheduled</span>
                        )}
                      </div>
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
                ))}
              </tbody>
            </table>
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