import { NavLink } from 'react-router-dom'
import { Home, Receipt, PiggyBank, Settings, TrendingUp, Calendar, HelpCircle } from 'lucide-react'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

const Sidebar = ({ isOpen, onClose }: SidebarProps) => {
  const navItems = [
    {
      path: '/dashboard',
      name: 'Dashboard',
      icon: Home,
    },
    {
      path: '/transactions',
      name: 'Transactions',
      icon: Receipt,
    },
    {
      path: '/budget',
      name: 'Budget',
      icon: PiggyBank,
    },
    {
      path: '/analytics',
      name: 'Analytics',
      icon: TrendingUp,
    },
    {
      path: '/calendar',
      name: 'Calendar',
      icon: Calendar,
    },
    {
      path: '/settings',
      name: 'Settings',
      icon: Settings,
    },
  ]

  return (
    <div
      className={`fixed inset-y-0 left-0 z-30 w-64 bg-white border-r border-gray-200 pt-16 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      <div className="flex flex-col h-full">
        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={({ isActive }) =>
                  `group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                    isActive
                      ? 'bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-700 border-l-4 border-indigo-600'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      className={`mr-3 h-5 w-5 transition-colors ${
                        isActive
                          ? 'text-indigo-600'
                          : 'text-gray-400 group-hover:text-gray-500'
                      }`}
                    />
                    {item.name}
                  </>
                )}
              </NavLink>
            )
          })}
        </nav>

        {/* Bottom section */}
        <div className="p-4 border-t border-gray-200">
          <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg p-4 text-white">
            <h3 className="font-semibold mb-1">Need Help?</h3>
            <p className="text-sm opacity-90 mb-3">
              Check out our guides and tutorials
            </p>
            <button className="flex items-center text-sm font-medium bg-white bg-opacity-20 rounded-md px-3 py-1.5 hover:bg-opacity-30 transition-colors">
              <HelpCircle className="h-4 w-4 mr-1" />
              Help Center
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Sidebar