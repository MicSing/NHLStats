import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAchievementFilters } from '../components/stats/useAchievementFilters'
import { ACHIEVEMENT_DEFS } from '../components/stats/achievementDefs'
import type { AchievementResult, AchievementHolder } from '../types/achievement'

const [defA, defB, defC] = ACHIEVEMENT_DEFS

function result(id: string, level: number): AchievementResult {
    return {
        id,
        earned: level > 0,
        level,
        count: level,
        currentLevelAt: level,
        nextLevelAt: level + 1,
        occurrences: [],
    }
}

// User 1 has A (alone) and B (shared with user 2). Nobody has C. Everything else is held by user 2.
const achievements = [result(defA.id, 1), result(defB.id, 2), result(defC.id, 0)]
const holders: AchievementHolder[] = ACHIEVEMENT_DEFS.map((d) => ({
    id: d.id,
    holderUserIds:
        d.id === defA.id ? [1]
            : d.id === defB.id ? [1, 2]
                : d.id === defC.id ? []
                    : [2],
}))

describe('useAchievementFilters – unique / nobody', () => {
    it('counts unique and nobody achievements', () => {
        const { result: hook } = renderHook(() => useAchievementFilters(achievements, holders, 1))

        expect(hook.current.hasHolders).toBe(true)
        expect(hook.current.counts.unique).toBe(1)
        expect(hook.current.counts.nobody).toBe(1)
        expect(hook.current.isUnique(defA.id)).toBe(true)
        expect(hook.current.isUnique(defB.id)).toBe(false)
    })

    it('filters to achievements only this user has', () => {
        const { result: hook } = renderHook(() => useAchievementFilters(achievements, holders, 1))

        act(() => hook.current.setFilter('unique'))

        expect(hook.current.filteredDefs.map((d) => d.id)).toEqual([defA.id])
    })

    it('filters to achievements nobody has', () => {
        const { result: hook } = renderHook(() => useAchievementFilters(achievements, holders, 1))

        act(() => hook.current.setFilter('nobody'))

        expect(hook.current.filteredDefs.map((d) => d.id)).toEqual([defC.id])
    })

    it('disables unique / nobody when holder data is missing', () => {
        const { result: hook } = renderHook(() => useAchievementFilters(achievements))

        expect(hook.current.hasHolders).toBe(false)
        expect(hook.current.counts.unique).toBe(0)
        expect(hook.current.counts.nobody).toBe(0)
    })
})
