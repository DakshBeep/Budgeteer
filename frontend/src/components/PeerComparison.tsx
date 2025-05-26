import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { UsersIcon, ChartBarIcon, ArrowTrendingDownIcon } from '@heroicons/react/24/outline';
import { buildApiUrl } from '../utils/api'

interface PeerComparisonData {
  overall_percentile: number;
  overall_status: string;
  comparisons: Array<{
    category: string;
    user_amount: number;
    peer_median: number;
    peer_mean: number;
    percentile: number;
    status: string;
    message: string;
    peer_range: {
      low: number;
      high: number;
    };
  }>;
}

interface SavingsOpportunity {
  category: string;
  current_spending: number;
  peer_median: number;
  potential_monthly_savings: number;
  potential_annual_savings: number;
  recommendation: string;
}

export default function PeerComparison() {
  const [comparison, setComparison] = useState<PeerComparisonData | null>(null);
  const [opportunities, setOpportunities] = useState<SavingsOpportunity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPeerComparison();
    fetchSavingsOpportunities();
  }, []);

  const fetchPeerComparison = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(buildApiUrl('/insights/peer-comparison'), {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setComparison(data);
      }
    } catch (error) {
      console.error('Failed to fetch peer comparison:', error);
    }
  };

  const fetchSavingsOpportunities = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(buildApiUrl('/insights/savings-opportunities'), {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setOpportunities(data.opportunities);
      }
    } catch (error) {
      console.error('Failed to fetch savings opportunities:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'excellent': return 'text-green-600 bg-green-50';
      case 'good': return 'text-blue-600 bg-blue-50';
      case 'average': return 'text-yellow-600 bg-yellow-50';
      case 'high': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getPercentileBar = (percentile: number) => {
    const position = Math.min(Math.max(percentile, 0), 100);
    return (
      <div className="relative h-8 bg-gradient-to-r from-green-200 via-yellow-200 to-red-200 rounded-full">
        <div 
          className="absolute top-1/2 transform -translate-y-1/2 w-4 h-4 bg-gray-800 rounded-full"
          style={{ left: `${position}%`, transform: 'translate(-50%, -50%)' }}
        />
        <div className="absolute -bottom-6 text-xs text-gray-600 flex justify-between w-full">
          <span>Low</span>
          <span>Average</span>
          <span>High</span>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overall Status */}
      {comparison && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-lg shadow p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <UsersIcon className="h-6 w-6 text-indigo-600" />
            <h3 className="text-lg font-semibold">How You Compare to Peers</h3>
          </div>
          
          <div className="mb-6">
            <p className="text-sm text-gray-600 mb-2">Overall Spending Percentile</p>
            {getPercentileBar(comparison.overall_percentile)}
          </div>

          <div className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(comparison.overall_status)}`}>
            {comparison.overall_status === 'excellent' && 'Excellent Spender'}
            {comparison.overall_status === 'good' && 'Good Spender'}
            {comparison.overall_status === 'average' && 'Average Spender'}
            {comparison.overall_status === 'high' && 'High Spender'}
          </div>
        </motion.div>
      )}

      {/* Category Comparisons */}
      {comparison && comparison.comparisons.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-lg shadow p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <ChartBarIcon className="h-6 w-6 text-indigo-600" />
            <h3 className="text-lg font-semibold">Category Breakdown</h3>
          </div>

          <div className="space-y-4">
            {comparison.comparisons.map((comp, index) => (
              <motion.div
                key={comp.category}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="border rounded-lg p-4"
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-medium capitalize">{comp.category}</h4>
                    <p className="text-sm text-gray-600">{comp.message}</p>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(comp.status)}`}>
                    {comp.percentile}th percentile
                  </span>
                </div>
                
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Your Spending</p>
                    <p className="font-semibold">${comp.user_amount.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Peer Average</p>
                    <p className="font-semibold">${comp.peer_median.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Typical Range</p>
                    <p className="font-semibold">
                      ${comp.peer_range.low.toFixed(0)} - ${comp.peer_range.high.toFixed(0)}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Savings Opportunities */}
      {opportunities.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg shadow p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <ArrowTrendingDownIcon className="h-6 w-6 text-green-600" />
            <h3 className="text-lg font-semibold">Savings Opportunities</h3>
          </div>

          <div className="space-y-3">
            {opportunities.map((opp, index) => (
              <motion.div
                key={opp.category}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                className="bg-white rounded-lg p-4"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h4 className="font-medium capitalize">{opp.category}</h4>
                    <p className="text-sm text-gray-600 mt-1">{opp.recommendation}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-green-600">
                      ${opp.potential_monthly_savings.toFixed(0)}/mo
                    </p>
                    <p className="text-xs text-gray-500">
                      ${opp.potential_annual_savings.toFixed(0)}/year
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-green-200">
            <div className="flex justify-between items-center">
              <p className="text-sm font-medium text-gray-700">Total Potential Savings</p>
              <p className="text-xl font-bold text-green-600">
                ${opportunities.reduce((sum, o) => sum + o.potential_monthly_savings, 0).toFixed(0)}/mo
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Privacy Note */}
      <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
        <p className="font-medium mb-1">🔒 Your Privacy is Protected</p>
        <p>All peer comparisons use anonymized, aggregated data. Your individual spending details are never shared with other users.</p>
      </div>
    </div>
  );
}