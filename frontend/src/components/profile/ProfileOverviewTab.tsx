import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
    SparkleIcon,
    TrophyIcon,
    WalletIcon,
    ArrowRightIcon,
    UserCircleIcon,
    CalendarCheckIcon,
    CrownIcon,
    EnvelopeIcon,
    CheckCircleIcon,
} from '@phosphor-icons/react'
import type { User } from '../../types/auth'
import type { AchievementResult, AchievementOccurrence } from '../../types/achievement'
import type { BettingBalanceDto } from '../../types/bet'
import { cacheService } from '../../services/cacheService'
import { ACHIEVEMENT_DEFS, type AchievementDef } from '../stats/achievementDefs'

interface ProfileOverviewTabProps {
    user: User | null
    playerName: string | null
    achievements: AchievementResult[]
    balance: BettingBalanceDto | null
    activeBetsCount: number
    onSelectTab: (tab: 'overview' | 'bets' | 'achievements' | 'settings') => void
    onOpenAchievementModal: (def: AchievementDef, result: AchievementResult) => void
}

interface LastPlayedWeekInfo {
    seasonId: number | null
    seasonName: string | null
    weekNumber: number
}

function isRecent(date: string | null, days = 7): boolean {
    if (!date) return false
    return new Date(date) >= new Date(Date.now() - days * 86_400_000)
}

function formatRecentDate(date: string | null): string {
    if (!date) return ''
    return new Date(date).toLocaleDateString('sk-SK', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    })
}

function getInitials(name: string): string {
    const clean = name.trim()
    if (!clean) return 'U'
    const parts = clean.split(/\s+/)
    if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase()
    }
    return clean.slice(0, 2).toUpperCase()
}

export default function ProfileOverviewTab({
    user,
    playerName,
    achievements,
    balance,
    activeBetsCount,
    onSelectTab,
    onOpenAchievementModal,
}: ProfileOverviewTabProps) {
    const { t } = useTranslation()

    const displayName = playerName || user?.alias || user?.email?.split('@')[0] || t('common.user')

    // Find the currently last played week from the active/most recent season
    const [lastPlayedWeek, setLastPlayedWeek] = useState<LastPlayedWeekInfo | null>(null)

    useEffect(() => {
        let isMounted = true
        cacheService
            .getSeasons()
            .then(async (seasons) => {
                if (!isMounted || !seasons || seasons.length === 0) return
                const sorted = [...seasons].sort(
                    (a, b) => new Date(b.startedOn).getTime() - new Date(a.startedOn).getTime()
                )
                const active = sorted.find((s) => s.status === 'Active') || sorted[0]
                try {
                    const weeks = await cacheService.getSeasonWeeklyGroups(active.id)
                    if (!isMounted) return
                    if (weeks && weeks.length > 0) {
                        setLastPlayedWeek({
                            seasonId: active.id,
                            seasonName: active.name,
                            weekNumber: weeks[0].weekNumber,
                        })
                    }
                } catch {
                    // Fallback to occurrences
                }
            })
            .catch(() => {
                // Ignore failure and fallback
            })

        return () => {
            isMounted = false
        }
    }, [])

    // Effective last played week: from API or inferred from highest occurrence week
    const effectiveLastPlayedWeek = useMemo(() => {
        if (lastPlayedWeek) return lastPlayedWeek

        let maxWeek: number | null = null
        let maxSeasonId: number | null = null
        let maxSeasonName: string | null = null
        let latestTime = 0

        for (const a of achievements) {
            for (const occ of a.occurrences) {
                if (occ.weekNumber != null) {
                    const time = occ.occurredOn ? new Date(occ.occurredOn).getTime() : 0
                    if (time >= latestTime) {
                        latestTime = time
                        maxWeek = occ.weekNumber
                        maxSeasonId = occ.seasonId
                        maxSeasonName = occ.seasonName
                    }
                }
            }
        }

        if (maxWeek != null) {
            return {
                seasonId: maxSeasonId,
                seasonName: maxSeasonName,
                weekNumber: maxWeek,
            }
        }
        return null
    }, [lastPlayedWeek, achievements])

    // Find achievements earned or leveled up in the currently last played week (or fallback to last 7 days)
    const recentAchievements = achievements
        .map((result) => {
            const def = ACHIEVEMENT_DEFS.find((d) => d.id === result.id)
            if (!def || !result.earned) return null

            // Find occurrences in the last played week
            const recentOccurrences = result.occurrences.filter((occ) => {
                if (effectiveLastPlayedWeek) {
                    const matchesWeek = occ.weekNumber === effectiveLastPlayedWeek.weekNumber
                    const matchesSeason =
                        !effectiveLastPlayedWeek.seasonId ||
                        !occ.seasonId ||
                        occ.seasonId === effectiveLastPlayedWeek.seasonId
                    return matchesWeek && matchesSeason
                }
                return isRecent(occ.occurredOn, 7)
            })
            if (recentOccurrences.length === 0) return null

            // Get the most recent occurrence date
            const latestDate = recentOccurrences.reduce((latest: string | null, cur: AchievementOccurrence) => {
                if (!latest) return cur.occurredOn
                if (!cur.occurredOn) return latest
                return new Date(cur.occurredOn) > new Date(latest) ? cur.occurredOn : latest
            }, null)

            return { def, result, latestDate, recentCount: recentOccurrences.length }
        })
        .filter((item): item is NonNullable<typeof item> => item !== null)

    // Fallback: all earned achievements sorted by level descending
    const earnedAchievements = achievements
        .map((result) => ({
            result,
            def: ACHIEVEMENT_DEFS.find((d) => d.id === result.id),
        }))
        .filter((item): item is { result: AchievementResult; def: AchievementDef } =>
            Boolean(item.def && item.result.earned)
        )
        .sort((a, b) => b.result.level - a.result.level)
        .slice(0, 4)

    return (
        <div className="space-y-6">
            {/* User Identity Hero Banner */}
            <div className="card relative overflow-hidden p-5 sm:p-6 bg-gradient-to-r from-surface via-surface to-primary/10 border-border shadow-sm">
                {/* Ambient background glow accents */}
                <div className="absolute -right-10 -bottom-10 w-44 h-44 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute top-0 right-0 w-32 h-32 bg-radial-gradient pointer-events-none opacity-25" />

                <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                        {/* Avatar */}
                        <div className="relative shrink-0">
                            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-primary/30 via-primary/10 to-surface border border-primary/30 flex items-center justify-center shadow-lg shadow-primary/5 ring-1 ring-white/10 text-primary font-black text-xl sm:text-2xl tracking-wider select-none">
                                {getInitials(displayName)}
                            </div>
                            {playerName && (
                                <div
                                    className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 text-bg flex items-center justify-center shadow-sm border-2 border-surface"
                                    title={t('profile.overview.accountLinked')}
                                >
                                    <CheckCircleIcon size={12} weight="bold" />
                                </div>
                            )}
                        </div>

                        {/* Information */}
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2.5 flex-wrap">
                                <h2 className="text-xl sm:text-2xl font-black text-text tracking-tight truncate">
                                    {displayName}
                                </h2>
                                {user?.roles?.map((role) => {
                                    const normalized = role.toLowerCase()
                                    const isAdmin = normalized === 'admin'
                                    return (
                                        <span
                                            key={role}
                                            className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border shadow-sm ${
                                                isAdmin
                                                    ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                                                    : 'bg-primary/15 border-primary/30 text-primary'
                                            }`}
                                        >
                                            {isAdmin && <CrownIcon size={11} weight="fill" />}
                                            {role}
                                        </span>
                                    )
                                })}
                            </div>

                            <div className="flex items-center gap-3 sm:gap-4 flex-wrap text-xs text-text-muted mt-2">
                                {user?.email && (
                                    <span className="flex items-center gap-1.5 truncate">
                                        <EnvelopeIcon size={14} className="opacity-60 shrink-0" />
                                        <span className="truncate">{user.email}</span>
                                    </span>
                                )}

                                {user?.alias && playerName && user.alias !== playerName && (
                                    <span className="flex items-center gap-1 text-text-muted">
                                        <span className="opacity-60">Alias:</span>
                                        <span className="text-text font-medium">{user.alias}</span>
                                    </span>
                                )}

                                {playerName ? (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                                        <CheckCircleIcon size={12} weight="fill" />
                                        <span>{t('profile.overview.accountLinked')}</span>
                                    </span>
                                ) : (
                                    <span className="italic text-text-muted/70 flex items-center gap-1 text-[11px]">
                                        <UserCircleIcon size={13} />
                                        {t('profile.overview.accountNotLinked')}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ─── Hero Section: New Achievements This Week ────────────────── */}
            <div className="card p-5 border-amber-500/30 bg-gradient-to-br from-surface to-amber-950/10 relative overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <SparkleIcon size={20} weight="fill" className="text-amber-400 animate-pulse" />
                            <h3 className="text-base font-bold text-text">
                                {t('profile.overview.recentAchievementsTitle')}
                            </h3>
                            {recentAchievements.length > 0 && (
                                <span className="bg-amber-400/20 text-amber-400 text-xs font-semibold px-2 py-0.5 rounded-full border border-amber-400/40">
                                    +{recentAchievements.length}
                                </span>
                            )}
                            {effectiveLastPlayedWeek && (
                                <span className="bg-surface border border-border text-text-muted text-xs font-semibold px-2 py-0.5 rounded-full">
                                    {t('profile.overview.lastPlayedWeekBadge', {
                                        week: effectiveLastPlayedWeek.weekNumber,
                                    })}
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-text-muted mt-0.5">
                            {t('profile.overview.recentAchievementsSubtitle')}
                            {effectiveLastPlayedWeek?.seasonName ? ` (${effectiveLastPlayedWeek.seasonName})` : ''}
                        </p>
                    </div>

                    <button
                        onClick={() => onSelectTab('achievements')}
                        className="text-xs text-amber-400 hover:text-amber-300 font-medium flex items-center gap-1 self-start sm:self-center transition-colors"
                    >
                        {t('profile.overview.viewAllAchievements')}
                        <ArrowRightIcon size={13} />
                    </button>
                </div>

                {recentAchievements.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {recentAchievements.map(({ def, result, latestDate }) => {
                            const level = result.level
                            const idx = Math.max(0, level - 1)
                            const icon = def.levelIcons[idx]
                            const name = def.levelNames[idx]

                            return (
                                <div
                                    key={def.id}
                                    onClick={() => onOpenAchievementModal(def, result)}
                                    className="p-3.5 rounded-xl bg-surface/80 hover:bg-surface border border-amber-400/40 hover:border-amber-400 transition-all duration-200 cursor-pointer shadow-sm hover:shadow-amber-500/10 hover:shadow-md flex items-center gap-3.5 relative group"
                                >
                                    <div className="w-16 h-16 rounded-xl bg-amber-500/10 border border-amber-400/30 flex items-center justify-center shrink-0 p-1 group-hover:scale-105 transition-transform">
                                        {icon.startsWith('/') ? (
                                            <img src={icon} alt={name} className="w-full h-full object-contain" />
                                        ) : (
                                            <span className="text-3xl">{icon}</span>
                                        )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5 mb-1">
                                            <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-400 text-amber-950 px-1.5 py-0.2 rounded-full">
                                                NEW
                                            </span>
                                            <span className="text-[10px] font-semibold text-primary">
                                                Lv {level}
                                            </span>
                                        </div>
                                        <h4 className="text-sm font-bold text-text truncate group-hover:text-amber-300 transition-colors">
                                            {name}
                                        </h4>
                                        <p className="text-[11px] text-text-muted truncate mt-0.5">
                                            {t(def.descKey)}
                                        </p>
                                        {latestDate && (
                                            <p className="text-[10px] text-amber-400/80 flex items-center gap-1 mt-1">
                                                <CalendarCheckIcon size={11} />
                                                {formatRecentDate(latestDate)}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                ) : (
                    <div className="p-6 rounded-xl bg-surface/50 border border-border text-center">
                        <div className="w-12 h-12 rounded-full bg-amber-400/10 text-amber-400 flex items-center justify-center mx-auto mb-2">
                            <TrophyIcon size={24} />
                        </div>
                        <p className="text-sm font-semibold text-text">
                            {t('profile.overview.noRecentAchievements')}
                        </p>
                        <p className="text-xs text-text-muted mt-1 max-w-md mx-auto">
                            {t('profile.overview.keepPlaying')}
                        </p>

                        {earnedAchievements.length > 0 && (
                            <div className="mt-5 pt-4 border-t border-border">
                                <p className="text-xs font-semibold text-text-muted mb-3 uppercase tracking-wider">
                                    {t('profile.overview.latestEarned')}
                                </p>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                                    {earnedAchievements.map(({ def, result }) => {
                                        const idx = Math.max(0, result.level - 1)
                                        const icon = def.levelIcons[idx]
                                        const name = def.levelNames[idx]

                                        return (
                                            <div
                                                key={def.id}
                                                onClick={() => onOpenAchievementModal(def, result)}
                                                className="p-2.5 rounded-lg bg-surface border border-border hover:border-primary/50 cursor-pointer text-center transition-all group"
                                            >
                                                <div className="w-10 h-10 mx-auto mb-1.5 flex items-center justify-center group-hover:scale-110 transition-transform">
                                                    {icon.startsWith('/') ? (
                                                        <img src={icon} alt={name} className="w-full h-full object-contain" />
                                                    ) : (
                                                        <span className="text-xl">{icon}</span>
                                                    )}
                                                </div>
                                                <p className="text-xs font-semibold text-text truncate">{name}</p>
                                                <p className="text-[10px] text-primary">Lv {result.level}</p>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ─── Betting Summary Widget ─────────────────────────────────── */}
            <div className="card p-5 border-border">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                            <WalletIcon size={18} />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-text">
                                {t('profile.overview.bettingStats')}
                            </h3>
                        </div>
                    </div>

                    <button
                        onClick={() => onSelectTab('bets')}
                        className="text-xs text-primary hover:text-primary-hover font-medium flex items-center gap-1 transition-colors"
                    >
                        {t('profile.overview.viewBetsArchive')}
                        <ArrowRightIcon size={13} />
                    </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 rounded-lg bg-bg border border-border">
                        <span className="text-[11px] text-text-muted block">
                            {t('profile.overview.availableBalance')}
                        </span>
                        <span className="text-lg font-bold text-text mt-0.5 block">
                            {balance != null ? `${balance.availableBalance.toFixed(2)} €` : '—'}
                        </span>
                    </div>

                    <div className="p-3 rounded-lg bg-bg border border-border">
                        <span className="text-[11px] text-text-muted block">
                            {t('profile.overview.activeBets')}
                        </span>
                        <span className="text-lg font-bold text-primary mt-0.5 block">
                            {activeBetsCount}
                        </span>
                    </div>

                    <div className="p-3 rounded-lg bg-bg border border-border">
                        <span className="text-[11px] text-text-muted block">
                            {t('betting.balanceWonProfit')}
                        </span>
                        <span className="text-lg font-bold text-success mt-0.5 block">
                            {balance != null ? `+${balance.totalWonProfit.toFixed(2)} €` : '—'}
                        </span>
                    </div>

                    <div className="p-3 rounded-lg bg-bg border border-border">
                        <span className="text-[11px] text-text-muted block">
                            {t('betting.balanceLostStake')}
                        </span>
                        <span className="text-lg font-bold text-danger mt-0.5 block">
                            {balance != null ? `-${balance.totalLostStake.toFixed(2)} €` : '—'}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    )
}
