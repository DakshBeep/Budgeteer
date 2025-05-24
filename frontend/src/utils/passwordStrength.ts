export interface PasswordStrength {
  score: number // 0-4
  label: 'Very Weak' | 'Weak' | 'Fair' | 'Good' | 'Strong'
  color: string
  feedback: string[]
}

export const checkPasswordStrength = (password: string): PasswordStrength => {
  let score = 0
  const feedback: string[] = []

  // Length check
  if (password.length >= 8) {
    score += 1
  } else {
    feedback.push('Use at least 8 characters')
  }

  if (password.length >= 12) {
    score += 1
  }

  // Character variety checks
  const hasLowerCase = /[a-z]/.test(password)
  const hasUpperCase = /[A-Z]/.test(password)
  const hasNumbers = /\d/.test(password)
  const hasSpecialChars = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)

  if (hasLowerCase && hasUpperCase) {
    score += 1
  } else {
    if (!hasLowerCase) feedback.push('Add lowercase letters')
    if (!hasUpperCase) feedback.push('Add uppercase letters')
  }

  if (hasNumbers) {
    score += 0.5
  } else {
    feedback.push('Add numbers')
  }

  if (hasSpecialChars) {
    score += 0.5
  } else {
    feedback.push('Add special characters')
  }

  // Common patterns to avoid
  const commonPatterns = [
    /^123/, /^abc/i, /^password/i, /^qwerty/i, /^admin/i,
    /(.)\1{2,}/, // Repeated characters
  ]

  const hasCommonPattern = commonPatterns.some(pattern => pattern.test(password))
  if (hasCommonPattern) {
    score = Math.max(0, score - 1)
    feedback.push('Avoid common patterns')
  }

  // Determine strength label and color
  let label: PasswordStrength['label']
  let color: string

  if (score < 1) {
    label = 'Very Weak'
    color = 'bg-red-500'
  } else if (score < 2) {
    label = 'Weak'
    color = 'bg-orange-500'
  } else if (score < 3) {
    label = 'Fair'
    color = 'bg-yellow-500'
  } else if (score < 4) {
    label = 'Good'
    color = 'bg-blue-500'
  } else {
    label = 'Strong'
    color = 'bg-green-500'
  }

  return {
    score: Math.min(4, Math.floor(score)),
    label,
    color,
    feedback: feedback.slice(0, 3), // Limit to 3 suggestions
  }
}