export type BetStatus = 'Pending' | 'Won' | 'Lost' | 'Cancelled'
export type ApiBetType = 'TeamWin' | 'UserGoal' | 'UserPenalty'

export interface TeamWinOddsDto {
    homeTeamId: number
    homeOdds: number
    awayTeamId: number
    awayOdds: number
}

export interface UserOddsDto {
    userId: number
    userName: string | null
    odds: number
}

export interface MatchOddsDto {
    teamWin: TeamWinOddsDto | null
    userGoal: UserOddsDto[]
    userPenalty: UserOddsDto[]
    computedOn: string
}

export interface BettingBalanceDto {
    availableBalance: number
    maxWinCap: number
    totalPositiveCash: number
    totalWonProfit: number
    totalPendingStake: number
    totalLostStake: number
}

export interface BetHistoryItem {
    id: string
    matchId: number
    matchNumber: number
    homeTeamName: string | null
    awayTeamName: string | null
    betType: ApiBetType
    userId: number | null
    betTargetName: string | null
    teamId: number | null
    amount: number
    odds: number
    status: BetStatus
    wonAmount: number | null
    createdOn: string
    evaluatedOn: string | null
}
