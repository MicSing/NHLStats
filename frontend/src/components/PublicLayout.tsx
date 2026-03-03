import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import ThemeToggle from './ThemeToggle'
import { publicNavItems, adminNavItems } from '../config/navConfig'

export default function PublicLayout() {
    const { isAuthenticated, user, logout } = useAuth()

    return (
        <div className="min-h-screen bg-bg text-text flex">
            {/* Sidebar */}
            <aside className="w-60 bg-surface border-r border-border flex flex-col shrink-0">
                <div className="px-5 py-4 border-b border-border">
                    <NavLink to="/" className="text-xl font-bold text-primary tracking-tight">
                        🏒 NHL Stats
                    </NavLink>
                    <p className="text-xs text-text-muted mt-0.5">Season Tracker</p>
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

                    {/* Admin links — only when logged in */}
                    {isAuthenticated && (
                        <>
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
                        </>
                    )}
                </nav>
                <div className="px-4 py-4 border-t border-border">
                    <ThemeToggle />
                    <div className="mt-3">
                        {isAuthenticated ? (
                            <>
                                <p className="text-xs text-text-muted mb-2 truncate">{user?.email}</p>
                                <button
                                    onClick={logout}
                                    className="btn-ghost w-full text-sm"
                                >
                                    Logout
                                </button>
                            </>
                        ) : (
                            <NavLink
                                to="/login"
                                className="block w-full text-center btn-primary text-sm"
                            >
                                Sign In
                            </NavLink>
                        )}
                    </div>
                </div>
            </aside>

            {/* Page content */}
            <main className="flex-1 p-6 overflow-auto bg-bg">
                <Outlet />
            </main>
        </div>
    )
}
