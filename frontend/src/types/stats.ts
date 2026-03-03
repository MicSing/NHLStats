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
    awayTeamId: number
    awayTeamName: string | null
    homeScore: number
    awayScore: number
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
