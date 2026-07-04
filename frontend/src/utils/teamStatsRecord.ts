import type { TeamStatsMatch } from '../types/teamStats'

export type MatchResult = 'W' | 'OTW' | 'L' | 'OTL'

export interface MatchWithResult extends TeamStatsMatch {
    goalsFor: number
    goalsAgainst: number
    result: MatchResult
}

export function deriveMatchResults(matches: TeamStatsMatch[]): MatchWithResult[] {
    return [...matches]
        .sort((a, b) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime())
        .map((m) => {
            const goalsFor = m.isHome ? m.homeScore : m.awayScore
            const goalsAgainst = m.isHome ? m.awayScore : m.homeScore
            const decidedInRegulation = m.completionType === 'RegularTime'
            const result: MatchResult = goalsFor > goalsAgainst
                ? (decidedInRegulation ? 'W' : 'OTW')
                : (decidedInRegulation ? 'L' : 'OTL')
            return { ...m, goalsFor, goalsAgainst, result }
        })
}

export function tallyRecord(results: MatchWithResult[]): { wins: number; otWins: number; losses: number; otLosses: number } {
    return results.reduce(
        (acc, r) => {
            if (r.result === 'W') acc.wins += 1
            else if (r.result === 'OTW') acc.otWins += 1
            else if (r.result === 'OTL') acc.otLosses += 1
            else acc.losses += 1
            return acc
        },
        { wins: 0, otWins: 0, losses: 0, otLosses: 0 },
    )
}
