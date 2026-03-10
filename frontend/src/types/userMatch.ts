import type { PointType } from './pointReason'

export type GoalType = 'Regular' | 'PowerPlay' | 'ShortHanded'

export interface UserMatch {
    id: number
    userId: number
    userName: string | null
    matchId: number | null
    seasonId: number
}

export interface UserMatchPoint {
    id: number
    userMatchId: number
    pointReasonId: number
    pointReasonName: string | null
    pointType: PointType
    count: number
}

export interface UserMatchGoal {
    id: number
    userMatchId: number
    rosterPlayerId: number
    playerFirstName: string | null
    playerSurname: string | null
    count: number
    goalType: GoalType
}

export interface UserMatchPenalty {
    id: number
    userMatchId: number
    rosterPlayerId: number
    playerFirstName: string | null
    playerSurname: string | null
    count: number
}

export interface CreateUserMatchPointDto {
    pointReasonId: number
    count: number
}

export interface CreateUserMatchGoalDto {
    rosterPlayerId: number
    count: number
    goalType: GoalType
}

export interface CreateUserMatchPenaltyDto {
    rosterPlayerId: number
    count: number
}
