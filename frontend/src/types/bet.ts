export type BetStatus = 'Pending' | 'Won' | 'Lost' | 'Cancelled'
export type LegStatus = BetStatus
export type ApiBetType = 'TeamWin' | 'UserGoal' | 'UserPenalty' | 'TeamWinOrDraw' | 'UserPlusPoint' | 'UserMinusPoint' | 'TeamDraw'

export interface TeamWinOddsDto {
    homeTeamId: number
    homeOdds: number
    awayTeamId: number
    awayOdds: number
    drawOdds: number | null
    home1XOdds: number | null
    away1XOdds: number | null
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
    userPlusPoint: UserOddsDto[]
    userMinusPoint: UserOddsDto[]
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

export interface BetLegDto {
    id: number
    matchId: number
    matchNumber: number
    homeTeamName: string | null
    awayTeamName: string | null
    betType: ApiBetType
    userId: number | null
    teamId: number | null
    targetName: string | null
    odds: number
    status: LegStatus
    evaluatedOn: string | null
    isAnonymized?: boolean
}

export interface BetDto {
    id: string
    shortId: string
    createdBy: string
    createdByName: string
    stake: number
    totalOdds: number
    status: BetStatus
    wonAmount: number | null
    createdOn: string
    updatedOn: string | null
    evaluatedOn: string | null
    legs: BetLegDto[]
}

export interface CreateBetLegDto {
    matchId: number
    betType: ApiBetType
    userId?: number | null
    teamId?: number | null
}

export interface CreateBetDto {
    stake: number
    legs: CreateBetLegDto[]
}
