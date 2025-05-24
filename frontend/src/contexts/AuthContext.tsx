import React, { createContext, useState, useEffect, useCallback } from 'react'
import axios from 'axios'

interface User {
  username: string
}

interface AuthContextType {
  user: User | null
  token: string | null
  loading: boolean
  login: (username: string, password: string, remember?: boolean) => Promise<void>
  register: (username: string, password: string) => Promise<void>
  logout: () => void
  isAuthenticated: boolean
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface AuthProviderProps {
  children: React.ReactNode
}

const TOKEN_KEY = 'auth_token'
const REMEMBER_KEY = 'remember_me'
const USER_KEY = 'user_data'

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Parse JWT token to extract user info and expiry
  const parseJWT = (token: string) => {
    try {
      const base64Url = token.split('.')[1]
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      )
      return JSON.parse(jsonPayload)
    } catch {
      return null
    }
  }

  // Check if token is expired
  const isTokenExpired = (token: string): boolean => {
    const payload = parseJWT(token)
    if (!payload || !payload.exp) return true
    return Date.now() >= payload.exp * 1000
  }

  // Initialize auth state from storage
  useEffect(() => {
    const initAuth = () => {
      const remember = localStorage.getItem(REMEMBER_KEY) === 'true'
      const storage = remember ? localStorage : sessionStorage
      const storedToken = storage.getItem(TOKEN_KEY)
      const storedUser = storage.getItem(USER_KEY)

      if (storedToken && !isTokenExpired(storedToken) && storedUser) {
        setToken(storedToken)
        setUser(JSON.parse(storedUser))
        axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`
      } else {
        // Clean up expired auth data
        localStorage.removeItem(TOKEN_KEY)
        localStorage.removeItem(USER_KEY)
        sessionStorage.removeItem(TOKEN_KEY)
        sessionStorage.removeItem(USER_KEY)
      }
      setLoading(false)
    }

    initAuth()
  }, [])

  // Set up token expiry check interval
  useEffect(() => {
    if (!token) return

    const checkInterval = setInterval(() => {
      if (isTokenExpired(token)) {
        logout()
      }
    }, 60000) // Check every minute

    return () => clearInterval(checkInterval)
  }, [token])

  const login = async (username: string, password: string, remember = false) => {
    try {
      const response = await axios.post(
        `${import.meta.env.VITE_API_BASE}/login`,
        new URLSearchParams({ username, password }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      )

      const { access_token } = response.data
      const userData = { username }

      // Store in appropriate storage based on remember me
      const storage = remember ? localStorage : sessionStorage
      storage.setItem(TOKEN_KEY, access_token)
      storage.setItem(USER_KEY, JSON.stringify(userData))
      if (remember) {
        localStorage.setItem(REMEMBER_KEY, 'true')
      } else {
        localStorage.removeItem(REMEMBER_KEY)
      }

      setToken(access_token)
      setUser(userData)
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'Login failed')
    }
  }

  const register = async (username: string, password: string) => {
    try {
      // Register the user
      await axios.post(
        `${import.meta.env.VITE_API_BASE}/register`,
        new URLSearchParams({ username, password }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      )

      // Auto-login after successful registration
      await login(username, password, true)
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'Registration failed')
    }
  }

  const logout = useCallback(() => {
    setUser(null)
    setToken(null)
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    localStorage.removeItem(REMEMBER_KEY)
    sessionStorage.removeItem(TOKEN_KEY)
    sessionStorage.removeItem(USER_KEY)
    delete axios.defaults.headers.common['Authorization']
  }, [])

  const value: AuthContextType = {
    user,
    token,
    loading,
    login,
    register,
    logout,
    isAuthenticated: !!token && !isTokenExpired(token),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}