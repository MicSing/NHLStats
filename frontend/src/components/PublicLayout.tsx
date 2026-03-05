import { NavLink, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import ThemeToggle from './ThemeToggle'
import LanguageSwitcher from './LanguageSwitcher'
import { publicNavItems, adminNavItems } from '../config/navConfig'

export default function PublicLayout() {
    const { isAuthenticated, user, logout } = useAuth()
    const { t } = useTranslation()

    return (
        <div className="min-h-screen bg-bg text-text flex">
            {/* Sidebar */}
            <aside className="w-60 bg-surface border-r border-border flex flex-col shrink-0">
                <div className="px-5 py-4 border-b border-border">
                    <NavLink to="/" className="text-xl font-bold text-primary tracking-tight">
                        {t('layout.appName')}
                    </NavLink>
                    <p className="text-xs text-text-muted mt-0.5">{t('layout.seasonTracker')}</p>
                </div>
                <div className="flex items-center justify-between px-4 py-2 border-b border-border">
                    <ThemeToggle />
                    <LanguageSwitcher />
                </div>
                <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
                    <p className="px-3 pt-1 pb-2 text-xs font-semibold uppercase tracking-widest text-text-muted">{t('nav.menu')}</p>
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
                            {t(item.labelKey)}
                        </NavLink>
                    ))}

                    {/* Admin links — only when logged in */}
                    {isAuthenticated && (
                        <>
                            <p className="px-3 pt-4 pb-2 text-xs font-semibold uppercase tracking-widest text-text-muted">{t('nav.admin')}</p>
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
                                    {t(item.labelKey)}
                                </NavLink>
                            ))}
                        </>
                    )}
                </nav>
                <div className="px-4 py-4 border-t border-border">
                    <div>
                        {isAuthenticated ? (
                            <>
                                <p className="text-xs text-text-muted mb-2 truncate">{user?.email}</p>
                                <button
                                    onClick={logout}
                                    className="btn-ghost w-full text-sm"
                                >
                                    {t('layout.logout')}
                                </button>
                            </>
                        ) : (
                            <NavLink
                                to="/login"
                                className="block w-full text-center btn-primary text-sm"
                            >
                                {t('layout.signIn')}
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
