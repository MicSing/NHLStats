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
}

export interface AllTimeEarnings {
    userEarnings: UserEarnings[]
    totalCollected: number
    totalExpenses: number
    balance: number
}
