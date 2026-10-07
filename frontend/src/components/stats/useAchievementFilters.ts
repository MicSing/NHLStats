import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { AchievementResult, AchievementHolder } from '../../types/achievement'
import { ACHIEVEMENT_DEFS, type AchievementDef, type AchievementCategory } from './achievementDefs'

export type AchievementFilterMode = 'all' | 'earned' | 'recent' | 'locked' | 'unique' | 'nobody'

export interface ActiveFilterChip {
    key: string
    label: string
    onRemove: () => void
}

export interface UseAchievementFiltersResult {
    search: string
    setSearch: (v: string) => void
    filter: AchievementFilterMode
    setFilter: (v: AchievementFilterMode) => void
    category: 'all' | AchievementCategory
    setCategory: (v: 'all' | AchievementCategory) => void
    minLevel: number
    setMinLevel: (v: number) => void
    filterModalOpen: boolean
    setFilterModalOpen: (v: boolean) => void
    achievementMap: Map<string, AchievementResult>
    filteredDefs: AchievementDef[]
    counts: { all: number; earned: number; recent: number; locked: number; unique: number; nobody: number }
    /** Whether global holder data is available (enables unique / nobody filters). */
    hasHolders: boolean
    /** Returns true if only the viewed user has earned the achievement. */
    isUnique: (id: string) => boolean
    categoryCounts: Record<AchievementCategory, number>
    activeFilters: ActiveFilterChip[]
    clearAllFilters: () => void
}

export function isRecent(date: string | null, days = 7): boolean {
    if (!date) return false
    return new Date(date) >= new Date(Date.now() - days * 86_400_000)
}

export function useAchievementFilters(
    achievements: AchievementResult[],
    holders?: AchievementHolder[] | null,
    userId?: number | null,
): UseAchievementFiltersResult {
    const { t } = useTranslation()
    const [search, setSearch] = useState('')
    const [filter, setFilter] = useState<AchievementFilterMode>('all')
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

    const holderMap = useMemo(() => {
        const map = new Map<string, number[]>()
        for (const h of holders ?? []) {
            map.set(h.id, h.holderUserIds)
        }
        return map
    }, [holders])

    const hasHolders = holders != null && userId != null

    const isUnique = useCallback(
        (id: string): boolean => {
            if (!hasHolders) return false
            const ids = holderMap.get(id) ?? []
            return ids.length === 1 && ids[0] === userId && (achievementMap.get(id)?.level ?? 0) > 0
        },
        [hasHolders, holderMap, achievementMap, userId],
    )

    const isNobody = useCallback(
        (id: string): boolean => hasHolders && (holderMap.get(id)?.length ?? 0) === 0,
        [hasHolders, holderMap],
    )

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
            if (filter === 'unique' && !isUnique(def.id)) return false
            if (filter === 'nobody' && !isNobody(def.id)) return false

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
    }, [achievementMap, filter, category, minLevel, search, t, isUnique, isNobody])

    const counts = useMemo(() => {
        let earned = 0
        let recent = 0
        let locked = 0
        let unique = 0
        let nobody = 0

        for (const def of ACHIEVEMENT_DEFS) {
            if (isUnique(def.id)) unique++
            if (isNobody(def.id)) nobody++
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

        return { all: ACHIEVEMENT_DEFS.length, earned, recent, locked, unique, nobody }
    }, [achievementMap, isUnique, isNobody])

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
        const list: ActiveFilterChip[] = []
        if (category !== 'all') {
            list.push({
                key: 'category',
                label: `${t('profile.achievements.categoryLabel')}: ${t(`profile.achievements.categories.${category}`)}`,
                onRemove: () => setCategory('all'),
            })
        }
        if (filter !== 'all') {
            const statusLabels: Record<Exclude<AchievementFilterMode, 'all'>, string> = {
                earned: t('profile.achievements.filterEarned'),
                locked: t('profile.achievements.filterLocked'),
                recent: t('profile.achievements.filterRecent'),
                unique: t('profile.achievements.filterUnique'),
                nobody: t('profile.achievements.filterNobody'),
            }
            const statusLabel = statusLabels[filter]
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

    return {
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
        achievementMap,
        filteredDefs,
        counts,
        hasHolders,
        isUnique,
        categoryCounts,
        activeFilters,
        clearAllFilters,
    }
}
