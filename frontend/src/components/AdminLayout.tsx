import { NavLink, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import ThemeToggle from './ThemeToggle'
import LanguageSwitcher from './LanguageSwitcher'
import { publicNavItems, adminNavItems } from '../config/navConfig'

export default function AdminLayout() {
    const { user, logout } = useAuth()
    const { t } = useTranslation()

    return (
        <div className="min-h-screen bg-bg text-text flex">
            {/* Sidebar */}
            <aside className="w-60 bg-surface border-r border-border flex flex-col shrink-0">
                <div className="px-5 py-4 border-b border-border">
                    <h1 className="text-xl font-bold text-primary tracking-tight">{t('layout.appName')}</h1>
                    <p className="text-xs text-text-muted mt-0.5">{t('layout.adminPanel')}</p>
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
                </nav>
                <div className="px-4 py-4 border-t border-border space-y-2">
                    <div className="flex items-center justify-between">
                        <ThemeToggle />
                        <LanguageSwitcher />
                    </div>
                    <p className="text-xs text-text-muted truncate px-3">{user?.email}</p>
                    <button
                        onClick={logout}
                        className="btn-ghost w-full text-sm"
                    >
                        {t('layout.logout')}
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
