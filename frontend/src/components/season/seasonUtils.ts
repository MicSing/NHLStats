import { CompletionType } from '../../types/match'
import type { WeekGroup } from '../../types/stats'
import type { LeagueTypeValue } from '../../types/team'

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
    const map = new Map<number, { userId: number; userName: string; totalPlus: number; totalMinus: number; totalNeutral: number; totalGoals: number; totalPenalties: number }>()
    for (const match of group.matches) {
        for (const u of match.users ?? []) {
            const existing = map.get(u.userId)
            if (existing) {
                existing.totalPlus += u.totalPlus
                existing.totalMinus += u.totalMinus
                existing.totalNeutral += u.totalNeutral
                existing.totalGoals += u.totalGoals
                existing.totalPenalties += u.totalPenalties
            } else {
                map.set(u.userId, { ...u })
            }
        }
    }
    return Array.from(map.values())
}

// The backend creates the first 4 games of an NHL playoff series (games 5-7 are appended
// automatically while the series is undecided); an IIHF playoff round is a single game.
export function initialPlayoffGames(leagueType: LeagueTypeValue): number {
    return leagueType === 'IIHF' ? 1 : 4
}

export function getPlayoffRoundName(round: number, leagueType: LeagueTypeValue, t: (key: string, options?: Record<string, unknown>) => string): string {
    if (leagueType === 'IIHF') {
        switch (round) {
            case 1: return t('season.playoffRoundIihf1')
            case 2: return t('season.playoffRoundIihf2')
            case 3: return t('season.playoffRoundIihf3')
            default: return t('season.playoffRound', { number: round })
        }
    } else {
        switch (round) {
            case 1: return t('season.playoffRoundNhl1')
            case 2: return t('season.playoffRoundNhl2')
            case 3: return t('season.playoffRoundNhl3')
            case 4: return t('season.playoffRoundNhl4')
            default: return t('season.playoffRound', { number: round })
        }
    }
}
