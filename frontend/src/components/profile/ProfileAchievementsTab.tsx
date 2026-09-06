import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
    MagnifyingGlassIcon,
    LockSimpleIcon,
    FunnelIcon,
    SparkleIcon,
    XIcon,
    ArrowCounterClockwiseIcon,
    TargetIcon,
    WarningCircleIcon,
    TrendUpIcon,
    TicketIcon,
} from '@phosphor-icons/react'
import type { AchievementResult } from '../../types/achievement'
import { ACHIEVEMENT_DEFS, type AchievementDef, type AchievementCategory } from '../stats/achievementDefs'

interface ProfileAchievementsTabProps {
    achievements: AchievementResult[]
    onOpenAchievementModal: (def: AchievementDef, result: AchievementResult) => void
}

type FilterMode = 'all' | 'earned' | 'recent' | 'locked'

function isRecent(date: string | null, days = 7): boolean {
    if (!date) return false
    return new Date(date) >= new Date(Date.now() - days * 86_400_000)
}

export default function ProfileAchievementsTab({
    achievements,
    onOpenAchievementModal,
}: ProfileAchievementsTabProps) {
    const { t } = useTranslation()
    const [search, setSearch] = useState('')
    const [filter, setFilter] = useState<FilterMode>('all')
    const [category, setCategory] = useState<'all' | AchievementCategory>('all')
    const [minLevel, setMinLevel] = useState<number>(0)
    const [filterModalOpen, setFilterModalOpen] = useState(false)

    const achievementMap = useMemo(() => {
        const map = new Map<string, AchievementResult>()
        for (const a of achievements) {
            map.set(a.id, a)
        }
        return map
    }, [achievements])

    const filteredDefs = useMemo(() => {
        return ACHIEVEMENT_DEFS.filter((def) => {
            const result = achievementMap.get(def.id)
            const level = result?.level ?? 0
            const earned = level > 0
            const hasRecent = result?.occurrences.some((occ) => isRecent(occ.occurredOn)) ?? false

            // Category check
            if (category !== 'all' && def.category !== category) return false

            // Min level check
            if (minLevel > 0 && level < minLevel) return false

            // Filter mode check
            if (filter === 'earned' && !earned) return false
            if (filter === 'locked' && earned) return false
            if (filter === 'recent' && !hasRecent) return false

            // Search check
            if (search.trim()) {
                const q = search.toLowerCase()
                const desc = t(def.descKey).toLowerCase()
                const names = def.levelNames.map((n) => n.toLowerCase())
                const matchesName = names.some((n) => n.includes(q))
                const matchesDesc = desc.includes(q)
                if (!matchesName && !matchesDesc) return false
            }

            return true
        })
    }, [achievementMap, filter, category, minLevel, search, t])

    const counts = useMemo(() => {
        let earned = 0
        let recent = 0
        let locked = 0

        for (const def of ACHIEVEMENT_DEFS) {
            const res = achievementMap.get(def.id)
            if (res && res.level > 0) {
                earned++
                if (res.occurrences.some((occ) => isRecent(occ.occurredOn))) {
                    recent++
                }
            } else {
                locked++
            }
        }

        return { all: ACHIEVEMENT_DEFS.length, earned, recent, locked }
    }, [achievementMap])

    const categoryCounts = useMemo(() => {
        const cats: Record<AchievementCategory, number> = {
            goals: 0,
            penalties: 0,
            points: 0,
            bets: 0,
        }
        for (const def of ACHIEVEMENT_DEFS) {
            if (def.category) {
                cats[def.category] = (cats[def.category] || 0) + 1
            }
        }
        return cats
    }, [])

    const clearAllFilters = () => {
        setCategory('all')
        setFilter('all')
        setMinLevel(0)
        setSearch('')
    }

    const activeFilters = useMemo(() => {
        const list: { key: string; label: string; onRemove: () => void }[] = []
        if (category !== 'all') {
            list.push({
                key: 'category',
                label: `${t('profile.achievements.categoryLabel')}: ${t(`profile.achievements.categories.${category}`)}`,
                onRemove: () => setCategory('all'),
            })
        }
        if (filter !== 'all') {
            const statusLabel =
                filter === 'earned'
                    ? t('profile.achievements.filterEarned')
                    : filter === 'locked'
                        ? t('profile.achievements.filterLocked')
                        : t('profile.achievements.filterRecent')
            list.push({
                key: 'status',
                label: `${t('profile.achievements.statusLabel')}: ${statusLabel}`,
                onRemove: () => setFilter('all'),
            })
        }
        if (minLevel > 0) {
            list.push({
                key: 'minLevel',
                label: `Lv ≥ ${minLevel}`,
                onRemove: () => setMinLevel(0),
            })
        }
        return list
    }, [category, filter, minLevel, t])

    return (
        <div className="space-y-6">
            {/* Header controls: search and filter pills */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-md">
                    <MagnifyingGlassIcon
                        size={16}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
                    />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={t('profile.achievements.searchPlaceholder')}
                        className="input pl-9 text-xs sm:text-sm"
                    />
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
                    {/* Interactive Filter button */}
                    <button
                        type="button"
                        onClick={() => setFilterModalOpen(true)}
                        className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all shrink-0 ${
                            activeFilters.length > 0
                                ? 'bg-primary/10 border-primary text-primary shadow-sm'
                                : 'bg-surface border-border text-text hover:bg-border'
                        }`}
                        title={t('profile.achievements.filters')}
                    >
                        <FunnelIcon size={14} weight={activeFilters.length > 0 ? 'fill' : 'regular'} />
                        <span>{t('profile.achievements.filters')}</span>
                        {activeFilters.length > 0 && (
                            <span className="w-4 h-4 rounded-full bg-primary text-white text-[10px] flex items-center justify-center font-bold">
                                {activeFilters.length}
                            </span>
                        )}
                    </button>

                    <button
                        type="button"
                        onClick={() => setFilter('all')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                            filter === 'all'
                                ? 'bg-primary text-white'
                                : 'bg-surface border border-border text-text-muted hover:text-text'
                        }`}
                    >
                        {t('profile.achievements.filterAll')} ({counts.all})
                    </button>
                    <button
                        type="button"
                        onClick={() => setFilter('earned')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                            filter === 'earned'
                                ? 'bg-primary text-white'
                                : 'bg-surface border border-border text-text-muted hover:text-text'
                        }`}
                    >
                        {t('profile.achievements.filterEarned')} ({counts.earned})
                    </button>
                    <button
                        type="button"
                        onClick={() => setFilter('recent')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1 ${
                            filter === 'recent'
                                ? 'bg-amber-400 text-amber-950 font-bold'
                                : 'bg-surface border border-border text-amber-400 hover:text-amber-300'
                        }`}
                    >
                        <SparkleIcon size={12} weight="fill" />
                        {t('profile.achievements.filterRecent')} ({counts.recent})
                    </button>
                    <button
                        type="button"
                        onClick={() => setFilter('locked')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                            filter === 'locked'
                                ? 'bg-primary text-white'
                                : 'bg-surface border border-border text-text-muted hover:text-text'
                        }`}
                    >
                        {t('profile.achievements.filterLocked')} ({counts.locked})
                    </button>
                </div>
            </div>

            {/* Active filter chips */}
            {activeFilters.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-lg bg-surface/50 border border-border text-xs">
                    <span className="text-[11px] text-text-muted font-medium mr-1">
                        {t('profile.achievements.filters')}:
                    </span>
                    {activeFilters.map((f) => (
                        <span
                            key={f.key}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium text-[11px]"
                        >
                            {f.label}
                            <button
                                type="button"
                                onClick={f.onRemove}
                                className="hover:text-danger ml-0.5 rounded-full"
                                aria-label={`Remove ${f.label}`}
                            >
                                ×
                            </button>
                        </span>
                    ))}
                    <button
                        type="button"
                        onClick={clearAllFilters}
                        className="text-[11px] text-text-muted hover:text-danger ml-auto flex items-center gap-1 font-medium transition-colors"
                    >
                        <ArrowCounterClockwiseIcon size={12} />
                        {t('profile.achievements.clearAll')}
                    </button>
                </div>
            )}

            {/* Filter Modal */}
            {filterModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div
                        className="card max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl border-border bg-surface overflow-hidden"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="achievements-filter-modal-title"
                    >
                        {/* Header */}
                        <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                                    <FunnelIcon size={18} weight="fill" />
                                </div>
                                <div>
                                    <h3 id="achievements-filter-modal-title" className="font-bold text-base text-text">
                                        {t('profile.achievements.filterModalTitle')}
                                    </h3>
                                    <p className="text-xs text-text-muted">
                                        {filteredDefs.length} / {ACHIEVEMENT_DEFS.length}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setFilterModalOpen(false)}
                                className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-border transition-colors"
                                aria-label="Close"
                            >
                                <XIcon size={20} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-4 sm:p-5 overflow-y-auto space-y-5 flex-1">
                            {/* Category Filter */}
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
                                    {t('profile.achievements.categoryLabel')}
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setCategory('all')}
                                        className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition-all ${
                                            category === 'all'
                                                ? 'border-primary bg-primary/10 text-primary font-semibold'
                                                : 'border-border bg-surface hover:bg-border text-text'
                                        }`}
                                    >
                                        <span className="text-xs">{t('profile.achievements.categories.all')}</span>
                                        <span className="text-[11px] opacity-70">({ACHIEVEMENT_DEFS.length})</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setCategory('goals')}
                                        className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition-all ${
                                            category === 'goals'
                                                ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400 font-semibold'
                                                : 'border-border bg-surface hover:bg-border text-text'
                                        }`}
                                    >
                                        <div className="flex items-center gap-1.5">
                                            <TargetIcon size={14} />
                                            <span className="text-xs">{t('profile.achievements.categories.goals')}</span>
                                        </div>
                                        <span className="text-[11px] opacity-70">({categoryCounts.goals})</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setCategory('penalties')}
                                        className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition-all ${
                                            category === 'penalties'
                                                ? 'border-danger bg-danger/10 text-danger font-semibold'
                                                : 'border-border bg-surface hover:bg-border text-text'
                                        }`}
                                    >
                                        <div className="flex items-center gap-1.5">
                                            <WarningCircleIcon size={14} />
                                            <span className="text-xs">{t('profile.achievements.categories.penalties')}</span>
                                        </div>
                                        <span className="text-[11px] opacity-70">({categoryCounts.penalties})</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setCategory('points')}
                                        className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition-all ${
                                            category === 'points'
                                                ? 'border-amber-400 bg-amber-400/10 text-amber-400 font-semibold'
                                                : 'border-border bg-surface hover:bg-border text-text'
                                        }`}
                                    >
                                        <div className="flex items-center gap-1.5">
                                            <TrendUpIcon size={14} />
                                            <span className="text-xs">{t('profile.achievements.categories.points')}</span>
                                        </div>
                                        <span className="text-[11px] opacity-70">({categoryCounts.points})</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setCategory('bets')}
                                        className={`p-2.5 rounded-xl border text-left flex items-center justify-between col-span-2 transition-all ${
                                            category === 'bets'
                                                ? 'border-primary bg-primary/10 text-primary font-semibold'
                                                : 'border-border bg-surface hover:bg-border text-text'
                                        }`}
                                    >
                                        <div className="flex items-center gap-1.5">
                                            <TicketIcon size={14} />
                                            <span className="text-xs">{t('profile.achievements.categories.bets')}</span>
                                        </div>
                                        <span className="text-[11px] opacity-70">({categoryCounts.bets})</span>
                                    </button>
                                </div>
                            </div>

                            {/* Status Filter */}
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
                                    {t('profile.achievements.statusLabel')}
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    {(
                                        [
                                            { key: 'all' as FilterMode, label: t('profile.achievements.filterAll'), count: counts.all },
                                            { key: 'earned' as FilterMode, label: t('profile.achievements.filterEarned'), count: counts.earned },
                                            { key: 'locked' as FilterMode, label: t('profile.achievements.filterLocked'), count: counts.locked },
                                            { key: 'recent' as FilterMode, label: t('profile.achievements.filterRecent'), count: counts.recent },
                                        ]
                                    ).map((s) => (
                                        <button
                                            key={s.key}
                                            type="button"
                                            onClick={() => setFilter(s.key)}
                                            className={`p-2 rounded-xl border text-xs font-medium text-left flex items-center justify-between transition-all ${
                                                filter === s.key
                                                    ? 'border-primary bg-primary/10 text-primary font-semibold'
                                                    : 'border-border bg-surface hover:bg-border text-text'
                                            }`}
                                        >
                                            <span>{s.label}</span>
                                            <span className="text-[11px] opacity-70">({s.count})</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Minimum Level Filter */}
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
                                    {t('profile.achievements.levelLabel')}
                                </label>
                                <div className="flex flex-wrap gap-1.5">
                                    <button
                                        type="button"
                                        onClick={() => setMinLevel(0)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                            minLevel === 0
                                                ? 'bg-primary text-white'
                                                : 'bg-surface border border-border text-text-muted hover:text-text'
                                        }`}
                                    >
                                        {t('profile.achievements.anyLevel')}
                                    </button>
                                    {[1, 2, 3, 4, 5, 6, 7].map((lvl) => (
                                        <button
                                            key={lvl}
                                            type="button"
                                            onClick={() => setMinLevel(lvl)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                                minLevel === lvl
                                                    ? 'bg-primary text-white'
                                                    : 'bg-surface border border-border text-text-muted hover:text-text'
                                            }`}
                                        >
                                            Lv ≥ {lvl}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-border bg-surface/80 flex items-center justify-between gap-3">
                            <button
                                type="button"
                                onClick={clearAllFilters}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium text-text-muted hover:text-danger hover:bg-border transition-colors flex items-center gap-1.5"
                            >
                                <ArrowCounterClockwiseIcon size={14} />
                                {t('profile.achievements.resetFilters')}
                            </button>
                            <button
                                type="button"
                                onClick={() => setFilterModalOpen(false)}
                                className="btn btn-primary text-xs px-5 py-2 font-semibold"
                            >
                                {t('profile.achievements.applyFilters')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Achievement Grid */}
            {filteredDefs.length === 0 ? (
                <div className="card p-8 text-center">
                    <p className="text-text-muted text-sm">{t('profile.achievements.noMatches')}</p>
                    {activeFilters.length > 0 && (
                        <button
                            type="button"
                            onClick={clearAllFilters}
                            className="mt-3 text-xs text-primary hover:underline font-medium"
                        >
                            {t('profile.achievements.clearAll')}
                        </button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                    {filteredDefs.map((def) => {
                        const result = achievementMap.get(def.id)
                        const level = result?.level ?? 0
                        const earned = level > 0
                        const idx = Math.max(0, level - 1)
                        const icon = !earned && def.disabledIcon ? def.disabledIcon : def.levelIcons[idx]
                        const name = def.levelNames[idx]
                        const hasRecent = result?.occurrences.some((occ) => isRecent(occ.occurredOn)) ?? false

                        return (
                            <button
                                key={def.id}
                                onClick={() => {
                                    if (result) onOpenAchievementModal(def, result)
                                    else {
                                        // Empty result placeholder for locked badges
                                        onOpenAchievementModal(def, {
                                            id: def.id,
                                            earned: false,
                                            level: 0,
                                            count: 0,
                                            currentLevelAt: 0,
                                            nextLevelAt: 1,
                                            occurrences: [],
                                        })
                                    }
                                }}
                                className={[
                                    'rounded-xl p-3 border flex flex-col items-center gap-2 text-center relative w-full transition-all duration-200 cursor-pointer',
                                    earned
                                        ? 'bg-surface border-border hover:border-primary/60 hover:scale-[1.02] shadow-sm'
                                        : 'bg-surface/50 border-border/60 opacity-40 grayscale hover:opacity-60',
                                    hasRecent
                                        ? 'ring-2 ring-amber-400/80 shadow-amber-400/20 shadow-md !opacity-100 !grayscale-0'
                                        : '',
                                ].join(' ')}
                            >
                                {!earned && (
                                    <LockSimpleIcon
                                        size={14}
                                        weight="bold"
                                        className="absolute top-2 right-2 text-text-muted"
                                    />
                                )}
                                {hasRecent && (
                                    <span className="absolute top-2 left-2 text-[9px] bg-amber-400 text-amber-950 font-bold rounded-full px-1.5 py-0.2">
                                        NEW
                                    </span>
                                )}
                                {earned && (
                                    <span className="absolute top-2 right-2 text-[10px] bg-primary/20 text-primary rounded-full px-1.5 py-0.5 font-medium">
                                        Lv {level}
                                    </span>
                                )}

                                <div className="w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center my-1">
                                    {icon.startsWith('/') ? (
                                        <img
                                            src={icon}
                                            alt={name}
                                            className="w-full h-full object-contain drop-shadow-sm"
                                        />
                                    ) : (
                                        <span className="text-4xl leading-none">{icon}</span>
                                    )}
                                </div>

                                <div className="w-full min-w-0">
                                    <p className="text-xs font-semibold text-text truncate">{name}</p>
                                    <p className="text-[10px] text-text-muted truncate mt-0.5">
                                        {t(def.descKey)}
                                    </p>
                                </div>
                            </button>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
