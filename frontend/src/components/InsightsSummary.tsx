import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  LightBulbIcon, 
  ExclamationTriangleIcon,
  SparklesIcon,
  CheckCircleIcon 
} from '@heroicons/react/24/outline';
import { useAuth } from '../hooks/useAuth';

interface Insight {
  id: number;
  type: string;
  priority: string;
  title: string;
  description: string;
  is_read: boolean;
}

interface HealthScore {
  score: number;
  trend: string;
}

const InsightsSummary = () => {
  const { token } = useAuth();
  const [insights, setInsights] = useState<Insight[]>([]);
  const [healthScore, setHealthScore] = useState<HealthScore | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInsightsSummary();
  }, []);

  const fetchInsightsSummary = async () => {
    try {
      // Fetch top 3 unread insights
      const insightsResponse = await fetch(
        'http://localhost:8000/insights?is_read=false&limit=3',
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      if (insightsResponse.ok) {
        const insightsData = await insightsResponse.json();
        setInsights(insightsData);
      }

      // Fetch health score
      const scoreResponse = await fetch(
        'http://localhost:8000/insights/health-score',
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      if (scoreResponse.ok) {
        const scoreData = await scoreResponse.json();
        setHealthScore(scoreData);
      }
    } catch (error) {
      console.error('Error fetching insights summary:', error);
    } finally {
      setLoading(false);
    }
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'anomaly':
        return <ExclamationTriangleIcon className="h-5 w-5 text-orange-500" />;
      case 'savings_opportunity':
        return <SparklesIcon className="h-5 w-5 text-blue-500" />;
      case 'achievement':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      default:
        return <LightBulbIcon className="h-5 w-5 text-indigo-500" />;
    }
  };

  const getHealthScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    if (score >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-6 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="space-y-3">
          <div className="h-4 bg-gray-200 rounded"></div>
          <div className="h-4 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Financial Insights</h3>
        <Link
          to="/insights"
          className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
        >
          View all
        </Link>
      </div>

      {/* Health Score */}
      {healthScore && (
        <div className="mb-6 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Financial Health Score</p>
              <div className="flex items-baseline gap-2">
                <span className={`text-3xl font-bold ${getHealthScoreColor(healthScore.score)}`}>
                  {Math.round(healthScore.score)}
                </span>
                <span className="text-gray-600">/100</span>
              </div>
            </div>
            <div className={`text-sm font-medium ${
              healthScore.trend === 'improving' ? 'text-green-600' :
              healthScore.trend === 'declining' ? 'text-red-600' : 'text-gray-600'
            }`}>
              {healthScore.trend === 'improving' ? '↑ Improving' : 
               healthScore.trend === 'declining' ? '↓ Declining' : '→ Stable'}
            </div>
          </div>
          
          {/* Mini progress bar */}
          <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${
                healthScore.score >= 80 ? 'bg-green-500' :
                healthScore.score >= 60 ? 'bg-yellow-500' :
                healthScore.score >= 40 ? 'bg-orange-500' : 'bg-red-500'
              }`}
              style={{ width: `${healthScore.score}%` }}
            />
          </div>
        </div>
      )}

      {/* Recent Insights */}
      <div className="space-y-3">
        {insights.length > 0 ? (
          insights.map((insight) => (
            <Link
              key={insight.id}
              to="/insights"
              className="block p-3 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <div className="flex items-start gap-3">
                {getInsightIcon(insight.type)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {insight.title}
                  </p>
                  <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">
                    {insight.description}
                  </p>
                </div>
                {!insight.is_read && (
                  <span className="w-2 h-2 bg-indigo-600 rounded-full flex-shrink-0 mt-1.5"></span>
                )}
              </div>
            </Link>
          ))
        ) : (
          <div className="text-center py-4 text-gray-500 text-sm">
            <LightBulbIcon className="h-8 w-8 mx-auto mb-2 text-gray-300" />
            <p>No new insights available</p>
            <p className="text-xs mt-1">Check back later for updates</p>
          </div>
        )}
      </div>

      {/* Insights count badge */}
      {insights.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-xs text-gray-500 text-center">
            You have {insights.length} unread insight{insights.length !== 1 ? 's' : ''}
          </p>
        </div>
      )}
    </div>
  );
};

export default InsightsSummary;