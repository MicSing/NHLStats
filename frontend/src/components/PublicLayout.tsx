import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CaretDown, Key, SignOut } from '@phosphor-icons/react'
import { useAuth, useIsAdmin } from '../context/AuthContext'
import ThemeToggle from './ThemeToggle'
import LanguageSwitcher from './LanguageSwitcher'
import { publicNavItems, adminNavGroups, type NavGroup } from '../config/navConfig'

function AccordionGroup({
    group,
    isOpen,
    onToggle,
    onNav,
}: {
    group: NavGroup
    isOpen: boolean
    onToggle: () => void
    onNav: () => void
}) {
    const { t } = useTranslation()
    const GroupIcon = group.icon

    return (
        <div>
            <button
                onClick={onToggle}
                className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wider text-text-muted hover:text-text transition-colors duration-200"
            >
                <div className="flex items-center gap-2">
                    <GroupIcon size={14} />
                    <span>{t(group.labelKey)}</span>
                </div>
                <CaretDown
                    size={14}
                    className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                />
            </button>
            {isOpen && (
                <div className="pl-4 ml-3 border-l border-border space-y-0.5">
                    {group.items.map((item) => {
                        const ItemIcon = item.icon
                        return (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                onClick={onNav}
                                className={({ isActive }) =>
                                    `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                                        isActive
                                            ? 'bg-primary text-white'
                                            : 'text-text-muted hover:bg-border hover:text-text'
                                    }`
                                }
                            >
                                <ItemIcon size={15} />
                                {t(item.labelKey)}
                            </NavLink>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

export default function PublicLayout() {
    const { isAuthenticated, user, logout } = useAuth()
    const isAdmin = useIsAdmin()
    const { t } = useTranslation()
    const location = useLocation()
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [isAdminMode, setIsAdminMode] = useState(() =>
        location.pathname.startsWith('/admin')
    )
    const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(
        Object.fromEntries(adminNavGroups.map((g) => [g.labelKey, true]))
    )

    const closeSidebar = () => setSidebarOpen(false)
    const toggleGroup = (key: string) =>
        setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }))

    const initials = user?.email ? user.email.slice(0, 2).toUpperCase() : 'U'

    const sidebarContent = (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="px-4 pt-4 pb-3 border-b border-border flex items-center justify-between shrink-0">
                <NavLink to="/" onClick={closeSidebar} className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shrink-0">
                        <span className="text-white text-sm font-bold leading-none">N</span>
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-bold text-text leading-none truncate">NHL Stats</p>
                        <p className="text-[10px] text-text-muted uppercase font-semibold tracking-tight mt-0.5">
                            {t('layout.seasonTracker')}
                        </p>
                    </div>
                </NavLink>
                <button
                    onClick={closeSidebar}
                    className="lg:hidden text-text-muted hover:text-text text-2xl leading-none ml-2 shrink-0"
                    aria-label={t('common.closeMenu')}
                >
                    ×
                </button>
            </div>

            {/* Mode switcher — admin only */}
            {isAdmin && (
                <div className="px-3 pt-3 pb-1 shrink-0">
                    <div className="grid grid-cols-2 p-1 bg-bg rounded-lg border border-border">
                        <button
                            onClick={() => setIsAdminMode(false)}
                            className={`py-1.5 text-xs font-semibold rounded-md transition-all duration-200 ${
                                !isAdminMode
                                    ? 'bg-surface text-text shadow-sm'
                                    : 'text-text-muted hover:text-text'
                            }`}
                        >
                            {t('nav.client')}
                        </button>
                        <button
                            onClick={() => setIsAdminMode(true)}
                            className={`py-1.5 text-xs font-semibold rounded-md transition-all duration-200 ${
                                isAdminMode
                                    ? 'bg-blue-600 text-white shadow-sm'
                                    : 'text-text-muted hover:text-text'
                            }`}
                        >
                            {t('nav.admin')}
                        </button>
                    </div>
                </div>
            )}

            {/* Nav scroll area */}
            <nav className="flex-1 px-3 py-3 overflow-y-auto">
                {!isAdminMode || !isAdmin ? (
                    <div className="space-y-0.5">
                        {publicNavItems
                            .filter((item) => !item.requiresAuth || isAuthenticated)
                            .map((item) => {
                                const Icon = item.icon
                                return (
                                    <NavLink
                                        key={item.to}
                                        to={item.to}
                                        onClick={closeSidebar}
                                        className={({ isActive }) =>
                                            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                                                isActive
                                                    ? 'bg-primary text-white'
                                                    : 'text-text-muted hover:bg-border hover:text-text'
                                            }`
                                        }
                                    >
                                        <Icon size={18} />
                                        {t(item.labelKey)}
                                    </NavLink>
                                )
                            })}
                    </div>
                ) : (
                    <div className="space-y-2">
                        {adminNavGroups.map((group) => (
                            <AccordionGroup
                                key={group.labelKey}
                                group={group}
                                isOpen={openGroups[group.labelKey] ?? true}
                                onToggle={() => toggleGroup(group.labelKey)}
                                onNav={closeSidebar}
                            />
                        ))}
                    </div>
                )}
            </nav>

            {/* Footer */}
            <div className="shrink-0 border-t border-border p-3 space-y-3 mt-auto">
                <div className="flex items-center gap-2 px-1">
                    <ThemeToggle />
                    <LanguageSwitcher />
                </div>

                {isAuthenticated ? (
                    <div className="bg-bg rounded-xl p-3 border border-border">
                        <div className="flex items-center gap-2.5 mb-2.5">
                            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center font-bold text-white text-xs shrink-0">
                                {initials}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-text truncate">{user?.email}</p>
                                {isAdmin && (
                                    <p className="text-[10px] text-text-muted uppercase font-bold tracking-tight">
                                        {t('layout.adminPanel')}
                                    </p>
                                )}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <NavLink
                                to="/change-password"
                                onClick={closeSidebar}
                                className="flex items-center justify-center p-2 rounded-lg bg-surface text-text-muted hover:text-text hover:bg-border transition-all duration-200"
                                title={t('common.changePassword')}
                            >
                                <Key size={14} />
                            </NavLink>
                            <button
                                onClick={() => { logout(); closeSidebar() }}
                                className="flex items-center justify-center p-2 rounded-lg bg-surface text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
                                title={t('layout.logout')}
                            >
                                <SignOut size={14} />
                            </button>
                        </div>
                    </div>
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
    )

    return (
        <div className="h-screen bg-bg text-text flex overflow-hidden">
            {/* Mobile top bar */}
            <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-surface border-b border-border px-4 py-3 flex items-center justify-between">
                <button
                    onClick={() => setSidebarOpen(true)}
                    className="text-text-muted hover:text-text text-2xl leading-none"
                    aria-label={t('common.openMenu')}
                >
                    ☰
                </button>
                <span className="text-sm font-bold text-primary">NHL Stats</span>
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
                    w-64 bg-surface border-r border-border shrink-0
                    h-full lg:h-screen
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
