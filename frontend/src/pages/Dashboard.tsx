import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { 
  Wallet, TrendingUp, Target, Plus, Download, 
  ArrowUpRight, ArrowDownRight, Calendar, Receipt 
} from 'lucide-react'
import axios from 'axios'
import { useAuth } from '../hooks/useAuth'
import SpendingChart from '../components/SpendingChart'
import TransactionModal from '../components/TransactionModal'
import QuickAddButtons from '../components/QuickAddButtons'

interface Transaction {
  id: number
  tx_date: string
  amount: number
  label: string
  notes?: string
}

interface BudgetGoal {
  month: string
  amount: number
}

interface QuickStats {
  currentBalance: number
  monthSpent: number
  budgetRemaining: number
  percentUsed: number
}

const Dashboard = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [budgetGoal, setBudgetGoal] = useState<BudgetGoal | null>(null)
  const [stats, setStats] = useState<QuickStats>({
    currentBalance: 0,
    monthSpent: 0,
    budgetRemaining: 0,
    percentUsed: 0,
  })
  const [chartData, setChartData] = useState<Array<{ date: string; amount: number }>>([])
  const [loading, setLoading] = useState(true)
  const [showTransactionModal, setShowTransactionModal] = useState(false)
  const [modalType, setModalType] = useState<'income' | 'expense'>('expense')
  const [modalCategory, setModalCategory] = useState<string | undefined>()
  
  const { token } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    fetchData()
  }, [token])

  const fetchData = async () => {
    if (!token) return

    try {
      const [txResponse, goalResponse] = await Promise.all([
        axios.get(`${import.meta.env.VITE_API_BASE}/tx`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${import.meta.env.VITE_API_BASE}/goal`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ])

      const txData = txResponse.data
      setTransactions(txData)

      // Calculate stats
      const currentMonth = new Date().toISOString().slice(0, 7)
      const monthTransactions = txData.filter((tx: Transaction) => 
        tx.tx_date.startsWith(currentMonth)
      )
      
      const totalBalance = txData.reduce((sum: number, tx: Transaction) => sum + tx.amount, 0)
      const monthSpent = monthTransactions
        .filter((tx: Transaction) => tx.amount < 0)
        .reduce((sum: number, tx: Transaction) => sum + Math.abs(tx.amount), 0)

      let budgetRemaining = 0
      let percentUsed = 0

      if (goalResponse.data) {
        setBudgetGoal(goalResponse.data)
        budgetRemaining = Math.max(0, goalResponse.data.amount - monthSpent)
        percentUsed = (monthSpent / goalResponse.data.amount) * 100
      }

      setStats({
        currentBalance: totalBalance,
        monthSpent,
        budgetRemaining,
        percentUsed,
      })

      // Prepare chart data (last 7 days)
      const last7Days = prepareChartData(txData)
      setChartData(last7Days)
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const prepareChartData = (transactions: Transaction[]) => {
    const days = 7
    const data = []
    const today = new Date()

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]
      
      const dayTotal = transactions
        .filter(tx => tx.tx_date === dateStr && tx.amount < 0)
        .reduce((sum, tx) => sum + Math.abs(tx.amount), 0)

      data.push({
        date: date.toLocaleDateString('en', { month: 'short', day: 'numeric' }),
        amount: dayTotal,
      })
    }

    return data
  }

  const handleQuickAdd = (type: 'income' | 'expense', category?: string) => {
    setModalType(type)
    setModalCategory(category)
    setShowTransactionModal(true)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-gray-50">
      <div className="py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Page Header */}
          <div className="mb-10">
            <h1 className="text-4xl font-bold text-gray-900 tracking-tight">Dashboard</h1>
            <p className="mt-3 text-lg text-gray-600">
              Welcome back! Here's your financial overview for {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}.
            </p>
          </div>

          {/* Quick Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            {/* Current Balance */}
            <div className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-shadow duration-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Wallet className="h-6 w-6 text-blue-600" />
            </div>
            <span className={`text-sm font-medium ${stats.currentBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {stats.currentBalance >= 0 ? '+' : '-'}
              {((Math.abs(stats.currentBalance) - Math.abs(stats.monthSpent)) / Math.abs(stats.monthSpent) * 100).toFixed(0)}%
            </span>
          </div>
          <h3 className="text-sm font-medium text-gray-600">Current Balance</h3>
          <p className={`text-2xl font-bold mt-1 ${stats.currentBalance >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
            ${Math.abs(stats.currentBalance).toFixed(2)}
          </p>
        </div>

            {/* This Month Spent */}
            <div className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-shadow duration-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-red-50 rounded-lg">
              <TrendingUp className="h-6 w-6 text-red-600" />
            </div>
            <span className="text-sm font-medium text-red-600">
              <ArrowUpRight className="h-4 w-4 inline" />
              This month
            </span>
          </div>
          <h3 className="text-sm font-medium text-gray-600">Month Spent</h3>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            ${stats.monthSpent.toFixed(2)}
          </p>
        </div>

            {/* Budget Remaining */}
            <div className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-shadow duration-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-green-50 rounded-lg">
              <Target className="h-6 w-6 text-green-600" />
            </div>
            <span className={`text-sm font-medium ${stats.percentUsed > 100 ? 'text-red-600' : stats.percentUsed > 80 ? 'text-yellow-600' : 'text-green-600'}`}>
              {stats.percentUsed.toFixed(0)}% used
            </span>
          </div>
          <h3 className="text-sm font-medium text-gray-600">Budget Remaining</h3>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            ${budgetGoal ? stats.budgetRemaining.toFixed(2) : '—'}
          </p>
          {budgetGoal && (
            <div className="mt-3">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    stats.percentUsed > 100 ? 'bg-red-600' : 
                    stats.percentUsed > 80 ? 'bg-yellow-600' : 'bg-green-600'
                  }`}
                  style={{ width: `${Math.min(stats.percentUsed, 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

          {/* Quick Actions */}
          <div className="mb-10">
            <QuickAddButtons onQuickAdd={handleQuickAdd} />
          </div>

          {/* Charts and Recent Transactions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Spending Chart */}
        <SpendingChart data={chartData} />

            {/* Recent Transactions */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Recent Transactions</h3>
            <Link
              to="/transactions"
              className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
            >
              View all
            </Link>
          </div>
          <div className="space-y-3">
            {transactions.slice(0, 5).map((transaction) => (
              <div
                key={transaction.id}
                className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-lg ${
                    transaction.amount >= 0 ? 'bg-green-50' : 'bg-red-50'
                  }`}>
                    {transaction.amount >= 0 ? (
                      <ArrowDownRight className="h-4 w-4 text-green-600" />
                    ) : (
                      <ArrowUpRight className="h-4 w-4 text-red-600" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {transaction.label}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(transaction.tx_date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <span className={`text-sm font-medium ${
                  transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {transaction.amount >= 0 ? '+' : '-'}${Math.abs(transaction.amount).toFixed(2)}
                </span>
              </div>
            ))}
            {transactions.length === 0 && (
              <p className="text-center text-gray-500 py-8">
                No transactions yet. Start by adding your first transaction!
              </p>
            )}
          </div>
        </div>
      </div>

          {/* Transaction Modal */}
          <TransactionModal
        isOpen={showTransactionModal}
        onClose={() => setShowTransactionModal(false)}
        onSuccess={fetchData}
        initialType={modalType}
        initialCategory={modalCategory}
          />
        </div>
      </div>
    </div>
  )
}

export default Dashboard