import type { GoalType } from './userMatch'
import type { PointType } from './pointReason'

export const MatchEventType = {
    Goal: 'Goal',
    Penalty: 'Penalty',
    Point: 'Point',
    PeriodChange: 'PeriodChange',
    MatchEnd: 'MatchEnd',
    ShootoutGoal: 'ShootoutGoal',
} as const

export type MatchEventType = (typeof MatchEventType)[keyof typeof MatchEventType]

export interface MatchEvent {
    id: number
    matchId: number
    orderIndex: number
    eventType: MatchEventType
    isOpponent: boolean
    eventSubtype: string | null
    userMatchGoalId: number | null
    userMatchPenaltyId: number | null
    userMatchPointId: number | null
    rosterPlayerId: number | null
    playerName: string | null
    userMatchId: number | null
    userName: string | null
    pointReasonName: string | null
    pointType: PointType | null
    goalType: GoalType | null
    createdAt: string
}

export interface CreateTeamMatchEventDto {
    eventType: MatchEventType
    isOpponent: boolean
    eventSubtype?: string | null
}

export interface ReorderMatchEventsDto {
    eventIds: number[]
}

export const CompletionType = {
    None: 0,
    RegularTime: 1,
    Overtime: 2,
    Shootout: 3,
    InProgress: 4,
} as const

export type CompletionType = (typeof CompletionType)[keyof typeof CompletionType]

export const MatchPhase = {
    RegularSeason: 'RegularSeason',
    Playoff: 'Playoff',
} as const

export type MatchPhase = (typeof MatchPhase)[keyof typeof MatchPhase]

export interface Match {
    id: number
    seasonId: number
    matchNumber: number
    homeTeamId: number
    homeTeamName: string | null
    homeTeamShortName: string | null
    awayTeamId: number
    awayTeamName: string | null
    awayTeamShortName: string | null
    homeScore: number
    awayScore: number
    matchDate: string | null
    completionType: CompletionType
    phase: MatchPhase
    playoffRound: number | null
}

export interface FutureMatch {
    id: number
    seasonId: number
    seasonName: string
    matchNumber: number
    homeTeamId: number
    homeTeamName: string | null
    awayTeamId: number
    awayTeamName: string | null
    hostedTeamId: number | null
    phase: MatchPhase
    playoffRound: number | null
    userMatches: UserMatchInfo[] | null
}

export interface UserMatchInfo {
    userId: number
    userName: string | null
}

export interface CreateMatchDto {
    homeTeamId: number
    awayTeamId: number
}

export interface UpdateMatchDto {
    homeTeamId: number
    awayTeamId: number
    matchDate: string | null
    homeScore: number
    awayScore: number
    completionType: CompletionType
    phase: MatchPhase
    playoffRound: number | null
}

export interface BatchUserPointsDto {
    userId: number
    plus: number
    minus: number
}

export interface BatchCreateMatchDto {
    homeTeamId: number
    awayTeamId: number
    matchDate?: string | null
    homeScore?: number
    awayScore?: number
    completionType?: CompletionType
    userPoints?: BatchUserPointsDto[]
}

export interface CreatePlayoffSeriesDto {
    opponentTeamId: number
    startsHome: boolean
}
