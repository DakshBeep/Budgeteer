export const formatCurrency = (value: string | number): string => {
  // Remove all non-numeric characters except decimal point
  const numericValue = value.toString().replace(/[^0-9.]/g, '')
  
  // Split by decimal point
  const parts = numericValue.split('.')
  
  // Format the integer part with commas
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  
  // Limit decimal places to 2
  if (parts[1]) {
    parts[1] = parts[1].slice(0, 2)
  }
  
  return parts.join('.')
}

export const parseCurrency = (value: string): number => {
  // Remove all non-numeric characters except decimal point
  const cleanValue = value.replace(/[^0-9.]/g, '')
  return parseFloat(cleanValue) || 0
}

export const formatCurrencyInput = (value: string): string => {
  // Allow only numbers and one decimal point
  let cleaned = value.replace(/[^0-9.]/g, '')
  
  // Ensure only one decimal point
  const parts = cleaned.split('.')
  if (parts.length > 2) {
    cleaned = parts[0] + '.' + parts.slice(1).join('')
  }
  
  // Limit decimal places to 2
  if (parts.length === 2 && parts[1].length > 2) {
    cleaned = parts[0] + '.' + parts[1].slice(0, 2)
  }
  
  return cleaned
}