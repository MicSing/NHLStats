export const CompletionType = {
    None: 0,
    RegularTime: 1,
    Overtime: 2,
    Shootout: 3,
    InProgress: 4,
} as const

export type CompletionType = (typeof CompletionType)[keyof typeof CompletionType]

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
