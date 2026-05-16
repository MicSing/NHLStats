import type { SeasonMatchHistory } from '../../types/stats'
import type { MatchWithContext, WeekSummary } from './statsTypes'

export function flattenMatches(data: SeasonMatchHistory[]): MatchWithContext[] {
    return data.flatMap((s) =>
        s.weeks.flatMap((w) =>
            w.matches.map((m) => ({
                ...m,
                seasonId: s.seasonId,
                seasonName: s.seasonName,
                weekNumber: w.weekNumber,
            })),
        ),
    )
}

export function flattenWeeks(data: SeasonMatchHistory[]): WeekSummary[] {
    return data.flatMap((s) =>
        s.weeks.map((w) => ({
            seasonId: s.seasonId,
            seasonName: s.seasonName,
            weekNumber: w.weekNumber,
            matchDates: [...new Set(w.matches.map((m) => m.matchDate.slice(0, 10)))].sort(),
            matchCount: w.matches.length,
            totalPlus: w.totalPlus,
            totalMinus: w.totalMinus,
            goalCount: w.goalCount,
            penaltyCount: w.penaltyCount,
            opponents: w.matches.map((m) => ({ name: m.opponentName, shortName: m.opponentShortName })),
        })),
    )
}
