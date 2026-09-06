import { useTranslation } from 'react-i18next'
import {
    SparkleIcon,
    TrophyIcon,
    WalletIcon,
    ArrowRightIcon,
    UserCircleIcon,
    CalendarCheckIcon,
} from '@phosphor-icons/react'
import type { User } from '../../types/auth'
import type { AchievementResult, AchievementOccurrence } from '../../types/achievement'
import type { BettingBalanceDto } from '../../types/bet'
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

    // Find achievements earned or leveled up in the last 7 days
    const recentAchievements = achievements
        .map((result) => {
            const def = ACHIEVEMENT_DEFS.find((d) => d.id === result.id)
            if (!def || !result.earned) return null

            // Find occurrences in the last 7 days
            const recentOccurrences = result.occurrences.filter((occ) => isRecent(occ.occurredOn, 7))
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
            {/* Quick user highlight bar */}
            <div className="card p-5 bg-gradient-to-r from-surface via-surface to-primary/10 border-border">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                        <div className="w-12 h-12 rounded-xl bg-primary/20 text-primary flex items-center justify-center font-bold text-lg border border-primary/30 shrink-0">
                            {user?.alias ? user.alias.slice(0, 2).toUpperCase() : user?.email?.slice(0, 2).toUpperCase() ?? 'U'}
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-lg font-bold text-text">
                                    {user?.alias || user?.email || t('common.user')}
                                </h2>
                                {user?.roles?.map((role) => (
                                    <span
                                        key={role}
                                        className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30"
                                    >
                                        {role}
                                    </span>
                                ))}
                            </div>
                            <p className="text-xs text-text-muted mt-0.5 flex items-center gap-1.5">
                                <UserCircleIcon size={14} className="text-text-muted" />
                                {playerName ? (
                                    <span className="text-primary font-medium">{playerName}</span>
                                ) : (
                                    <span className="italic">{t('profile.overview.accountNotLinked')}</span>
                                )}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => onSelectTab('settings')}
                            className="btn-ghost text-xs border border-border"
                        >
                            {t('profile.tabs.settings')}
                        </button>
                    </div>
                </div>
            </div>

            {/* ─── Hero Section: New Achievements This Week ────────────────── */}
            <div className="card p-5 border-amber-500/30 bg-gradient-to-br from-surface to-amber-950/10 relative overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <SparkleIcon size={20} weight="fill" className="text-amber-400 animate-pulse" />
                            <h3 className="text-base font-bold text-text">
                                {t('profile.overview.recentAchievementsTitle')}
                            </h3>
                            {recentAchievements.length > 0 && (
                                <span className="bg-amber-400/20 text-amber-400 text-xs font-semibold px-2 py-0.5 rounded-full border border-amber-400/40">
                                    +{recentAchievements.length}
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-text-muted mt-0.5">
                            {t('profile.overview.recentAchievementsSubtitle')}
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
