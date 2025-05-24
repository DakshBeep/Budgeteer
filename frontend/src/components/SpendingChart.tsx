import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface SpendingChartProps {
  data: Array<{
    date: string
    amount: number
  }>
}

const SpendingChart = ({ data }: SpendingChartProps) => {
  // Calculate trend
  const trend = data.length >= 2 
    ? data[data.length - 1].amount - data[0].amount
    : 0

  const formatCurrency = (value: number) => `$${value.toFixed(0)}`

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Spending Trend</h3>
        <div className={`flex items-center text-sm ${trend > 0 ? 'text-red-600' : 'text-green-600'}`}>
          {trend > 0 ? (
            <>
              <TrendingUp className="h-4 w-4 mr-1" />
              +${Math.abs(trend).toFixed(0)}
            </>
          ) : (
            <>
              <TrendingDown className="h-4 w-4 mr-1" />
              -${Math.abs(trend).toFixed(0)}
            </>
          )}
        </div>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis 
              dataKey="date" 
              stroke="#9ca3af"
              fontSize={12}
              tickLine={false}
            />
            <YAxis 
              stroke="#9ca3af"
              fontSize={12}
              tickLine={false}
              tickFormatter={formatCurrency}
            />
            <Tooltip
              formatter={(value: number) => formatCurrency(value)}
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
              }}
            />
            <Line
              type="monotone"
              dataKey="amount"
              stroke="#6366f1"
              strokeWidth={2}
              dot={{ fill: '#6366f1', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default SpendingChart