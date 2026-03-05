export interface UserSeasonStats {
    userId: number
    userName: string
    totalPlus: number
    totalMinus: number
    earnings: number
}

export interface TopRosterPlayer {
    rosterPlayerId: number
    firstName: string
    surname: string
    teamShortName: string | null
    count: number
}

export interface UserGoalCount {
    userId: number
    userName: string
    count: number
}

export interface RosterScorerByUser {
    rosterPlayerId: number
    firstName: string
    surname: string
    teamShortName: string | null
    totalCount: number
    userCounts: UserGoalCount[]
}

export interface UserPenaltyCount {
    userId: number
    userName: string
    count: number
}

export interface RosterPenalizedByUser {
    rosterPlayerId: number
    firstName: string
    surname: string
    teamShortName: string | null
    totalCount: number
    userCounts: UserPenaltyCount[]
}

export interface WeeklyMatch {
    matchId: number
    weekNumber: number
    matchDate: string
    homeTeamId: number
    homeTeamName: string | null
    homeTeamShortName: string | null
    awayTeamId: number
    awayTeamName: string | null
    awayTeamShortName: string | null
    homeScore: number
    awayScore: number
    completionType: number
}

export interface WeekGroup {
    weekNumber: number
    matches: WeeklyMatch[]
}

export interface UserEarnings {
    userId: number
    userName: string
    totalPlus: number
    totalMinus: number
    totalEarnings: number
    totalPaid: number
    remainingBalance: number
}

export interface AllTimeEarnings {
    userEarnings: UserEarnings[]
    totalCollected: number
    canBeCollected: number
    totalExpenses: number
    balance: number
}

export interface UserSeasonTotals {
    userId: number
    userName: string
    totalGoals: number
    totalPenalties: number
}

// Plus/minus trend per period (season or week)

export interface UserPeriodPlusMinus {
    userId: number
    userName: string
    totalPlus: number
    totalMinus: number
}

export interface PeriodPlusMinus {
    label: string
    users: UserPeriodPlusMinus[]
}

// --- Phase 6: User Stats types ---

export interface PointReasonBreakdownItem {
    pointReasonId: number
    pointReasonName: string
    isPositive: boolean
    totalCount: number
}

export interface UserPointReasonBreakdown {
    userId: number
    userName: string
    items: PointReasonBreakdownItem[]
}

export interface HeadToHeadUserResult {
    userId: number
    userName: string
    totalPlus: number
    totalMinus: number
}

export interface HeadToHeadMatch {
    matchId: number
    seasonId: number
    seasonName: string
    matchDate: string
    homeTeamName: string
    homeTeamShortName: string
    awayTeamName: string
    awayTeamShortName: string
    homeScore: number
    awayScore: number
    completionType: number
    userResults: HeadToHeadUserResult[]
}

export interface UserMatchSummary {
    matchId: number
    matchDate: string
    opponentName: string
    opponentShortName: string
    homeScore: number
    awayScore: number
    isHome: boolean
    totalPlus: number
    totalMinus: number
    goalCount: number
    penaltyCount: number
}
