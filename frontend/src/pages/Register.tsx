import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { UserPlus, User, Lock, Mail, Loader2, CheckCircle, XCircle } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { checkPasswordStrength } from '../utils/passwordStrength'

const Register = () => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [emailError, setEmailError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [confirmPasswordError, setConfirmPasswordError] = useState('')
  
  const navigate = useNavigate()
  const { register, isAuthenticated } = useAuth()

  const passwordStrength = checkPasswordStrength(password)

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true })
    }
  }, [isAuthenticated, navigate])

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!email) {
      setEmailError('Email is required')
      return false
    }
    if (!emailRegex.test(email)) {
      setEmailError('Please enter a valid email address')
      return false
    }
    setEmailError('')
    return true
  }

  const validatePassword = () => {
    if (password.length < 8) {
      setPasswordError('Password must be at least 8 characters')
      return false
    }
    setPasswordError('')
    return true
  }

  const validateConfirmPassword = () => {
    if (password !== confirmPassword) {
      setConfirmPasswordError('Passwords do not match')
      return false
    }
    setConfirmPasswordError('')
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validate all fields
    const isEmailValid = validateEmail(username)
    const isPasswordValid = validatePassword()
    const isConfirmPasswordValid = validateConfirmPassword()

    if (!isEmailValid || !isPasswordValid || !isConfirmPasswordValid) {
      return
    }

    if (passwordStrength.score < 2) {
      setPasswordError('Please choose a stronger password')
      return
    }

    setIsLoading(true)
    try {
      await register(username, password)
      navigate('/dashboard', { replace: true })
    } catch (err: any) {
      setError(err.message || 'Registration failed')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-100 px-4 sm:px-6 lg:px-8">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex justify-center mb-8">
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-4 rounded-2xl shadow-lg">
            <UserPlus className="h-8 w-8 text-white" />
          </div>
        </div>
        
        <h2 className="text-3xl font-bold text-center mb-2 text-gray-800">
          Create your account
        </h2>
        <p className="text-center text-gray-600 mb-8">
          Join us and start managing your budget
        </p>

        {error && (
          <div className="p-4 rounded-lg mb-6 bg-red-50 border border-red-200">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="email"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value)
                  if (emailError) validateEmail(e.target.value)
                }}
                onBlur={() => validateEmail(username)}
                className={`pl-10 w-full px-3 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                  emailError 
                    ? 'border-red-300 focus:ring-red-500' 
                    : 'border-gray-300 focus:ring-indigo-500'
                }`}
                placeholder="you@example.com"
                required
                disabled={isLoading}
              />
            </div>
            {emailError && (
              <p className="mt-1 text-sm text-red-600">{emailError}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  if (passwordError) validatePassword()
                  if (confirmPassword) validateConfirmPassword()
                }}
                onBlur={validatePassword}
                className={`pl-10 w-full px-3 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                  passwordError 
                    ? 'border-red-300 focus:ring-red-500' 
                    : 'border-gray-300 focus:ring-indigo-500'
                }`}
                placeholder="••••••••"
                required
                disabled={isLoading}
              />
            </div>
            {passwordError && (
              <p className="mt-1 text-sm text-red-600">{passwordError}</p>
            )}
            
            {password && (
              <div className="mt-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-gray-600">Password strength:</span>
                  <span className={`text-sm font-medium ${
                    passwordStrength.score < 2 ? 'text-red-600' : 
                    passwordStrength.score < 3 ? 'text-yellow-600' : 
                    passwordStrength.score < 4 ? 'text-blue-600' : 'text-green-600'
                  }`}>
                    {passwordStrength.label}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${passwordStrength.color}`}
                    style={{ width: `${(passwordStrength.score / 4) * 100}%` }}
                  />
                </div>
                {passwordStrength.feedback.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {passwordStrength.feedback.map((tip, index) => (
                      <li key={index} className="text-xs text-gray-600 flex items-center">
                        <XCircle className="h-3 w-3 mr-1 text-red-400" />
                        {tip}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Confirm Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value)
                  if (confirmPasswordError && password) validateConfirmPassword()
                }}
                onBlur={validateConfirmPassword}
                className={`pl-10 w-full px-3 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                  confirmPasswordError 
                    ? 'border-red-300 focus:ring-red-500' 
                    : confirmPassword && password === confirmPassword
                    ? 'border-green-300 focus:ring-green-500'
                    : 'border-gray-300 focus:ring-indigo-500'
                }`}
                placeholder="••••••••"
                required
                disabled={isLoading}
              />
              {confirmPassword && password === confirmPassword && (
                <CheckCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-green-500" />
              )}
            </div>
            {confirmPasswordError && (
              <p className="mt-1 text-sm text-red-600">{confirmPasswordError}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading || passwordStrength.score < 2}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 px-4 rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 font-medium shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {isLoading ? (
              <>
                <Loader2 className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
                Creating account...
              </>
            ) : (
              'Create account'
            )}
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-sm text-gray-600">
            Already have an account?{' '}
            <Link
              to="/login"
              className="font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default Register