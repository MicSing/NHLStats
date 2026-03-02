import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const publicNavItems = [
    { to: '/dashboard', label: '📊 Dashboard' },
    { to: '/seasons', label: '🏒 Seasons' },
    { to: '/earnings', label: '💰 Earnings' },
]

const adminNavItems = [
    { to: '/admin/users', label: 'Users' },
    { to: '/admin/seasons', label: 'Seasons' },
    { to: '/admin/roster', label: 'Roster' },
    { to: '/admin/point-reasons', label: 'Point Reasons' },
    { to: '/admin/money-config', label: 'Money Config' },
    { to: '/admin/expenses', label: 'Expenses' },
]

export default function PublicLayout() {
    const { isAuthenticated, user, logout } = useAuth()

    return (
        <div className="min-h-screen bg-gray-900 text-white">
            {/* Top Navigation */}
            <nav className="bg-gray-800 border-b border-gray-700">
                <div className="max-w-7xl mx-auto px-4 flex items-center h-14">
                    <NavLink to="/" className="text-xl font-bold text-cyan-400 mr-8 shrink-0">
                        NHL Stats
                    </NavLink>

                    {/* Public links — always visible */}
                    <div className="flex items-center gap-1">
                        {publicNavItems.map((item) => (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                className={({ isActive }) =>
                                    `px-3 py-2 rounded text-sm whitespace-nowrap ${isActive
                                        ? 'bg-cyan-700 text-white'
                                        : 'text-gray-300 hover:bg-gray-700'
                                    }`
                                }
                            >
                                {item.label}
                            </NavLink>
                        ))}
                    </div>

                    {/* Admin links — only when logged in */}
                    {isAuthenticated && (
                        <div className="flex items-center gap-1 ml-4 pl-4 border-l border-gray-600">
                            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 mr-1">
                                Admin
                            </span>
                            {adminNavItems.map((item) => (
                                <NavLink
                                    key={item.to}
                                    to={item.to}
                                    className={({ isActive }) =>
                                        `px-3 py-2 rounded text-sm whitespace-nowrap ${isActive
                                            ? 'bg-cyan-700 text-white'
                                            : 'text-gray-300 hover:bg-gray-700'
                                        }`
                                    }
                                >
                                    {item.label}
                                </NavLink>
                            ))}
                        </div>
                    )}

                    {/* Right side — auth controls */}
                    <div className="ml-auto flex items-center gap-3 shrink-0">
                        {isAuthenticated ? (
                            <>
                                <span className="text-xs text-gray-400 hidden sm:inline">
                                    {user?.email}
                                </span>
                                <button
                                    onClick={logout}
                                    className="text-sm bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded"
                                >
                                    Logout
                                </button>
                            </>
                        ) : (
                            <NavLink
                                to="/login"
                                className="text-sm bg-cyan-700 hover:bg-cyan-600 px-3 py-1 rounded"
                            >
                                Sign In
                            </NavLink>
                        )}
                    </div>
                </div>
            </nav>

            {/* Page content */}
            <main>
                <Outlet />
            </main>
        </div>
    )
}
