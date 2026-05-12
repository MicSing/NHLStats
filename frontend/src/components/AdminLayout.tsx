import { useState } from 'react'
import { NavLink, Outlet, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth, useIsAdmin } from '../context/AuthContext'
import ThemeToggle from './ThemeToggle'
import LanguageSwitcher from './LanguageSwitcher'
import { publicNavItems, adminNavGroups } from '../config/navConfig'

export default function AdminLayout() {
    const { user, logout, isAuthenticated } = useAuth()
    const isAdmin = useIsAdmin()
    const { t } = useTranslation()
    const [sidebarOpen, setSidebarOpen] = useState(false)

    // Extra safety check
    if (!isAdmin) {
        return <Navigate to="/" replace />
    }

    const closeSidebar = () => setSidebarOpen(false)

    const sidebarContent = (
        <>
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-primary tracking-tight">{t('layout.appName')}</h1>
                    <p className="text-xs text-text-muted mt-0.5">{t('layout.adminPanel')}</p>
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
            <nav className="flex-1 px-3 py-3 overflow-y-auto">
                <div className="space-y-0.5 mb-3">
                    {publicNavItems.filter((item) => !item.requiresAuth || isAuthenticated).map((item) => (
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
                </div>
                {isAdmin && (
                    <>
                        <div className="my-2 border-t border-border" />
                        <p className="px-3 pt-1 pb-2 text-xs font-semibold uppercase tracking-widest text-text-muted">{t('nav.admin')}</p>
                        {adminNavGroups.map((group) => (
                            <div key={group.labelKey} className="mb-3">
                                <p className="px-3 pt-1 pb-1 text-xs font-semibold uppercase tracking-widest text-text-muted opacity-60">{t(group.labelKey)}</p>
                                <div className="space-y-0.5">
                                    {group.items.map((item) => (
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
                                </div>
                            </div>
                        ))}
                    </>
                )}
                <div className="mt-3 pt-3 border-t border-border px-1 space-y-2">
                    <p className="text-xs text-text-muted truncate px-2">{user?.email}</p>
                    <button
                        onClick={() => { logout(); closeSidebar() }}
                        className="btn-ghost w-full text-sm"
                    >
                        {t('layout.logout')}
                    </button>
                </div>
            </nav>
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

            {/* Main content */}
            <main className="flex-1 p-4 sm:p-6 overflow-auto bg-bg pt-16 lg:pt-6">
                <Outlet />
            </main>
        </div>
    )
}
