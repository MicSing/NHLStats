export enum CompletionType {
    None = 0,
    RegularTime = 1,
    Overtime = 2,
    Shootout = 3,
}

export interface Match {
    id: number
    seasonId: number
    matchNumber: number
    homeTeamId: number
    homeTeamName: string | null
    awayTeamId: number
    awayTeamName: string | null
    homeScore: number
    awayScore: number
    matchDate: string | null
    completionType: CompletionType
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
