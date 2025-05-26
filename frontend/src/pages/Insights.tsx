import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LightBulbIcon, 
  ArrowTrendingUpIcon as TrendingUpIcon, 
  ExclamationTriangleIcon,
  SparklesIcon,
  ChartBarIcon,
  ArrowRightIcon,
  XMarkIcon,
  CheckCircleIcon,
  InformationCircleIcon,
  UsersIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../hooks/useAuth';
import PeerComparison from '../components/PeerComparison';

interface Insight {
  id: number;
  type: 'anomaly' | 'savings_opportunity' | 'achievement' | 'prediction' | 'recommendation' | 'comparison';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  title: string;
  description: string;
  data: Record<string, unknown>;
  action_url?: string;
  is_read: boolean;
  is_dismissed: boolean;
  created_at: string;
  expires_at?: string;
}

interface HealthScore {
  score: number;
  components: {
    budget_adherence: number;
    spending_consistency: number;
    savings_rate: number;
    category_balance: number;
  };
  trend: 'improving' | 'stable' | 'declining';
  calculated_at: string;
  recommendations: string[];
}

interface WhatIfScenario {
  current_monthly_spending: number;
  projected_monthly_spending: number;
  monthly_savings: number;
  annual_savings: number;
  impact_on_budget: string;
}

const Insights = () => {
  const { token } = useAuth();
  const [insights, setInsights] = useState<Insight[]>([]);
  const [healthScore, setHealthScore] = useState<HealthScore | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [selectedInsight, setSelectedInsight] = useState<Insight | null>(null);
  const [whatIfCategory, setWhatIfCategory] = useState('');
  const [whatIfReduction, setWhatIfReduction] = useState(20);
  const [whatIfResult, setWhatIfResult] = useState<WhatIfScenario | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [activeSection, setActiveSection] = useState<'insights' | 'whatif' | 'peer'>('insights');

  const fetchInsights = useCallback(async () => {
    try {
      setError(null);
      const params = new URLSearchParams();
      if (selectedType !== 'all') params.append('type', selectedType);
      if (showUnreadOnly) params.append('is_read', 'false');

      const response = await fetch(`${import.meta.env.VITE_API_BASE || 'http://localhost:8000'}/insights?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setInsights(data);
        
        // Check for achievements to show confetti
        const hasNewAchievement = data.some((i: Insight) => 
          i.type === 'achievement' && !i.is_read
        );
        if (hasNewAchievement) {
          setShowConfetti(true);
          setTimeout(() => setShowConfetti(false), 5000);
        }
      } else {
        throw new Error(`Failed to fetch insights: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error fetching insights:', error);
      setError('Failed to load insights. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [token, selectedType, showUnreadOnly]);

  const fetchHealthScore = useCallback(async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE || 'http://localhost:8000'}/insights/health-score`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setHealthScore(data);
      }
    } catch (error) {
      console.error('Error fetching health score:', error);
    }
  }, [token]);

  const generateInsights = useCallback(async () => {
    try {
      await fetch(`${import.meta.env.VITE_API_BASE || 'http://localhost:8000'}/insights/generate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
    } catch (error) {
      console.error('Error generating insights:', error);
    }
  }, [token]);

  const markAsRead = async (insightId: number) => {
    try {
      await fetch(`${import.meta.env.VITE_API_BASE || 'http://localhost:8000'}/insights/${insightId}/read`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      setInsights(insights.map(i => 
        i.id === insightId ? { ...i, is_read: true } : i
      ));
    } catch (error) {
      console.error('Error marking insight as read:', error);
    }
  };

  const dismissInsight = async (insightId: number) => {
    try {
      await fetch(`${import.meta.env.VITE_API_BASE || 'http://localhost:8000'}/insights/${insightId}/dismiss`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      setInsights(insights.filter(i => i.id !== insightId));
    } catch (error) {
      console.error('Error dismissing insight:', error);
    }
  };

  const calculateWhatIf = async () => {
    if (!whatIfCategory) return;

    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE || 'http://localhost:8000'}/insights/what-if`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          category: whatIfCategory,
          reduction_percentage: whatIfReduction
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setWhatIfResult(data);
      }
    } catch (error) {
      console.error('Error calculating what-if:', error);
    }
  };

  const getInsightIcon = (type: string, priority: string) => {
    const baseClasses = "h-6 w-6";
    const colorClasses = priority === 'urgent' ? 'text-red-500' : 
                        priority === 'high' ? 'text-orange-500' :
                        priority === 'medium' ? 'text-yellow-500' : 'text-blue-500';

    switch (type) {
      case 'anomaly':
        return <ExclamationTriangleIcon className={`${baseClasses} ${colorClasses}`} />;
      case 'savings_opportunity':
        return <SparklesIcon className={`${baseClasses} ${colorClasses}`} />;
      case 'achievement':
        return <CheckCircleIcon className={`${baseClasses} text-green-500`} />;
      case 'prediction':
        return <TrendingUpIcon className={`${baseClasses} ${colorClasses}`} />;
      case 'recommendation':
        return <LightBulbIcon className={`${baseClasses} ${colorClasses}`} />;
      case 'comparison':
        return <ChartBarIcon className={`${baseClasses} ${colorClasses}`} />;
      default:
        return <InformationCircleIcon className={`${baseClasses} ${colorClasses}`} />;
    }
  };

  const getHealthScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    if (score >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  const categories = [
    "Food & Dining",
    "Transportation", 
    "Shopping",
    "Entertainment",
    "Bills & Utilities",
    "Healthcare",
    "Education",
    "Personal Care",
    "Groceries",
    "Subscriptions",
    "Travel",
    "Other"
  ];

  // Initial load
  useEffect(() => {
    if (token) {
      fetchInsights();
      fetchHealthScore();
      // Trigger insight generation
      generateInsights();
    }
  }, [token, fetchInsights, fetchHealthScore, generateInsights]);

  // Reload when filters change
  useEffect(() => {
    if (token && !loading) {
      fetchInsights();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedType, showUnreadOnly]);

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
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <div className="flex items-center gap-3 mb-3">
            <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
            <h3 className="text-lg font-semibold text-red-900">Error Loading Page</h3>
          </div>
          <p className="text-red-700 mb-4">{error}</p>
          <button
            onClick={() => {
              setError(null);
              setLoading(true);
              fetchInsights();
              fetchHealthScore();
            }}
            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Confetti Animation */}
      <AnimatePresence>
        {showConfetti && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 pointer-events-none z-50"
          >
            <div className="confetti">
              {[...Array(50)].map((_, i) => (
                <motion.div
                  key={i}
                  className="confetti-piece"
                  initial={{ 
                    y: -20,
                    x: Math.random() * window.innerWidth,
                    rotate: 0
                  }}
                  animate={{ 
                    y: window.innerHeight + 20,
                    x: Math.random() * window.innerWidth,
                    rotate: Math.random() * 720
                  }}
                  transition={{
                    duration: Math.random() * 3 + 2,
                    ease: "linear",
                    delay: Math.random() * 0.5
                  }}
                  style={{
                    position: 'absolute',
                    width: '10px',
                    height: '10px',
                    backgroundColor: ['#f43f5e', '#10b981', '#3b82f6', '#f59e0b'][Math.floor(Math.random() * 4)]
                  }}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Financial Insights</h1>
        <p className="mt-2 text-gray-600">
          Your personalized financial intelligence dashboard
        </p>
      </div>

      {/* Section Tabs */}
      <div className="bg-white rounded-lg shadow p-2 mb-6">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveSection('insights')}
            className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeSection === 'insights'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <LightBulbIcon className="h-4 w-4 inline mr-2" />
            Insights & Alerts
          </button>
          <button
            onClick={() => setActiveSection('whatif')}
            className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeSection === 'whatif'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <SparklesIcon className="h-4 w-4 inline mr-2" />
            What-If Calculator
          </button>
          <button
            onClick={() => setActiveSection('peer')}
            className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeSection === 'peer'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <UsersIcon className="h-4 w-4 inline mr-2" />
            Peer Comparison
          </button>
        </div>
      </div>

      {/* Insights Section */}
      {activeSection === 'insights' && (
        <>
          {/* Financial Health Score */}
          {healthScore && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl shadow-lg p-6 mb-8"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Financial Health Score</h2>
            <div className={`text-sm ${
              healthScore.trend === 'improving' ? 'text-green-600' :
              healthScore.trend === 'declining' ? 'text-red-600' : 'text-gray-600'
            }`}>
              {healthScore.trend === 'improving' ? '↑' : 
               healthScore.trend === 'declining' ? '↓' : '→'} {healthScore.trend}
            </div>
          </div>

          <div className="relative pt-1">
            <div className="flex mb-2 items-center justify-between">
              <div>
                <span className={`text-5xl font-bold ${getHealthScoreColor(healthScore.score)}`}>
                  {Math.round(healthScore.score)}
                </span>
                <span className="text-gray-600 text-lg">/100</span>
              </div>
              <div className="text-right">
                <span className="text-xs font-semibold inline-block text-gray-600">
                  Last updated: {new Date(healthScore.calculated_at).toLocaleDateString()}
                </span>
              </div>
            </div>

            {/* Score Bar */}
            <div className="overflow-hidden h-6 mb-4 text-xs flex rounded-full bg-gray-200">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${healthScore.score}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
                className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center ${
                  healthScore.score >= 80 ? 'bg-green-500' :
                  healthScore.score >= 60 ? 'bg-yellow-500' :
                  healthScore.score >= 40 ? 'bg-orange-500' : 'bg-red-500'
                }`}
              />
            </div>

            {/* Component Breakdown */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
              {Object.entries(healthScore.components).map(([key, value]) => (
                <div key={key} className="text-center">
                  <div className="text-sm text-gray-600 mb-1">
                    {key.split('_').map(word => 
                      word.charAt(0).toUpperCase() + word.slice(1)
                    ).join(' ')}
                  </div>
                  <div className={`text-2xl font-semibold ${getHealthScoreColor(value)}`}>
                    {Math.round(value)}
                  </div>
                </div>
              ))}
            </div>

            {/* Recommendations */}
            {healthScore.recommendations.length > 0 && (
              <div className="mt-6 border-t pt-4">
                <h3 className="font-medium text-gray-700 mb-2">Recommendations</h3>
                <ul className="space-y-1">
                  {healthScore.recommendations.map((rec, idx) => (
                    <li key={idx} className="flex items-start">
                      <span className="text-indigo-500 mr-2">•</span>
                      <span className="text-sm text-gray-600">{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedType('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedType === 'all'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All Insights
            </button>
            <button
              onClick={() => setSelectedType('anomaly')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedType === 'anomaly'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Anomalies
            </button>
            <button
              onClick={() => setSelectedType('savings_opportunity')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedType === 'savings_opportunity'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Savings
            </button>
            <button
              onClick={() => setSelectedType('achievement')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedType === 'achievement'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Achievements
            </button>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={showUnreadOnly}
                onChange={(e) => setShowUnreadOnly(e.target.checked)}
                className="mr-2 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm text-gray-700">Unread only</span>
            </label>
            <button
              onClick={generateInsights}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <ArrowRightIcon className="h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Insights Grid */}
      <div className="grid gap-4 mb-8">
        <AnimatePresence>
          {insights.map((insight, index) => (
            <motion.div
              key={insight.id}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ delay: index * 0.05 }}
              whileHover={{ scale: 1.02 }}
              className={`bg-white rounded-lg shadow-lg p-6 cursor-pointer ${
                !insight.is_read ? 'border-l-4 border-indigo-500' : ''
              }`}
              onClick={() => {
                setSelectedInsight(insight);
                if (!insight.is_read) markAsRead(insight.id);
              }}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  {getInsightIcon(insight.type, insight.priority)}
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-1">
                      {insight.title}
                    </h3>
                    <p className="text-gray-600 text-sm">
                      {insight.description}
                    </p>
                    {insight.action_url && (
                      <a
                        href={insight.action_url}
                        className="mt-2 inline-flex items-center text-sm text-indigo-600 hover:text-indigo-800"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Take action
                        <ArrowRightIcon className="ml-1 h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    dismissInsight(insight.id);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {insights.length === 0 && (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <p className="text-gray-500">No insights available. Check back later!</p>
          </div>
        )}
      </div>
        </>
      )}

      {/* What-If Calculator */}
      {activeSection === 'whatif' && (
        <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl shadow-lg p-6"
      >
        <h2 className="text-xl font-semibold mb-4">What-If Budget Calculator</h2>
        <p className="text-gray-600 mb-6">
          See how reducing spending in specific categories could impact your budget
        </p>

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Category
            </label>
            <select
              value={whatIfCategory}
              onChange={(e) => setWhatIfCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">Select a category</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>

            <label className="block text-sm font-medium text-gray-700 mt-4 mb-2">
              Reduction: {whatIfReduction}%
            </label>
            <input
              type="range"
              min="5"
              max="50"
              step="5"
              value={whatIfReduction}
              onChange={(e) => setWhatIfReduction(Number(e.target.value))}
              className="w-full"
            />

            <button
              onClick={calculateWhatIf}
              disabled={!whatIfCategory}
              className="mt-6 w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Calculate Savings
            </button>
          </div>

          <AnimatePresence mode="wait">
            {whatIfResult && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg p-6"
              >
                <h3 className="font-semibold text-lg mb-4">Potential Savings</h3>
                <div className="space-y-3">
                  <div>
                    <span className="text-sm text-gray-600">Current Monthly Spending:</span>
                    <p className="text-xl font-semibold">${whatIfResult.current_monthly_spending.toFixed(2)}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">After {whatIfReduction}% Reduction:</span>
                    <p className="text-xl font-semibold">${whatIfResult.projected_monthly_spending.toFixed(2)}</p>
                  </div>
                  <div className="border-t pt-3">
                    <span className="text-sm text-gray-600">Monthly Savings:</span>
                    <p className="text-2xl font-bold text-green-600">
                      ${whatIfResult.monthly_savings.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">Annual Savings:</span>
                    <p className="text-3xl font-bold text-green-600">
                      ${whatIfResult.annual_savings.toFixed(2)}
                    </p>
                  </div>
                  <div className="mt-4 p-3 bg-white rounded-md">
                    <span className="text-sm font-medium">Budget Impact:</span>
                    <p className={`font-semibold ${
                      whatIfResult.impact_on_budget.includes('within') ? 'text-green-600' : 'text-orange-600'
                    }`}>
                      {whatIfResult.impact_on_budget}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
      )}

      {/* Peer Comparison */}
      {activeSection === 'peer' && <PeerComparison />}

      {/* Insight Detail Modal */}
      <AnimatePresence>
        {selectedInsight && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            onClick={() => setSelectedInsight(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-lg max-w-2xl w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-4">
                  {getInsightIcon(selectedInsight.type, selectedInsight.priority)}
                  <div>
                    <h2 className="text-xl font-semibold">{selectedInsight.title}</h2>
                    <p className="text-sm text-gray-500 mt-1">
                      {new Date(selectedInsight.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedInsight(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>

              <div className="mb-6">
                <p className="text-gray-700">{selectedInsight.description}</p>
              </div>

              {selectedInsight.data && (
                <div className="bg-gray-50 rounded-lg p-4 mb-6">
                  <h3 className="font-medium mb-2">Additional Details</h3>
                  <pre className="text-sm text-gray-600 whitespace-pre-wrap">
                    {JSON.stringify(selectedInsight.data, null, 2)}
                  </pre>
                </div>
              )}

              <div className="flex justify-end gap-3">
                {selectedInsight.action_url && (
                  <a
                    href={selectedInsight.action_url}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
                  >
                    Take Action
                  </a>
                )}
                <button
                  onClick={() => {
                    dismissInsight(selectedInsight.id);
                    setSelectedInsight(null);
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @keyframes confetti-fall {
          to {
            transform: translateY(100vh) rotate(720deg);
          }
        }
      `}</style>
    </div>
  );
};

export default Insights;