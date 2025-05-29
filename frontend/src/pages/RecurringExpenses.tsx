import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowPathIcon,
  CalendarDaysIcon,
  PlusIcon,
  PauseIcon,
  PlayIcon,
  TrashIcon,
  BellIcon,
  CurrencyDollarIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';
import { buildApiUrl } from '../utils/api';
import axios from 'axios';
import { useAuth } from '../hooks/useAuth';

interface RecurringExpense {
  id: number;
  name: string;
  amount: number;
  category: string;
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';
  next_date: string;
  is_active: boolean;
  reminder_days?: number;
  notes?: string;
  series_id: number;
  color?: string;
  icon?: string;
}

interface RecurringStats {
  total_monthly: number;
  total_yearly: number;
  active_count: number;
  paused_count: number;
  upcoming_week: RecurringExpense[];
  by_category: Record<string, number>;
}

const recurringCategories = [
  { value: 'streaming', label: '🎬 Streaming', color: 'purple' },
  { value: 'phone', label: '📱 Phone & Internet', color: 'blue' },
  { value: 'selfcare', label: '💇🏾‍♀️ Self-Care', color: 'pink' },
  { value: 'fitness', label: '💪🏾 Fitness & Wellness', color: 'green' },
  { value: 'education', label: '📚 Education & Loans', color: 'yellow' },
  { value: 'family', label: '👨‍👩‍👧 Family Support', color: 'red' },
  { value: 'transport', label: '🚇 Transportation', color: 'indigo' },
  { value: 'housing', label: '🏠 Housing', color: 'gray' },
  { value: 'insurance', label: '🛡️ Insurance', color: 'teal' },
  { value: 'other', label: '📦 Other', color: 'orange' }
];

const frequencies = [
  { value: 'daily', label: 'Daily', description: 'Every day' },
  { value: 'weekly', label: 'Weekly', description: 'Every week' },
  { value: 'biweekly', label: 'Bi-weekly', description: 'Every 2 weeks' },
  { value: 'monthly', label: 'Monthly', description: 'Every month' },
  { value: 'quarterly', label: 'Quarterly', description: 'Every 3 months' },
  { value: 'yearly', label: 'Yearly', description: 'Once a year' }
];

const RecurringExpenses = () => {
  const { token } = useAuth();
  const [expenses, setExpenses] = useState<RecurringExpense[]>([]);
  const [stats, setStats] = useState<RecurringStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<RecurringExpense | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'timeline'>('grid');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [showOnlyActive, setShowOnlyActive] = useState(true);
  const [savingExpense, setSavingExpense] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    amount: '',
    category: 'other',
    frequency: 'monthly',
    next_date: new Date().toISOString().split('T')[0],
    reminder_days: 3,
    notes: ''
  });

  // Fetch recurring expenses
  const fetchRecurringExpenses = useCallback(async () => {
    try {
      setError(null);
      const headers = { Authorization: `Bearer ${token}` };
      
      // Fetch both expenses and stats
      const [expensesRes, statsRes] = await Promise.all([
        axios.get(buildApiUrl('/recurring/expenses'), { headers }),
        axios.get(buildApiUrl('/recurring/stats'), { headers })
      ]);

      setExpenses(expensesRes.data);
      setStats(statsRes.data);

    } catch (err) {
      console.error('Error fetching recurring expenses:', err);
      setError('Failed to load recurring expenses. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchRecurringExpenses();
  }, [fetchRecurringExpenses]);

  useEffect(() => {
    if (editingExpense) {
      setFormData({
        name: editingExpense.name,
        amount: Math.abs(editingExpense.amount).toString(),
        category: mapBackendCategoryToFrontend(editingExpense.category || 'other'),
        frequency: editingExpense.frequency || 'monthly',
        next_date: editingExpense.next_date,
        reminder_days: editingExpense.reminder_days || 3,
        notes: editingExpense.notes || ''
      });
      setShowAddModal(true);
    }
  }, [editingExpense]);

  const calculateMonthlyAmount = (amount: number, frequency: string): number => {
    switch (frequency) {
      case 'daily': return amount * 30;
      case 'weekly': return amount * 4.33;
      case 'biweekly': return amount * 2.17;
      case 'monthly': return amount;
      case 'quarterly': return amount / 3;
      case 'yearly': return amount / 12;
      default: return amount;
    }
  };

  const getDaysUntilNext = (nextDate: string): number => {
    return Math.ceil((new Date(nextDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  };

  const toggleExpenseStatus = async (expense: RecurringExpense) => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      await axios.patch(
        buildApiUrl(`/recurring/expenses/${expense.id}/toggle`), 
        {}, 
        { headers }
      );
      await fetchRecurringExpenses();
    } catch (err) {
      console.error('Error toggling expense:', err);
      setError('Failed to update expense. Please try again.');
      setTimeout(() => setError(null), 3000);
    }
  };

  const deleteExpense = async (id: number) => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      await axios.delete(
        buildApiUrl(`/recurring/expenses/${id}`), 
        { headers }
      );
      setDeleteConfirmId(null);
      await fetchRecurringExpenses();
    } catch (err) {
      console.error('Error deleting expense:', err);
      setError('Failed to delete expense. Please try again.');
      setTimeout(() => setError(null), 3000);
    }
  };

  const getCategoryStyle = (category: string) => {
    const cat = recurringCategories.find(c => c.value === category);
    return cat?.color || 'gray';
  };

  const mapBackendCategoryToFrontend = (backendCategory: string): string => {
    // Map backend category format to frontend values
    const mappings: Record<string, string> = {
      'phoneinternet': 'phone',
      'phone&internet': 'phone',
      'self-care': 'selfcare',
      'selfcare': 'selfcare',
      'fitness&wellness': 'fitness',
      'fitnesswellness': 'fitness',
      'education&loans': 'education',
      'educationloans': 'education',
      'familysupport': 'family',
      'family support': 'family',
      'transportation': 'transport',
      'housing': 'housing',
      'insurance': 'insurance',
      'streaming': 'streaming'
    };
    
    const normalized = backendCategory.toLowerCase().replace(/[^a-z]/g, '');
    return mappings[normalized] || mappings[backendCategory.toLowerCase()] || 'other';
  };

  const handleSaveRecurring = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingExpense(true);
    
    try {
      const headers = { Authorization: `Bearer ${token}` };
      
      if (editingExpense) {
        // For editing, we need to update all transactions in the series
        // First, get all transactions with this series_id
        const txResponse = await axios.get(buildApiUrl('/tx'), { headers });
        const seriesTransactions = txResponse.data.filter((tx: any) => 
          tx.series_id === editingExpense.series_id
        );
        
        // Update each transaction in the series
        const updateData = {
          amount: -Math.abs(parseFloat(formData.amount)),
          label: formData.category === 'other' ? formData.name : 
                 recurringCategories.find(c => c.value === formData.category)?.label.split(' ').slice(1).join(' ') || formData.name,
          notes: formData.name,
          recurring: true
        };
        
        // Update the first transaction with propagate=true to update all in series
        if (seriesTransactions.length > 0) {
          await axios.put(
            buildApiUrl(`/tx/${seriesTransactions[0].id}?propagate=true`), 
            { ...updateData, tx_date: seriesTransactions[0].tx_date },
            { headers }
          );
        }
      } else {
        // Create new recurring transaction
        const txData = {
          tx_date: formData.next_date,
          amount: -Math.abs(parseFloat(formData.amount)),
          label: formData.category === 'other' ? formData.name : 
                 recurringCategories.find(c => c.value === formData.category)?.label.split(' ').slice(1).join(' ') || formData.name,
          notes: formData.name,
          recurring: true
        };
        
        await axios.post(buildApiUrl('/tx'), txData, { headers });
      }
      
      // Reset form and close modal
      setFormData({
        name: '',
        amount: '',
        category: 'other',
        frequency: 'monthly',
        next_date: new Date().toISOString().split('T')[0],
        reminder_days: 3,
        notes: ''
      });
      setShowAddModal(false);
      setEditingExpense(null);
      
      // Refresh the list
      await fetchRecurringExpenses();
    } catch (err) {
      console.error('Error saving recurring expense:', err);
      setError(editingExpense ? 'Failed to update recurring expense. Please try again.' : 'Failed to create recurring expense. Please try again.');
      setTimeout(() => setError(null), 3000);
    } finally {
      setSavingExpense(false);
    }
  };

  const filteredExpenses = expenses.filter(expense => {
    if (filterCategory !== 'all' && expense.category !== filterCategory) return false;
    if (showOnlyActive && !expense.is_active) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Error Alert */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <ExclamationTriangleIcon className="h-5 w-5 text-red-600" />
              <p className="text-red-700">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-red-600 hover:text-red-800"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <ArrowPathIcon className="h-8 w-8 text-indigo-600" />
              Recurring Expenses
            </h1>
            <p className="mt-2 text-gray-600">
              Stay on top of your subscriptions and regular payments
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 flex items-center gap-2"
          >
            <PlusIcon className="h-5 w-5" />
            Add Recurring
          </button>
        </div>
      </div>

      {/* Income Impact Alert */}
      {stats && stats.total_monthly > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <SparklesIcon className="h-6 w-6 text-indigo-600" />
              <div>
                <p className="text-sm font-medium text-gray-900">
                  Your recurring expenses are ${stats.total_monthly.toFixed(2)}/month
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  💡 Tip: Keep recurring expenses under 50% of your income for financial flexibility
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl p-6 text-white"
          >
            <h3 className="text-sm font-medium opacity-90">Monthly Total</h3>
            <p className="text-3xl font-bold mt-1">${stats.total_monthly.toFixed(2)}</p>
            <p className="text-xs mt-2 opacity-80">${stats.total_yearly.toFixed(0)}/year</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-xl shadow p-6"
          >
            <h3 className="text-sm font-medium text-gray-600">Active</h3>
            <p className="text-3xl font-bold text-gray-900 mt-1">{stats.active_count}</p>
            <p className="text-xs text-gray-500 mt-2">{stats.paused_count} paused</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-xl shadow p-6"
          >
            <h3 className="text-sm font-medium text-gray-600">This Week</h3>
            <p className="text-3xl font-bold text-gray-900 mt-1">{stats.upcoming_week.length}</p>
            <p className="text-xs text-gray-500 mt-2">charges coming</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-gradient-to-r from-yellow-400 to-orange-500 rounded-xl p-6 text-white"
          >
            <h3 className="text-sm font-medium opacity-90">Top Category</h3>
            <p className="text-xl font-bold mt-1">
              {Object.entries(stats.by_category).sort(([,a], [,b]) => b - a)[0]?.[0] || 'None'}
            </p>
            <p className="text-xs mt-2 opacity-80">
              ${Object.values(stats.by_category).sort((a, b) => b - a)[0]?.toFixed(0) || 0}/mo
            </p>
          </motion.div>
        </div>
      )}

      {/* Filters and View Toggle */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="rounded-lg border-gray-300 text-sm"
            >
              <option value="all">All Categories</option>
              {recurringCategories.map(cat => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
            
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showOnlyActive}
                onChange={(e) => setShowOnlyActive(e.target.checked)}
                className="rounded text-indigo-600"
              />
              Active only
            </label>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded ${viewMode === 'grid' ? 'bg-indigo-100 text-indigo-600' : 'text-gray-500'}`}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode('timeline')}
              className={`p-2 rounded ${viewMode === 'timeline' ? 'bg-indigo-100 text-indigo-600' : 'text-gray-500'}`}
            >
              <CalendarDaysIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Expense Grid */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {filteredExpenses.map((expense) => {
              const daysUntil = getDaysUntilNext(expense.next_date);
              const mappedCategory = mapBackendCategoryToFrontend(expense.category || 'other');
              const color = getCategoryStyle(mappedCategory);
              const category = recurringCategories.find(c => c.value === mappedCategory);
              
              return (
                <motion.div
                  key={expense.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={`bg-white rounded-xl shadow-lg overflow-hidden ${
                    !expense.is_active ? 'opacity-60' : ''
                  }`}
                >
                  <div className={`h-2 bg-${color}-500`} />
                  
                  <div className="p-5">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-semibold text-lg text-gray-900">{expense.name}</h3>
                        <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                          {category?.label}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-gray-900">${expense.amount}</p>
                        <p className="text-xs text-gray-500">/{expense.frequency}</p>
                      </div>
                    </div>

                    <div className="space-y-2 mb-4">
                      {expense.is_active ? (
                        <div className={`flex items-center gap-2 text-sm ${
                          daysUntil <= 3 ? 'text-red-600' : 'text-gray-600'
                        }`}>
                          <ClockIcon className="h-4 w-4" />
                          {daysUntil === 0 ? 'Due today!' : 
                           daysUntil === 1 ? 'Due tomorrow' :
                           `Due in ${daysUntil} days`}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <PauseIcon className="h-4 w-4" />
                          Paused
                        </div>
                      )}
                      
                      {expense.reminder_days && expense.is_active && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <BellIcon className="h-4 w-4" />
                          Reminder {expense.reminder_days} days before
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleExpenseStatus(expense)}
                        className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium flex items-center justify-center gap-2 ${
                          expense.is_active
                            ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            : 'bg-green-100 text-green-700 hover:bg-green-200'
                        }`}
                      >
                        {expense.is_active ? (
                          <>
                            <PauseIcon className="h-4 w-4" />
                            Pause
                          </>
                        ) : (
                          <>
                            <PlayIcon className="h-4 w-4" />
                            Resume
                          </>
                        )}
                      </button>
                      
                      <button
                        onClick={() => setEditingExpense(expense)}
                        className="p-2 text-gray-500 hover:text-gray-700"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      
                      {deleteConfirmId === expense.id ? (
                        <div className="flex gap-1">
                          <button
                            onClick={() => deleteExpense(expense.id)}
                            className="p-1 text-red-600 hover:text-red-800"
                            title="Confirm delete"
                          >
                            <CheckCircleIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="p-1 text-gray-500 hover:text-gray-700"
                            title="Cancel"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirmId(expense.id)}
                          className="p-2 text-red-500 hover:text-red-700"
                          title="Delete expense"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Timeline View */}
      {viewMode === 'timeline' && (
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Upcoming Charges</h3>
          <div className="space-y-2">
            {filteredExpenses
              .filter(e => e.is_active)
              .sort((a, b) => new Date(a.next_date).getTime() - new Date(b.next_date).getTime())
              .map((expense) => {
                const daysUntil = getDaysUntilNext(expense.next_date);
                const mappedCategory = mapBackendCategoryToFrontend(expense.category || 'other');
                const category = recurringCategories.find(c => c.value === mappedCategory);
                
                return (
                  <div
                    key={expense.id}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">{category?.label.split(' ')[0]}</div>
                      <div>
                        <p className="font-medium">{expense.name}</p>
                        <p className="text-sm text-gray-500">
                          {new Date(expense.next_date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">${expense.amount}</p>
                      <p className={`text-sm ${daysUntil <= 3 ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                        {daysUntil === 0 ? 'Today' : `${daysUntil} days`}
                      </p>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Empty State */}
      {filteredExpenses.length === 0 && (
        <div className="text-center py-12">
          <ArrowPathIcon className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No recurring expenses</h3>
          <p className="mt-1 text-sm text-gray-500">Get started by adding your subscriptions and bills.</p>
          <div className="mt-6">
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
            >
              <PlusIcon className="-ml-1 mr-2 h-5 w-5" />
              Add Recurring Expense
            </button>
          </div>
        </div>
      )}

      {/* Beautiful Add/Edit Modal */}
      {(showAddModal || editingExpense) && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget && !savingExpense) {
              setShowAddModal(false);
              setEditingExpense(null);
            }
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto"
          >
            <h2 className="text-xl font-semibold mb-4">
              {editingExpense ? 'Edit Recurring Expense' : 'Add Recurring Expense'}
            </h2>
            
            <form onSubmit={handleSaveRecurring}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Netflix, T-Mobile, Gym..."
                    className="w-full rounded-lg border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Amount
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                      <input
                        type="number"
                        step="0.01"
                        required
                        placeholder="0.00"
                        className="w-full pl-7 rounded-lg border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
                        value={formData.amount}
                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Frequency
                    </label>
                    <select
                      required
                      className="w-full rounded-lg border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
                      value={formData.frequency}
                      onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                    >
                      {frequencies.map(freq => (
                        <option key={freq.value} value={freq.value}>
                          {freq.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category
                  </label>
                  <select
                    required
                    className="w-full rounded-lg border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  >
                    {recurringCategories.map(cat => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Next Charge Date
                  </label>
                  <input
                    type="date"
                    required
                    className="w-full rounded-lg border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
                    value={formData.next_date}
                    onChange={(e) => setFormData({ ...formData, next_date: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reminder (days before)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="30"
                    className="w-full rounded-lg border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
                    value={formData.reminder_days}
                    onChange={(e) => setFormData({ ...formData, reminder_days: parseInt(e.target.value) || 3 })}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    We'll remind you {formData.reminder_days} days before each charge
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes (optional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Any additional notes..."
                    className="w-full rounded-lg border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingExpense(null);
                  }}
                  disabled={savingExpense}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingExpense}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {savingExpense ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Saving...
                    </>
                  ) : (
                    editingExpense ? 'Save Changes' : 'Add Expense'
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default RecurringExpenses;