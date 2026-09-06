import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
    MagnifyingGlassIcon,
    LockSimpleIcon,
    FunnelIcon,
    SparkleIcon,
} from '@phosphor-icons/react'
import type { AchievementResult } from '../../types/achievement'
import { ACHIEVEMENT_DEFS, type AchievementDef } from '../stats/achievementDefs'

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
    }, [achievementMap, filter, search, t])

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
                    <div className="p-1.5 rounded-lg bg-surface border border-border text-text-muted mr-1 shrink-0">
                        <FunnelIcon size={14} />
                    </div>
                    <button
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

            {/* Achievement Grid */}
            {filteredDefs.length === 0 ? (
                <div className="card p-8 text-center">
                    <p className="text-text-muted text-sm">{t('profile.achievements.noMatches')}</p>
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
