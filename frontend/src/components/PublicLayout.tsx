import { useState, useEffect } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CaretDownIcon, CaretLeftIcon, CaretRightIcon, GearSixIcon, SignOutIcon, TrophyIcon } from '@phosphor-icons/react'
import { useAuth, useIsAdmin } from '../context/AuthContext'
import { cacheService } from '../services/cacheService'
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

    const [hasRecentAchievements, setHasRecentAchievements] = useState(false)

    useEffect(() => {
        const userId = user?.userId
        if (!userId) {
            setHasRecentAchievements(false)
            return
        }

        const checkNewAchievements = () => {
            cacheService.getAchievements(userId).then((res) => {
                const lastViewedStr = localStorage.getItem(`nhl_achievements_last_viewed_${userId}`)
                const lastViewedTime = lastViewedStr ? new Date(lastViewedStr).getTime() : 0
                const cutoffTime = Math.max(Date.now() - 7 * 86_400_000, lastViewedTime)

                const hasNew = res.achievements?.some((a) =>
                    a.earned && a.occurrences.some((occ) => {
                        if (!occ.occurredOn) return false
                        return new Date(occ.occurredOn).getTime() > cutoffTime
                    })
                ) ?? false
                setHasRecentAchievements(hasNew)
            }).catch(() => { /* silent */ })
        }

        checkNewAchievements()

        const handleViewed = () => {
            setHasRecentAchievements(false)
        }
        window.addEventListener('achievements-viewed', handleViewed)
        return () => {
            window.removeEventListener('achievements-viewed', handleViewed)
        }
    }, [user?.userId])

    const initials = user?.alias
        ? user.alias.slice(0, 2).toUpperCase()
        : user?.email
            ? user.email.slice(0, 2).toUpperCase()
            : 'U'

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
                            <img src="/favicon.png" alt="NHL Stats" className="w-8 h-8 rounded-lg shrink-0 object-cover" />
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
                {isAuthenticated ? (
                    sidebarCollapsed ? (
                        <div className="flex flex-col items-center gap-2 py-1">
                            <NavLink
                                to={hasRecentAchievements ? '/profile?tab=achievements' : '/profile'}
                                onClick={closeSidebar}
                                className="relative flex items-center justify-center cursor-pointer group"
                                title={hasRecentAchievements ? t('profile.achievements.newAchievementBadge') : t('profile.title')}
                            >
                                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center font-bold text-white text-xs shrink-0 group-hover:ring-2 group-hover:ring-primary/50 transition-all">
                                    {initials}
                                </div>
                                {hasRecentAchievements && (
                                    <span
                                        data-testid="achievement-badge-collapsed"
                                        className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center shadow-md ring-2 ring-surface animate-bounce"
                                        title={t('profile.achievements.newAchievementBadge')}
                                    >
                                        <TrophyIcon size={10} weight="fill" />
                                    </span>
                                )}
                            </NavLink>
                            <button
                                onClick={() => { logout(); closeSidebar() }}
                                className="flex items-center justify-center p-2 rounded-lg bg-surface text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
                                title={t('layout.logout')}
                                aria-label={t('layout.logout')}
                            >
                                <SignOutIcon size={14} />
                            </button>
                        </div>
                    ) : (
                        <div className="bg-bg rounded-xl p-2.5 border border-border flex items-center justify-between gap-2">
                            <NavLink
                                to={hasRecentAchievements ? '/profile?tab=achievements' : '/profile'}
                                onClick={closeSidebar}
                                className={({ isActive }) =>
                                    `flex items-center gap-2.5 min-w-0 flex-1 p-1 -m-0.5 rounded-lg transition-colors group cursor-pointer ${
                                        isActive ? 'bg-surface/80' : 'hover:bg-surface/80'
                                    }`
                                }
                                title={hasRecentAchievements ? t('profile.achievements.newAchievementBadge') : t('profile.title')}
                            >
                                <div className="relative w-8 h-8 rounded-full bg-primary flex items-center justify-center font-bold text-white text-xs shrink-0 group-hover:ring-2 group-hover:ring-primary/40 transition-all">
                                    {initials}
                                    {hasRecentAchievements && (
                                        <span
                                            data-testid="achievement-badge"
                                            className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center shadow-md ring-2 ring-bg animate-bounce"
                                            title={t('profile.achievements.newAchievementBadge')}
                                        >
                                            <TrophyIcon size={10} weight="fill" />
                                        </span>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        <p className="text-xs font-semibold text-text truncate group-hover:text-primary transition-colors">
                                            {user?.alias || user?.email}
                                        </p>
                                        {hasRecentAchievements && (
                                            <span title={t('profile.achievements.newAchievementBadge')} className="inline-flex items-center">
                                                <TrophyIcon
                                                    data-testid="achievement-nav-icon"
                                                    size={13}
                                                    weight="fill"
                                                    className="text-amber-400 shrink-0 animate-pulse"
                                                />
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-[10px] text-text-muted uppercase font-semibold tracking-tight">
                                        {isAdmin ? t('layout.adminPanel') : t('profile.title')}
                                    </p>
                                </div>
                            </NavLink>
                            <button
                                onClick={() => { logout(); closeSidebar() }}
                                className="flex items-center justify-center p-2 rounded-lg bg-surface text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-all duration-200 shrink-0"
                                title={t('layout.logout')}
                                aria-label={t('layout.logout')}
                            >
                                <SignOutIcon size={16} />
                            </button>
                        </div>
                    )
                ) : (
                    sidebarCollapsed ? (
                        <div className="flex flex-col items-center gap-2 py-1">
                            <NavLink
                                to="/profile"
                                onClick={closeSidebar}
                                className="flex items-center justify-center p-2 rounded-lg bg-surface text-text-muted hover:text-text hover:bg-border transition-all duration-200"
                                title={t('profile.tabs.settings')}
                            >
                                <GearSixIcon size={16} />
                            </NavLink>
                            <NavLink
                                to="/login"
                                onClick={closeSidebar}
                                className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-white hover:bg-primary/90 transition-all duration-200"
                                title={t('layout.signIn')}
                            >
                                <SignOutIcon size={14} className="rotate-180" />
                            </NavLink>
                        </div>
                    ) : (
                        <div className="bg-bg rounded-xl p-2.5 border border-border flex items-center justify-between gap-2">
                            <NavLink
                                to="/profile"
                                onClick={closeSidebar}
                                className={({ isActive }) =>
                                    `flex items-center gap-2.5 min-w-0 flex-1 p-1 -m-0.5 rounded-lg transition-colors group cursor-pointer ${
                                        isActive ? 'bg-surface/80' : 'hover:bg-surface/80'
                                    }`
                                }
                                title={t('profile.tabs.settings')}
                            >
                                <div className="w-8 h-8 rounded-full bg-surface border border-border flex items-center justify-center font-bold text-text-muted text-xs shrink-0 group-hover:border-primary/50 group-hover:text-primary transition-all">
                                    <GearSixIcon size={15} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-semibold text-text truncate group-hover:text-primary transition-colors">
                                        {t('profile.tabs.settings')}
                                    </p>
                                    <p className="text-[10px] text-text-muted uppercase font-semibold tracking-tight">
                                        {t('profile.guestRole')}
                                    </p>
                                </div>
                            </NavLink>
                            <NavLink
                                to="/login"
                                onClick={closeSidebar}
                                className="btn-primary text-xs px-2.5 py-1.5 rounded-lg shrink-0 font-medium"
                                title={t('layout.signIn')}
                            >
                                {t('layout.signIn')}
                            </NavLink>
                        </div>
                    )
                )}
            </div>
        </div>
    )

    return (
        <div className="h-screen bg-bg text-text flex overflow-hidden">
            {/* Mobile top bar */}
            <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-surface border-b border-border px-3 py-2.5 flex items-center justify-between">
                <button
                    onClick={() => setSidebarOpen(true)}
                    className="relative text-text-muted hover:text-text text-2xl leading-none p-1 -ml-1"
                    aria-label={t('common.openMenu')}
                >
                    ☰
                    {hasRecentAchievements && (
                        <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    )}
                </button>
                <span className="flex items-center gap-2 text-sm font-bold text-primary">
                    <img src="/favicon.png" alt="NHL Stats" className="w-6 h-6 rounded-md object-cover" />
                    NHL Stats
                </span>
                <div className="flex items-center gap-2">
                    {isAuthenticated ? (
                        <NavLink
                            to={hasRecentAchievements ? '/profile?tab=achievements' : '/profile'}
                            className="relative flex items-center justify-center"
                            title={hasRecentAchievements ? t('profile.achievements.newAchievementBadge') : t('profile.title')}
                        >
                            <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center font-bold text-white text-[11px] shrink-0">
                                {initials}
                            </div>
                            {hasRecentAchievements && (
                                <span
                                    data-testid="achievement-badge-mobile"
                                    className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center shadow-md ring-1 ring-surface animate-bounce"
                                    title={t('profile.achievements.newAchievementBadge')}
                                >
                                    <TrophyIcon size={8} weight="fill" />
                                </span>
                            )}
                        </NavLink>
                    ) : (
                        <div className="flex items-center gap-1.5">
                            <NavLink
                                to="/profile"
                                className="flex items-center justify-center p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-border transition-all"
                                title={t('profile.tabs.settings')}
                            >
                                <GearSixIcon size={18} />
                            </NavLink>
                            <NavLink
                                to="/login"
                                className="btn-primary text-xs px-2.5 py-1 rounded-lg font-medium"
                            >
                                {t('layout.signIn')}
                            </NavLink>
                        </div>
                    )}
                </div>
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
                    w-72 sm:w-64 bg-surface border-r border-border shrink-0
                    h-full lg:h-screen overflow-hidden
                    transition-[width,transform] duration-200 ease-in-out
                    ${sidebarCollapsed ? 'lg:w-16' : 'lg:w-64'}
                    ${sidebarOpen ? 'translate-x-0 animate-slide-from-left' : '-translate-x-full lg:translate-x-0'}
                `}
            >
                {sidebarContent}
            </aside>

            {/* Page content */}
            <main className="flex-1 px-3 sm:px-6 pb-4 sm:pb-6 overflow-auto bg-bg pt-16 lg:pt-6">
                <Outlet />
            </main>
        </div>
    )
}
