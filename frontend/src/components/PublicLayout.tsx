import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import ThemeToggle from './ThemeToggle'
import LanguageSwitcher from './LanguageSwitcher'
import { publicNavItems, adminNavItems } from '../config/navConfig'

export default function PublicLayout() {
    const { isAuthenticated, user, logout } = useAuth()
    const { t } = useTranslation()
    const [sidebarOpen, setSidebarOpen] = useState(false)

    const closeSidebar = () => setSidebarOpen(false)

    const sidebarContent = (
        <>
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                <div>
                    <NavLink to="/" className="text-xl font-bold text-primary tracking-tight" onClick={closeSidebar}>
                        {t('layout.appName')}
                    </NavLink>
                    <p className="text-xs text-text-muted mt-0.5">{t('layout.seasonTracker')}</p>
                </div>
                <button
                    onClick={closeSidebar}
                    className="lg:hidden text-text-muted hover:text-text text-2xl leading-none"
                    aria-label={t('common.closeMenu')}
                >
                    ×
                </button>
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
                        onClick={closeSidebar}
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

                {isAuthenticated && (
                    <>
                        <p className="px-3 pt-4 pb-2 text-xs font-semibold uppercase tracking-widest text-text-muted">{t('nav.admin')}</p>
                        {adminNavItems.map((item) => (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                onClick={closeSidebar}
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
                                onClick={() => { logout(); closeSidebar() }}
                                className="btn-ghost w-full text-sm"
                            >
                                {t('layout.logout')}
                            </button>
                        </>
                    ) : (
                        <NavLink
                            to="/login"
                            onClick={closeSidebar}
                            className="block w-full text-center btn-primary text-sm"
                        >
                            {t('layout.signIn')}
                        </NavLink>
                    )}
                </div>
            </div>
        </>
    )

    return (
        <div className="min-h-screen bg-bg text-text flex">
            {/* Mobile top bar */}
            <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-surface border-b border-border px-4 py-3 flex items-center justify-between">
                <button
                    onClick={() => setSidebarOpen(true)}
                    className="text-text-muted hover:text-text text-2xl leading-none"
                    aria-label={t('common.openMenu')}
                >
                    ☰
                </button>
                <span className="text-sm font-bold text-primary">{t('layout.appName')}</span>
                <div className="w-8" />
            </div>

            {/* Mobile overlay */}
            {sidebarOpen && (
                <div
                    className="lg:hidden fixed inset-0 bg-black/60 z-40 animate-fade-in"
                    onClick={closeSidebar}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`
                    fixed lg:static z-50 lg:z-auto
                    w-60 bg-surface border-r border-border flex flex-col shrink-0
                    h-full lg:h-auto
                    transition-transform lg:transform-none
                    ${sidebarOpen ? 'translate-x-0 animate-slide-from-left' : '-translate-x-full lg:translate-x-0'}
                `}
            >
                {sidebarContent}
            </aside>

            {/* Page content */}
            <main className="flex-1 p-4 sm:p-6 overflow-auto bg-bg pt-16 lg:pt-6">
                <Outlet />
            </main>
        </div>
    )
}
