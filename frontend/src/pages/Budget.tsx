import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CurrencyDollarIcon,
  ChartPieIcon,
  CalendarIcon,
  BellIcon,
  PlusIcon,
  SparklesIcon,
  AcademicCapIcon,
  BriefcaseIcon,
  HomeIcon,
  UserGroupIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { buildApiUrl } from '../utils/api';
import axios from 'axios';
import { useAuth } from '../hooks/useAuth';

interface CategoryBudget {
  id: number;
  category: string;
  amount: number;
  period: string;
  spent: number;
  remaining: number;
  percentage: number;
  is_active: boolean;
  start_date: string;
  end_date?: string;
}

interface BudgetTemplate {
  name: string;
  description: string;
  monthly_total: number;
  categories: Record<string, number>;
}

interface Bill {
  id: number;
  name: string;
  amount: number;
  category: string;
  due_day: number;
  frequency: string;
  is_autopay: boolean;
  next_due: string;
  last_paid?: string;
}

interface SavingsGoal {
  id: number;
  name: string;
  target_amount: number;
  current_amount: number;
  target_date?: string;
  progress_percentage: number;
  monthly_contribution_needed: number;
}

interface BudgetAnalysis {
  total_budget: number;
  total_spent: number;
  total_remaining: number;
  days_left_in_period: number;
  daily_budget_remaining: number;
  categories: CategoryBudget[];
  overspending_categories: string[];
  savings_rate: number;
}

const Budget = () => {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'categories' | 'bills' | 'savings' | 'templates'>('overview');
  const [budgetAnalysis, setBudgetAnalysis] = useState<BudgetAnalysis | null>(null);
  const [categoryBudgets, setCategoryBudgets] = useState<CategoryBudget[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([]);
  const [templates, setTemplates] = useState<Record<string, BudgetTemplate>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [modalType, setModalType] = useState<'budget' | 'bill' | 'savings'>('budget');
  const [selectedPeriod, setSelectedPeriod] = useState('monthly');

  // Fetch all budget data
  const fetchBudgetData = useCallback(async () => {
    try {
      setError(null);
      const headers = { Authorization: `Bearer ${token}` };
      const [analysisRes, billsRes, goalsRes, templatesRes] = await Promise.all([
        axios.get(buildApiUrl(`/budgets/analysis?period=${selectedPeriod}`), { headers }),
        axios.get(buildApiUrl('/bills?upcoming_days=30'), { headers }),
        axios.get(buildApiUrl('/savings-goals'), { headers }),
        axios.get(buildApiUrl('/budgets/templates'), { headers })
      ]);

      setBudgetAnalysis(analysisRes.data);
      setCategoryBudgets(analysisRes.data.categories);
      setBills(billsRes.data);
      setSavingsGoals(goalsRes.data);
      setTemplates(templatesRes.data);
    } catch (err) {
      console.error('Error fetching budget data:', err);
      setError('Failed to load budget data');
    } finally {
      setLoading(false);
    }
  }, [selectedPeriod, token]);

  useEffect(() => {
    fetchBudgetData();
  }, [fetchBudgetData]);

  const applyTemplate = async (templateId: string) => {
    try {
      await axios.post(
        buildApiUrl(`/budgets/apply-template?template_id=${templateId}`),
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await fetchBudgetData();
      setActiveTab('categories');
    } catch (err) {
      console.error('Error applying template:', err);
      setError('Failed to apply budget template');
    }
  };

  const markBillPaid = async (billId: number) => {
    try {
      await axios.put(
        buildApiUrl(`/bills/${billId}/mark-paid`),
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await fetchBudgetData();
    } catch (err) {
      console.error('Error marking bill as paid:', err);
    }
  };

  const contributeSavings = async (goalId: number, amount: number) => {
    try {
      await axios.post(
        buildApiUrl(`/savings-goals/${goalId}/contribute`),
        { amount },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await fetchBudgetData();
    } catch (err) {
      console.error('Error contributing to savings:', err);
    }
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return 'bg-red-500';
    if (percentage >= 80) return 'bg-yellow-500';
    if (percentage >= 60) return 'bg-blue-500';
    return 'bg-green-500';
  };

  const getTemplateIcon = (templateId: string) => {
    switch (templateId) {
      case 'broke_student': return <AcademicCapIcon className="h-8 w-8" />;
      case 'first_job': return <BriefcaseIcon className="h-8 w-8" />;
      case 'grad_student': return <AcademicCapIcon className="h-8 w-8" />;
      case 'intern': return <BriefcaseIcon className="h-8 w-8" />;
      case 'freelancer': return <UserGroupIcon className="h-8 w-8" />;
      default: return <HomeIcon className="h-8 w-8" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <p className="text-red-700">{error}</p>
          <button
            onClick={() => {
              setError(null);
              setLoading(true);
              fetchBudgetData();
            }}
            className="mt-4 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Budget Management</h1>
        <p className="mt-2 text-gray-600">
          Take control of your finances with smart budgeting
        </p>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow p-2 mb-6">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'overview'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <ChartPieIcon className="h-4 w-4 inline mr-2" />
            Overview
          </button>
          <button
            onClick={() => setActiveTab('categories')}
            className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'categories'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <CurrencyDollarIcon className="h-4 w-4 inline mr-2" />
            Categories
          </button>
          <button
            onClick={() => setActiveTab('bills')}
            className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'bills'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <CalendarIcon className="h-4 w-4 inline mr-2" />
            Bills
          </button>
          <button
            onClick={() => setActiveTab('savings')}
            className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'savings'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <SparklesIcon className="h-4 w-4 inline mr-2" />
            Savings
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'templates'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <AcademicCapIcon className="h-4 w-4 inline mr-2" />
            Templates
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {/* Overview Tab */}
        {activeTab === 'overview' && budgetAnalysis && (
          <motion.div
            key="overview"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-sm font-medium text-gray-500">Total Budget</h3>
                <p className="text-2xl font-bold text-gray-900">
                  ${budgetAnalysis.total_budget.toFixed(2)}
                </p>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-sm font-medium text-gray-500">Spent</h3>
                <p className="text-2xl font-bold text-red-600">
                  ${budgetAnalysis.total_spent.toFixed(2)}
                </p>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-sm font-medium text-gray-500">Remaining</h3>
                <p className="text-2xl font-bold text-green-600">
                  ${budgetAnalysis.total_remaining.toFixed(2)}
                </p>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-sm font-medium text-gray-500">Daily Budget</h3>
                <p className="text-2xl font-bold text-blue-600">
                  ${budgetAnalysis.daily_budget_remaining.toFixed(2)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {budgetAnalysis.days_left_in_period} days left
                </p>
              </div>
            </div>

            {/* Alerts */}
            {budgetAnalysis.overspending_categories.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <ExclamationTriangleIcon className="h-5 w-5 text-red-600" />
                  <h3 className="font-semibold text-red-900">Budget Alerts</h3>
                </div>
                <p className="text-red-700">
                  You're overspending in: {budgetAnalysis.overspending_categories.join(', ')}
                </p>
              </div>
            )}

            {/* Category Overview */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Category Breakdown</h3>
              <div className="space-y-3">
                {categoryBudgets.map((budget) => (
                  <div key={budget.id} className="relative">
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium">{budget.category}</span>
                      <span className="text-sm text-gray-600">
                        ${budget.spent.toFixed(0)} / ${budget.amount.toFixed(0)}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${getProgressColor(budget.percentage)}`}
                        style={{ width: `${Math.min(budget.percentage, 100)}%` }}
                      />
                    </div>
                    {budget.percentage > 100 && (
                      <span className="text-xs text-red-600 mt-1">
                        Over by ${(budget.spent - budget.amount).toFixed(2)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* Categories Tab */}
        {activeTab === 'categories' && (
          <motion.div
            key="categories"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Category Budgets</h2>
              <button
                onClick={() => {
                  setModalType('budget');
                  setShowAddModal(true);
                }}
                className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 flex items-center gap-2"
              >
                <PlusIcon className="h-5 w-5" />
                Add Budget
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {categoryBudgets.map((budget) => (
                <motion.div
                  key={budget.id}
                  layout
                  className="bg-white rounded-lg shadow p-6"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-semibold text-lg">{budget.category}</h3>
                      <p className="text-sm text-gray-500">{budget.period}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold">
                        ${budget.remaining.toFixed(2)}
                      </p>
                      <p className="text-sm text-gray-500">remaining</p>
                    </div>
                  </div>

                  <div className="mb-2">
                    <div className="flex justify-between text-sm mb-1">
                      <span>Spent: ${budget.spent.toFixed(2)}</span>
                      <span>{budget.percentage.toFixed(0)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className={`h-3 rounded-full transition-all ${getProgressColor(budget.percentage)}`}
                        style={{ width: `${Math.min(budget.percentage, 100)}%` }}
                      />
                    </div>
                  </div>

                  {budget.percentage >= 80 && (
                    <div className={`mt-3 text-sm ${budget.percentage >= 100 ? 'text-red-600' : 'text-yellow-600'}`}>
                      <BellIcon className="h-4 w-4 inline mr-1" />
                      {budget.percentage >= 100 ? 'Budget exceeded!' : 'Approaching limit'}
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Bills Tab */}
        {activeTab === 'bills' && (
          <motion.div
            key="bills"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Upcoming Bills</h2>
              <button
                onClick={() => {
                  setModalType('bill');
                  setShowAddModal(true);
                }}
                className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 flex items-center gap-2"
              >
                <PlusIcon className="h-5 w-5" />
                Add Bill
              </button>
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Bill
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Due Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {bills.map((bill) => {
                    const daysUntilDue = Math.ceil(
                      (new Date(bill.next_due).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
                    );
                    const isOverdue = daysUntilDue < 0;
                    const isDueSoon = daysUntilDue <= 3 && daysUntilDue >= 0;

                    return (
                      <tr key={bill.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{bill.name}</div>
                            <div className="text-sm text-gray-500">{bill.category}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">${bill.amount.toFixed(2)}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className={`text-sm ${isOverdue ? 'text-red-600' : isDueSoon ? 'text-yellow-600' : 'text-gray-900'}`}>
                            {new Date(bill.next_due).toLocaleDateString()}
                          </div>
                          <div className="text-xs text-gray-500">
                            {isOverdue ? 'Overdue' : `In ${daysUntilDue} days`}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {bill.is_autopay ? (
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                              Autopay
                            </span>
                          ) : (
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                              Manual
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          {!bill.is_autopay && (
                            <button
                              onClick={() => markBillPaid(bill.id)}
                              className="text-indigo-600 hover:text-indigo-900"
                            >
                              Mark Paid
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {/* Savings Tab */}
        {activeTab === 'savings' && (
          <motion.div
            key="savings"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Savings Goals</h2>
              <button
                onClick={() => {
                  setModalType('savings');
                  setShowAddModal(true);
                }}
                className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 flex items-center gap-2"
              >
                <PlusIcon className="h-5 w-5" />
                Add Goal
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {savingsGoals.map((goal) => (
                <motion.div
                  key={goal.id}
                  layout
                  className="bg-white rounded-lg shadow p-6"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-semibold text-lg">{goal.name}</h3>
                      {goal.target_date && (
                        <p className="text-sm text-gray-500">
                          Target: {new Date(goal.target_date).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold">
                        ${goal.current_amount.toFixed(0)}
                      </p>
                      <p className="text-sm text-gray-500">
                        of ${goal.target_amount.toFixed(0)}
                      </p>
                    </div>
                  </div>

                  {/* Progress Ring */}
                  <div className="relative w-32 h-32 mx-auto mb-4">
                    <svg className="w-32 h-32 transform -rotate-90">
                      <circle
                        cx="64"
                        cy="64"
                        r="56"
                        stroke="currentColor"
                        strokeWidth="12"
                        fill="none"
                        className="text-gray-200"
                      />
                      <circle
                        cx="64"
                        cy="64"
                        r="56"
                        stroke="currentColor"
                        strokeWidth="12"
                        fill="none"
                        strokeDasharray={`${2 * Math.PI * 56}`}
                        strokeDashoffset={`${2 * Math.PI * 56 * (1 - goal.progress_percentage / 100)}`}
                        className="text-indigo-600 transition-all duration-500"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-2xl font-bold">
                        {Math.round(goal.progress_percentage)}%
                      </span>
                    </div>
                  </div>

                  {goal.monthly_contribution_needed > 0 && (
                    <p className="text-sm text-gray-600 text-center mb-4">
                      Need ${goal.monthly_contribution_needed.toFixed(0)}/month
                    </p>
                  )}

                  {goal.progress_percentage >= 100 ? (
                    <div className="text-center text-green-600 font-semibold">
                      <CheckCircleIcon className="h-5 w-5 inline mr-1" />
                      Goal Achieved! 🎉
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        const amount = prompt('Enter contribution amount:');
                        if (amount) contributeSavings(goal.id, parseFloat(amount));
                      }}
                      className="w-full bg-indigo-600 text-white py-2 rounded-md hover:bg-indigo-700 transition-colors"
                    >
                      Add Contribution
                    </button>
                  )}
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Templates Tab */}
        {activeTab === 'templates' && (
          <motion.div
            key="templates"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            <div className="mb-4">
              <h2 className="text-xl font-semibold">Budget Templates</h2>
              <p className="text-gray-600">Choose a template that fits your lifestyle</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Object.entries(templates).map(([id, template]) => (
                <motion.div
                  key={id}
                  whileHover={{ scale: 1.02 }}
                  className="bg-white rounded-lg shadow-lg p-6 cursor-pointer"
                  onClick={() => applyTemplate(id)}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-indigo-600">
                      {getTemplateIcon(id)}
                    </div>
                    <span className="text-2xl font-bold">
                      ${template.monthly_total}
                    </span>
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{template.name}</h3>
                  <p className="text-gray-600 text-sm mb-4">{template.description}</p>
                  
                  <div className="space-y-1">
                    <h4 className="text-sm font-medium text-gray-700">Categories:</h4>
                    {Object.entries(template.categories).slice(0, 4).map(([cat, amount]) => (
                      <div key={cat} className="flex justify-between text-sm">
                        <span className="text-gray-600">{cat}</span>
                        <span className="font-medium">${amount}</span>
                      </div>
                    ))}
                    {Object.keys(template.categories).length > 4 && (
                      <p className="text-xs text-gray-500 text-center pt-1">
                        +{Object.keys(template.categories).length - 4} more
                      </p>
                    )}
                  </div>

                  <button className="mt-4 w-full bg-indigo-100 text-indigo-700 py-2 rounded-md hover:bg-indigo-200 transition-colors">
                    Apply Template
                  </button>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Budget;