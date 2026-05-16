import type { MatchHistoryItem } from '../../types/stats'

export interface MatchWithContext extends MatchHistoryItem {
    seasonId: number
    seasonName: string
    weekNumber: number
}

export interface WeekSummary {
    seasonId: number
    seasonName: string
    weekNumber: number
    matchDates: string[]
    matchCount: number
    totalPlus: number
    totalMinus: number
    goalCount: number
    penaltyCount: number
    opponents: { name: string; shortName: string }[]
}
