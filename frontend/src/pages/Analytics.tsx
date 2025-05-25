import { useState, useEffect } from 'react'
import { 
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area, ComposedChart
} from 'recharts'
import { 
  TrendingUp, TrendingDown, DollarSign, Calendar, 
  Download, Filter, ArrowUp, ArrowDown, Activity,
  PieChart as PieChartIcon, BarChart3, Wallet
} from 'lucide-react'
import axios from 'axios'
import { format } from 'date-fns'
import { useAuth } from '../hooks/useAuth'
import { 
  getDateRangePresets, formatDateForAPI, formatCurrency, 
  formatPercentage, CHART_COLORS, exportToCSV,
  DateRange
} from '../utils/analytics'

interface SummaryData {
  total_income: number
  total_expenses: number
  net_savings: number
  avg_daily_spending: number
  largest_expense_category: string | null
  transaction_count: number
  days_in_range: number
}

interface CategoryBreakdown {
  category: string
  amount: number
  percentage: number
  type: 'income' | 'expense'
}

interface TrendData {
  date: string
  income: number
  expenses: number
  net: number
}

interface ComparisonData {
  current_period: {
    income: number
    expenses: number
    net: number
    transaction_count: number
  }
  previous_period: {
    income: number
    expenses: number
    net: number
    transaction_count: number
  }
  changes: {
    income: number
    expenses: number
    net: number
    transaction_count: number
  }
}

const Analytics = () => {
  const { token } = useAuth()
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState<DateRange>(getDateRangePresets().last30Days)
  const [selectedPreset, setSelectedPreset] = useState('last30Days')
  
  // Data states
  const [summary, setSummary] = useState<SummaryData | null>(null)
  const [categoryBreakdown, setCategoryBreakdown] = useState<CategoryBreakdown[]>([])
  const [trends, setTrends] = useState<TrendData[]>([])
  const [comparison, setComparison] = useState<ComparisonData | null>(null)
  const [budgetPerformance, setBudgetPerformance] = useState<any[]>([])
  const [cashflow, setCashflow] = useState<any>(null)
  const [patterns, setPatterns] = useState<any>(null)

  // Filter states
  const [trendInterval, setTrendInterval] = useState<'daily' | 'weekly' | 'monthly'>('daily')
  const [categoryType, setCategoryType] = useState<'all' | 'income' | 'expense'>('expense')

  useEffect(() => {
    if (token) {
      fetchAllData()
    }
  }, [dateRange, token])

  const fetchAllData = async () => {
    setLoading(true)
    const startDate = formatDateForAPI(dateRange.start)
    const endDate = formatDateForAPI(dateRange.end)
    
    try {
      const headers = { Authorization: `Bearer ${token}` }
      
      // Fetch all data in parallel
      const [
        summaryRes,
        categoryRes,
        trendsRes,
        budgetRes,
        cashflowRes,
        patternsRes
      ] = await Promise.all([
        axios.get(`${import.meta.env.VITE_API_BASE}/analytics/summary`, {
          params: { start_date: startDate, end_date: endDate },
          headers
        }),
        axios.get(`${import.meta.env.VITE_API_BASE}/analytics/category-breakdown`, {
          params: { start_date: startDate, end_date: endDate, type: categoryType },
          headers
        }),
        axios.get(`${import.meta.env.VITE_API_BASE}/analytics/trends`, {
          params: { start_date: startDate, end_date: endDate, interval: trendInterval },
          headers
        }),
        axios.get(`${import.meta.env.VITE_API_BASE}/analytics/budget-performance`, {
          params: { start_date: startDate, end_date: endDate },
          headers
        }),
        axios.get(`${import.meta.env.VITE_API_BASE}/analytics/cashflow`, {
          params: { start_date: startDate, end_date: endDate },
          headers
        }),
        axios.get(`${import.meta.env.VITE_API_BASE}/analytics/patterns`, {
          params: { start_date: startDate, end_date: endDate },
          headers
        })
      ])
      
      setSummary(summaryRes.data)
      setCategoryBreakdown(categoryRes.data)
      setTrends(trendsRes.data)
      setBudgetPerformance(budgetRes.data)
      setCashflow(cashflowRes.data)
      setPatterns(patternsRes.data)
      
      // Fetch comparison data
      fetchComparison(startDate, endDate)
    } catch (error) {
      console.error('Error fetching analytics data:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchComparison = async (startDate: string, endDate: string) => {
    try {
      const start = new Date(startDate)
      const end = new Date(endDate)
      const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
      
      // Calculate previous period
      const prevEnd = new Date(start)
      prevEnd.setDate(prevEnd.getDate() - 1)
      const prevStart = new Date(prevEnd)
      prevStart.setDate(prevStart.getDate() - daysDiff)
      
      const response = await axios.get(`${import.meta.env.VITE_API_BASE}/analytics/comparison`, {
        params: {
          current_start: startDate,
          current_end: endDate,
          previous_start: formatDateForAPI(prevStart),
          previous_end: formatDateForAPI(prevEnd)
        },
        headers: { Authorization: `Bearer ${token}` }
      })
      
      setComparison(response.data)
    } catch (error) {
      console.error('Error fetching comparison data:', error)
    }
  }

  const handleDateRangeChange = (preset: string) => {
    setSelectedPreset(preset)
    setDateRange(getDateRangePresets()[preset])
  }

  const handleExportData = () => {
    const exportData = trends.map(item => ({
      Date: item.date,
      Income: item.income,
      Expenses: item.expenses,
      Net: item.net
    }))
    exportToCSV(exportData, 'budgeteer_analytics')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-full">
      <div className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Page Header */}
          <div className="mb-8">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-4xl font-bold text-gray-900 tracking-tight">Analytics</h1>
                <p className="mt-3 text-lg text-gray-600">
                  Deep insights into your financial patterns and spending habits
                </p>
              </div>
              <button
                onClick={handleExportData}
                className="flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Download className="h-4 w-4 mr-2" />
                Export Data
              </button>
            </div>
          </div>

          {/* Date Range Selector */}
          <div className="mb-8 bg-white rounded-2xl shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Time Period</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {Object.entries(getDateRangePresets()).map(([key, range]) => (
                <button
                  key={key}
                  onClick={() => handleDateRangeChange(key)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    selectedPreset === key
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {range.label}
                </button>
              ))}
            </div>
            <div className="mt-4 text-sm text-gray-600">
              Showing data from {format(dateRange.start, 'MMM d, yyyy')} to {format(dateRange.end, 'MMM d, yyyy')}
            </div>
          </div>

          {/* Summary Cards */}
          {summary && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-green-50 rounded-xl">
                    <TrendingUp className="h-6 w-6 text-green-600" />
                  </div>
                  <span className="text-sm font-medium text-green-600">Income</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(summary.total_income)}
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  {summary.days_in_range} days
                </p>
              </div>

              <div className="bg-white rounded-2xl shadow-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-red-50 rounded-xl">
                    <TrendingDown className="h-6 w-6 text-red-600" />
                  </div>
                  <span className="text-sm font-medium text-red-600">Expenses</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(summary.total_expenses)}
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  {formatCurrency(summary.avg_daily_spending)}/day avg
                </p>
              </div>

              <div className="bg-white rounded-2xl shadow-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-blue-50 rounded-xl">
                    <Wallet className="h-6 w-6 text-blue-600" />
                  </div>
                  <span className={`text-sm font-medium ${summary.net_savings >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {summary.net_savings >= 0 ? 'Savings' : 'Loss'}
                  </span>
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(Math.abs(summary.net_savings))}
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  {summary.transaction_count} transactions
                </p>
              </div>

              <div className="bg-white rounded-2xl shadow-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-purple-50 rounded-xl">
                    <Activity className="h-6 w-6 text-purple-600" />
                  </div>
                  <span className="text-sm font-medium text-purple-600">Top Category</span>
                </div>
                <p className="text-xl font-bold text-gray-900">
                  {summary.largest_expense_category || 'N/A'}
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  Highest spending
                </p>
              </div>
            </div>
          )}

          {/* Period Comparison */}
          {comparison && (
            <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Period Comparison</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <p className="text-sm text-gray-600 mb-2">Income Change</p>
                  <p className={`text-3xl font-bold ${comparison.changes.income >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatPercentage(comparison.changes.income)}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    {formatCurrency(comparison.current_period.income)} vs {formatCurrency(comparison.previous_period.income)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-600 mb-2">Expense Change</p>
                  <p className={`text-3xl font-bold ${comparison.changes.expenses <= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatPercentage(comparison.changes.expenses)}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    {formatCurrency(comparison.current_period.expenses)} vs {formatCurrency(comparison.previous_period.expenses)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-600 mb-2">Net Change</p>
                  <p className={`text-3xl font-bold ${comparison.changes.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatPercentage(comparison.changes.net)}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    {formatCurrency(comparison.current_period.net)} vs {formatCurrency(comparison.previous_period.net)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Income vs Expenses Trend */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Income vs Expenses Trend</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => setTrendInterval('daily')}
                    className={`px-3 py-1 text-sm rounded-lg ${
                      trendInterval === 'daily' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600'
                    }`}
                  >
                    Daily
                  </button>
                  <button
                    onClick={() => setTrendInterval('weekly')}
                    className={`px-3 py-1 text-sm rounded-lg ${
                      trendInterval === 'weekly' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600'
                    }`}
                  >
                    Weekly
                  </button>
                  <button
                    onClick={() => setTrendInterval('monthly')}
                    className={`px-3 py-1 text-sm rounded-lg ${
                      trendInterval === 'monthly' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600'
                    }`}
                  >
                    Monthly
                  </button>
                </div>
              </div>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trends}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis 
                      dataKey="date" 
                      stroke="#9ca3af"
                      fontSize={12}
                      tickFormatter={(value) => {
                        if (trendInterval === 'monthly') return format(new Date(value + '-01'), 'MMM')
                        return format(new Date(value), 'MMM d')
                      }}
                    />
                    <YAxis 
                      stroke="#9ca3af"
                      fontSize={12}
                      tickFormatter={(value) => `$${value}`}
                    />
                    <Tooltip 
                      formatter={(value: number) => formatCurrency(value)}
                      labelFormatter={(label) => {
                        if (trendInterval === 'monthly') return format(new Date(label + '-01'), 'MMMM yyyy')
                        return format(new Date(label), 'MMM d, yyyy')
                      }}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="income" 
                      stroke={CHART_COLORS.success}
                      strokeWidth={2}
                      dot={false}
                      name="Income"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="expenses" 
                      stroke={CHART_COLORS.danger}
                      strokeWidth={2}
                      dot={false}
                      name="Expenses"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Category Breakdown */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Category Breakdown</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCategoryType('expense')}
                    className={`px-3 py-1 text-sm rounded-lg ${
                      categoryType === 'expense' ? 'bg-red-100 text-red-700' : 'text-gray-600'
                    }`}
                  >
                    Expenses
                  </button>
                  <button
                    onClick={() => setCategoryType('income')}
                    className={`px-3 py-1 text-sm rounded-lg ${
                      categoryType === 'income' ? 'bg-green-100 text-green-700' : 'text-gray-600'
                    }`}
                  >
                    Income
                  </button>
                </div>
              </div>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryBreakdown}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ category, percentage }) => `${category} ${percentage}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="amount"
                    >
                      {categoryBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS.categories[index % CHART_COLORS.categories.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 space-y-2 max-h-40 overflow-y-auto">
                {categoryBreakdown.map((category, index) => (
                  <div key={category.category} className="flex justify-between items-center text-sm">
                    <div className="flex items-center">
                      <div 
                        className="w-3 h-3 rounded-full mr-2"
                        style={{ backgroundColor: CHART_COLORS.categories[index % CHART_COLORS.categories.length] }}
                      />
                      <span className="text-gray-700">{category.category}</span>
                    </div>
                    <span className="font-medium text-gray-900">{formatCurrency(category.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Budget Performance */}
          {budgetPerformance.length > 0 && (
            <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Budget Performance</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={budgetPerformance}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis 
                      dataKey="month" 
                      stroke="#9ca3af"
                      fontSize={12}
                      tickFormatter={(value) => format(new Date(value + '-01'), 'MMM')}
                    />
                    <YAxis 
                      stroke="#9ca3af"
                      fontSize={12}
                      tickFormatter={(value) => `$${value}`}
                    />
                    <Tooltip 
                      formatter={(value: number) => formatCurrency(value)}
                      labelFormatter={(label) => format(new Date(label + '-01'), 'MMMM yyyy')}
                    />
                    <Legend />
                    <Bar dataKey="budget" fill={CHART_COLORS.info} name="Budget" opacity={0.7} />
                    <Bar dataKey="actual" fill={CHART_COLORS.danger} name="Actual" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Spending Patterns */}
          {patterns && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              {/* Day of Week Analysis */}
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">Spending by Day of Week</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={patterns.day_of_week_analysis}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                      <XAxis dataKey="day" stroke="#9ca3af" fontSize={12} />
                      <YAxis stroke="#9ca3af" fontSize={12} tickFormatter={(value) => `$${value}`} />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Bar dataKey="average_spending" fill={CHART_COLORS.primary} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-sm text-gray-600 mt-4">
                  Peak spending day: <span className="font-semibold">{patterns.peak_spending_day}</span>
                </p>
              </div>

              {/* Cash Flow */}
              {cashflow && (
                <div className="bg-white rounded-2xl shadow-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-6">Cash Flow Summary</h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Total Income</span>
                      <span className="font-semibold text-green-600">
                        {formatCurrency(cashflow.summary.total_income)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Total Expenses</span>
                      <span className="font-semibold text-red-600">
                        {formatCurrency(cashflow.summary.total_expenses)}
                      </span>
                    </div>
                    <div className="border-t pt-4">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-900 font-medium">Net Cash Flow</span>
                        <span className={`font-bold text-lg ${
                          cashflow.summary.net_cashflow >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {formatCurrency(cashflow.summary.net_cashflow)}
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-6">
                      <div className="text-center p-4 bg-green-50 rounded-lg">
                        <p className="text-2xl font-bold text-green-600">{cashflow.summary.positive_days}</p>
                        <p className="text-sm text-gray-600">Positive Days</p>
                      </div>
                      <div className="text-center p-4 bg-red-50 rounded-lg">
                        <p className="text-2xl font-bold text-red-600">{cashflow.summary.negative_days}</p>
                        <p className="text-sm text-gray-600">Negative Days</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Analytics