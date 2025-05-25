import { format, startOfWeek, startOfMonth, endOfMonth, subDays, subMonths, parseISO } from 'date-fns'

export interface DateRange {
  start: Date
  end: Date
  label: string
}

export interface ChartDataPoint {
  date: string
  value: number
  label?: string
}

export interface CategoryData {
  category: string
  amount: number
  percentage: number
  type: 'income' | 'expense'
}

// Date range presets
export const getDateRangePresets = (): Record<string, DateRange> => {
  const today = new Date()
  
  return {
    last7Days: {
      start: subDays(today, 6),
      end: today,
      label: 'Last 7 days'
    },
    last30Days: {
      start: subDays(today, 29),
      end: today,
      label: 'Last 30 days'
    },
    last3Months: {
      start: subMonths(today, 3),
      end: today,
      label: 'Last 3 months'
    },
    last6Months: {
      start: subMonths(today, 6),
      end: today,
      label: 'Last 6 months'
    },
    lastYear: {
      start: subMonths(today, 12),
      end: today,
      label: 'Last year'
    },
    thisMonth: {
      start: startOfMonth(today),
      end: endOfMonth(today),
      label: 'This month'
    }
  }
}

// Format date for API
export const formatDateForAPI = (date: Date): string => {
  return format(date, 'yyyy-MM-dd')
}

// Calculate percentage change
export const calculatePercentageChange = (current: number, previous: number): number => {
  if (previous === 0) return current > 0 ? 100 : 0
  return ((current - previous) / previous) * 100
}

// Format currency with proper negative handling
export const formatCurrency = (amount: number): string => {
  const absAmount = Math.abs(amount)
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(absAmount)
  
  return amount < 0 ? `-${formatted}` : formatted
}

// Format percentage
export const formatPercentage = (value: number): string => {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
}

// Chart color scheme
export const CHART_COLORS = {
  primary: '#6366f1', // indigo-500
  secondary: '#8b5cf6', // purple-500
  success: '#10b981', // green-500
  danger: '#ef4444', // red-500
  warning: '#f59e0b', // yellow-500
  info: '#3b82f6', // blue-500
  categories: [
    '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
    '#f97316', '#f59e0b', '#84cc16', '#22c55e',
    '#10b981', '#14b8a6', '#06b6d4', '#3b82f6'
  ]
}

// Get color for amount (positive = green, negative = red)
export const getAmountColor = (amount: number): string => {
  return amount >= 0 ? CHART_COLORS.success : CHART_COLORS.danger
}

// Aggregate data by time period
export const aggregateByPeriod = (
  data: any[],
  dateField: string,
  valueField: string,
  period: 'daily' | 'weekly' | 'monthly'
): ChartDataPoint[] => {
  const aggregated: Record<string, number> = {}
  
  data.forEach(item => {
    const date = parseISO(item[dateField])
    let key: string
    
    switch (period) {
      case 'weekly':
        key = format(startOfWeek(date), 'yyyy-MM-dd')
        break
      case 'monthly':
        key = format(date, 'yyyy-MM')
        break
      default: // daily
        key = format(date, 'yyyy-MM-dd')
    }
    
    aggregated[key] = (aggregated[key] || 0) + item[valueField]
  })
  
  return Object.entries(aggregated)
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

// Calculate moving average
export const calculateMovingAverage = (
  data: ChartDataPoint[],
  window: number
): ChartDataPoint[] => {
  return data.map((point, index) => {
    const start = Math.max(0, index - window + 1)
    const subset = data.slice(start, index + 1)
    const average = subset.reduce((sum, p) => sum + p.value, 0) / subset.length
    
    return {
      ...point,
      value: average
    }
  })
}

// Format large numbers (e.g., 1.5K, 2.3M)
export const formatLargeNumber = (num: number): string => {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`
  } else if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`
  }
  return num.toFixed(0)
}

// Generate chart gradient
export const generateChartGradient = (
  ctx: CanvasRenderingContext2D,
  color: string,
  opacity: number = 0.3
): CanvasGradient => {
  const gradient = ctx.createLinearGradient(0, 0, 0, 400)
  gradient.addColorStop(0, `${color}${Math.floor(opacity * 255).toString(16)}`)
  gradient.addColorStop(1, `${color}00`)
  return gradient
}

// Calculate statistics
export const calculateStats = (values: number[]) => {
  if (values.length === 0) return { mean: 0, median: 0, min: 0, max: 0 }
  
  const sorted = [...values].sort((a, b) => a - b)
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length
  const median = sorted[Math.floor(sorted.length / 2)]
  
  return {
    mean,
    median,
    min: sorted[0],
    max: sorted[sorted.length - 1]
  }
}

// Export data as CSV
export const exportToCSV = (data: any[], filename: string) => {
  if (data.length === 0) return
  
  const headers = Object.keys(data[0])
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        const value = row[header]
        return typeof value === 'string' && value.includes(',') 
          ? `"${value}"` 
          : value
      }).join(',')
    )
  ].join('\n')
  
  const blob = new Blob([csvContent], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${filename}_${format(new Date(), 'yyyy-MM-dd')}.csv`
  link.click()
  URL.revokeObjectURL(url)
}