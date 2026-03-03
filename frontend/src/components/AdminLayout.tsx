import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const navItems = [
    { to: '/admin/users', label: 'Users' },
    { to: '/admin/seasons', label: 'Seasons' },
    { to: '/admin/roster', label: 'Roster' },
    { to: '/admin/point-reasons', label: 'Point Reasons' },
    { to: '/admin/money-config', label: 'Money Config' },
    { to: '/admin/expenses', label: 'Expenses' },
    { to: '/admin/matches', label: 'Matches' },
    { to: '/admin/aggregated-points', label: 'Aggregated Points' },
    { to: '/admin/payouts', label: 'Payouts' },
]

const publicNavItems = [
    { to: '/dashboard', label: '📊 Dashboard' },
    { to: '/seasons', label: '🏒 Seasons' },
    { to: '/earnings', label: '💰 Earnings' },
]

export default function AdminLayout() {
    const { user, logout } = useAuth()

    return (
        <div className="min-h-screen bg-gray-900 text-white flex">
            {/* Sidebar */}
            <aside className="w-56 bg-gray-800 flex flex-col shrink-0">
                <div className="p-4 border-b border-gray-700">
                    <h1 className="text-xl font-bold text-cyan-400">NHL Stats</h1>
                    <p className="text-xs text-gray-400">Admin Panel</p>
                </div>
                <nav className="flex-1 p-2">
                    <p className="px-4 py-1 text-xs font-semibold uppercase tracking-wider text-gray-500">Menu</p>
                    {publicNavItems.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            className={({ isActive }) =>
                                `block px-4 py-2 rounded mb-1 text-sm ${isActive
                                    ? 'bg-cyan-700 text-white'
                                    : 'text-gray-300 hover:bg-gray-700'
                                }`
                            }
                        >
                            {item.label}
                        </NavLink>
                    ))}
                    <p className="px-4 py-1 mt-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Admin</p>
                    {navItems.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            className={({ isActive }) =>
                                `block px-4 py-2 rounded mb-1 text-sm ${isActive
                                    ? 'bg-cyan-700 text-white'
                                    : 'text-gray-300 hover:bg-gray-700'
                                }`
                            }
                        >
                            {item.label}
                        </NavLink>
                    ))}
                </nav>
                <div className="p-4 border-t border-gray-700">
                    <p className="text-xs text-gray-400 mb-2 truncate">{user?.email}</p>
                    <button
                        onClick={logout}
                        className="w-full text-sm bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded"
                    >
                        Logout
                    </button>
                </div>
            </aside>

            {/* Main content */}
            <main className="flex-1 p-6 overflow-auto">
                <Outlet />
            </main>
        </div>
    )
}
