import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import ThemeToggle from './ThemeToggle'
import { publicNavItems, adminNavItems } from '../config/navConfig'

export default function AdminLayout() {
    const { user, logout } = useAuth()

    return (
        <div className="min-h-screen bg-bg text-text flex">
            {/* Sidebar */}
            <aside className="w-60 bg-surface border-r border-border flex flex-col shrink-0">
                <div className="px-5 py-4 border-b border-border">
                    <h1 className="text-xl font-bold text-primary tracking-tight">🏒 NHL Stats</h1>
                    <p className="text-xs text-text-muted mt-0.5">Admin Panel</p>
                </div>
                <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
                    <p className="px-3 pt-1 pb-2 text-xs font-semibold uppercase tracking-widest text-text-muted">Menu</p>
                    {publicNavItems.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            className={({ isActive }) =>
                                `flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isActive
                                    ? 'bg-primary text-white'
                                    : 'text-text-muted hover:bg-border hover:text-text'
                                }`
                            }
                        >
                            {item.label}
                        </NavLink>
                    ))}
                    <p className="px-3 pt-4 pb-2 text-xs font-semibold uppercase tracking-widest text-text-muted">Admin</p>
                    {adminNavItems.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            className={({ isActive }) =>
                                `flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isActive
                                    ? 'bg-primary text-white'
                                    : 'text-text-muted hover:bg-border hover:text-text'
                                }`
                            }
                        >
                            {item.label}
                        </NavLink>
                    ))}
                </nav>
                <div className="px-4 py-4 border-t border-border space-y-2">
                    <ThemeToggle />
                    <p className="text-xs text-text-muted truncate px-3">{user?.email}</p>
                    <button
                        onClick={logout}
                        className="btn-ghost w-full text-sm"
                    >
                        Logout
                    </button>
                </div>
            </aside>

            {/* Main content */}
            <main className="flex-1 p-6 overflow-auto bg-bg">
                <Outlet />
            </main>
        </div>
    )
}
