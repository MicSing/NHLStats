import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CaretDownIcon, CaretLeftIcon, CaretRightIcon, KeyIcon, SignOutIcon } from '@phosphor-icons/react'
import { useAuth, useIsAdmin } from '../context/AuthContext'
import ThemeToggle from './ThemeToggle'
import LanguageSwitcher from './LanguageSwitcher'
import { publicNavItems, adminNavGroups, adminTopNavItems, type NavGroup } from '../config/navConfig'

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
                <CaretDownIcon
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
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [sidebarCollapsed, setSidebarCollapsed] = useState(
        () => localStorage.getItem('sidebarCollapsed') === 'true'
    )
    const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(
        Object.fromEntries(adminNavGroups.map((g) => [g.labelKey, true]))
    )

    const closeSidebar = () => setSidebarOpen(false)
    const toggleCollapsed = () =>
        setSidebarCollapsed((prev) => {
            localStorage.setItem('sidebarCollapsed', String(!prev))
            return !prev
        })
    const toggleGroup = (key: string) =>
        setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }))

    const initials = user?.email ? user.email.slice(0, 2).toUpperCase() : 'U'

    const sidebarContent = (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="border-b border-border flex items-center shrink-0 px-3 pt-4 pb-3">
                {sidebarCollapsed ? (
                    <button
                        onClick={toggleCollapsed}
                        className="hidden lg:flex items-center justify-center w-7 h-7 rounded-md text-text-muted hover:text-text hover:bg-border transition-all duration-200 mx-auto"
                        aria-label="Expand sidebar"
                    >
                        <CaretRightIcon size={16} />
                    </button>
                ) : (
                    <>
                        <NavLink to="/" onClick={closeSidebar} className="flex items-center gap-2.5 min-w-0 flex-1">
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
                        <button
                            onClick={toggleCollapsed}
                            className="hidden lg:flex items-center justify-center w-7 h-7 rounded-md text-text-muted hover:text-text hover:bg-border transition-all duration-200 shrink-0 ml-1"
                            aria-label="Collapse sidebar"
                        >
                            <CaretLeftIcon size={16} />
                        </button>
                    </>
                )}
            </div>

            {/* Nav scroll area */}
            <nav className="flex-1 px-3 py-3 overflow-y-auto">
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
                                    title={sidebarCollapsed ? t(item.labelKey) : undefined}
                                    className={({ isActive }) =>
                                        `flex items-center py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                                            sidebarCollapsed ? 'justify-center px-2' : 'gap-3 px-3'
                                        } ${
                                            isActive
                                                ? 'bg-primary text-white'
                                                : 'text-text-muted hover:bg-border hover:text-text'
                                        }`
                                    }
                                >
                                    <Icon size={18} />
                                    {!sidebarCollapsed && t(item.labelKey)}
                                </NavLink>
                            )
                        })}
                </div>

                {isAdmin && (
                    <div className="mt-4">
                        <div className={`flex items-center gap-2 mb-1 ${sidebarCollapsed ? 'justify-center' : 'px-1'}`}>
                            {!sidebarCollapsed && <div className="flex-1 h-px bg-border" />}
                            {!sidebarCollapsed && (
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted shrink-0">
                                    {t('nav.admin')}
                                </span>
                            )}
                            {!sidebarCollapsed && <div className="flex-1 h-px bg-border" />}
                            {sidebarCollapsed && <div className="w-4 h-px bg-border" />}
                        </div>
                        <div className="space-y-0.5">
                            {adminTopNavItems.map((item) => {
                                const Icon = item.icon
                                return (
                                    <NavLink
                                        key={item.to}
                                        to={item.to}
                                        onClick={closeSidebar}
                                        title={sidebarCollapsed ? t(item.labelKey) : undefined}
                                        className={({ isActive }) =>
                                            `flex items-center py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                                                sidebarCollapsed ? 'justify-center px-2' : 'gap-3 px-3'
                                            } ${
                                                isActive
                                                    ? 'bg-primary text-white'
                                                    : 'text-text-muted hover:bg-border hover:text-text'
                                            }`
                                        }
                                    >
                                        <Icon size={18} />
                                        {!sidebarCollapsed && t(item.labelKey)}
                                    </NavLink>
                                )
                            })}
                        </div>
                        {!sidebarCollapsed && adminNavGroups.map((group) => (
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
            <div className={`shrink-0 border-t border-border mt-auto ${sidebarCollapsed ? 'p-2' : 'p-3'}`}>
                {!sidebarCollapsed && (
                    <div className="flex items-center gap-2 px-1 mb-3">
                        <ThemeToggle />
                        <LanguageSwitcher />
                    </div>
                )}

                {isAuthenticated ? (
                    sidebarCollapsed ? (
                        <div className="flex flex-col items-center gap-2 py-1">
                            <div
                                className="w-8 h-8 rounded-full bg-primary flex items-center justify-center font-bold text-white text-xs shrink-0 cursor-default"
                                title={user?.email ?? undefined}
                            >
                                {initials}
                            </div>
                            <NavLink
                                to="/change-password"
                                onClick={closeSidebar}
                                className="flex items-center justify-center p-2 rounded-lg bg-surface text-text-muted hover:text-text hover:bg-border transition-all duration-200"
                                title={t('common.changePassword')}
                            >
                                <KeyIcon size={14} />
                            </NavLink>
                            <button
                                onClick={() => { logout(); closeSidebar() }}
                                className="flex items-center justify-center p-2 rounded-lg bg-surface text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
                                title={t('layout.logout')}
                            >
                                <SignOutIcon size={14} />
                            </button>
                        </div>
                    ) : (
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
                                    <KeyIcon size={14} />
                                </NavLink>
                                <button
                                    onClick={() => { logout(); closeSidebar() }}
                                    className="flex items-center justify-center p-2 rounded-lg bg-surface text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
                                    title={t('layout.logout')}
                                >
                                    <SignOutIcon size={14} />
                                </button>
                            </div>
                        </div>
                    )
                ) : (
                    sidebarCollapsed ? (
                        <NavLink
                            to="/login"
                            onClick={closeSidebar}
                            className="flex items-center justify-center w-8 h-8 mx-auto rounded-lg bg-primary text-white hover:bg-primary/90 transition-all duration-200"
                            title={t('layout.signIn')}
                        >
                            <SignOutIcon size={14} className="rotate-180" />
                        </NavLink>
                    ) : (
                        <NavLink
                            to="/login"
                            onClick={closeSidebar}
                            className="block w-full text-center btn-primary text-sm"
                        >
                            {t('layout.signIn')}
                        </NavLink>
                    )
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
                    relative
                    fixed lg:static z-50 lg:z-auto
                    w-64 bg-surface border-r border-border shrink-0
                    h-full lg:h-screen overflow-hidden
                    transition-[width,transform] duration-200 ease-in-out
                    ${sidebarCollapsed ? 'lg:w-16' : 'lg:w-64'}
                    ${sidebarOpen ? 'translate-x-0 animate-slide-from-left' : '-translate-x-full lg:translate-x-0'}
                `}
            >
                {sidebarContent}
            </aside>

            {/* Page content */}
            <main className="flex-1 px-4 sm:px-6 pb-4 sm:pb-6 overflow-auto bg-bg pt-16 lg:pt-6">
                <Outlet />
            </main>
        </div>
    )
}
