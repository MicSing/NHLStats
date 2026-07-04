import type { TeamStatsMatch } from '../types/teamStats'

export type MatchResult = 'W' | 'L' | 'OTL' | 'T'

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
            const result: MatchResult = goalsFor > goalsAgainst
                ? 'W'
                : goalsFor === goalsAgainst
                ? 'T'
                : m.completionType !== 'RegularTime' ? 'OTL' : 'L'
            return { ...m, goalsFor, goalsAgainst, result }
        })
}

export function tallyRecord(results: MatchWithResult[]): { wins: number; losses: number; otLosses: number; ties: number } {
    return results.reduce(
        (acc, r) => {
            if (r.result === 'W') acc.wins += 1
            else if (r.result === 'OTL') acc.otLosses += 1
            else if (r.result === 'T') acc.ties += 1
            else acc.losses += 1
            return acc
        },
        { wins: 0, losses: 0, otLosses: 0, ties: 0 },
    )
}
