export type BetSelection = 'home' | 'away'
export type BetOutcome = 'pending' | 'won' | 'lost'
export type BetType = 'teamWin' | 'userGoal' | 'userPenalty'

export interface UserBet {
    id: string
    userId: number
    seasonId: number
    seasonName: string
    matchId: number
    matchNumber: number
    homeTeamId: number
    homeTeamName: string
    awayTeamId: number
    awayTeamName: string
    matchDate: string | null
    selection: BetSelection
    selectedTeamId: number
    selectedTeamName: string
    stake: number
    placedAt: string
}

export interface UpsertUserBetInput {
    userId: number
    seasonId: number
    seasonName: string
    matchId: number
    matchNumber: number
    homeTeamId: number
    homeTeamName: string
    awayTeamId: number
    awayTeamName: string
    matchDate: string | null
    selection: BetSelection
    stake: number
}

export interface BetWithOutcome {
    bet: UserBet
    outcome: BetOutcome
}

// Simplified single-choice betting system
export interface MatchBet {
    id: string
    userId: number
    matchId: number
    betType: BetType
    // For teamWin bets
    teamSelection?: BetSelection
    // For userGoal or userPenalty bets
    betOnUserId?: number
    betOnUserName?: string
    placedAt: string
}
