import { useTranslation } from 'react-i18next'
import {
    MagnifyingGlassIcon,
    FunnelIcon,
    SparkleIcon,
    XIcon,
    ArrowCounterClockwiseIcon,
    TargetIcon,
    WarningCircleIcon,
    TrendUpIcon,
    TicketIcon,
} from '@phosphor-icons/react'
import { ACHIEVEMENT_DEFS } from './achievementDefs'
import type { AchievementFilterMode, UseAchievementFiltersResult } from './useAchievementFilters'

type AchievementFilterBarProps = UseAchievementFiltersResult

export default function AchievementFilterBar({
    search,
    setSearch,
    filter,
    setFilter,
    category,
    setCategory,
    minLevel,
    setMinLevel,
    filterModalOpen,
    setFilterModalOpen,
    filteredDefs,
    counts,
    categoryCounts,
    activeFilters,
    clearAllFilters,
}: AchievementFilterBarProps) {
    const { t } = useTranslation()

    return (
        <>
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
                                            { key: 'all' as AchievementFilterMode, label: t('profile.achievements.filterAll'), count: counts.all },
                                            { key: 'earned' as AchievementFilterMode, label: t('profile.achievements.filterEarned'), count: counts.earned },
                                            { key: 'locked' as AchievementFilterMode, label: t('profile.achievements.filterLocked'), count: counts.locked },
                                            { key: 'recent' as AchievementFilterMode, label: t('profile.achievements.filterRecent'), count: counts.recent },
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
        </>
    )
}
