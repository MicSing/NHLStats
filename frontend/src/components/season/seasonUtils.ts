import { CompletionType } from '../../types/match'
import type { WeekGroup } from '../../types/stats'

export function normalizeCompletionType(value: CompletionType | string | number | null | undefined): CompletionType {
    if (value === null || value === undefined) return CompletionType.None
    if (typeof value === 'number') {
        const completionValues: CompletionType[] = [
            CompletionType.None,
            CompletionType.RegularTime,
            CompletionType.Overtime,
            CompletionType.Shootout,
            CompletionType.InProgress,
        ]
        return completionValues.includes(value as CompletionType) ? (value as CompletionType) : CompletionType.None
    }

    switch (value.toLowerCase()) {
        case 'reg':
        case 'regular':
        case 'regulartime':
            return CompletionType.RegularTime
        case 'ot':
        case 'overtime':
            return CompletionType.Overtime
        case 'so':
        case 'shootout':
            return CompletionType.Shootout
        case 'inprogress':
        case 'in_progress':
        case 'live':
            return CompletionType.InProgress
        case 'none':
            return CompletionType.None
        default:
            return CompletionType.None
    }
}

export function aggregateWeekUsers(group: WeekGroup) {
    const map = new Map<number, { userId: number; userName: string; totalPlus: number; totalMinus: number; totalGoals: number; totalPenalties: number }>()
    for (const match of group.matches) {
        for (const u of match.users ?? []) {
            const existing = map.get(u.userId)
            if (existing) {
                existing.totalPlus += u.totalPlus
                existing.totalMinus += u.totalMinus
                existing.totalGoals += u.totalGoals
                existing.totalPenalties += u.totalPenalties
            } else {
                map.set(u.userId, { ...u })
            }
        }
    }
    return Array.from(map.values())
}
