export interface Match {
    id: number
    seasonId: number
    homeTeamId: number
    homeTeamName: string | null
    awayTeamId: number
    awayTeamName: string | null
    homeScore: number
    awayScore: number
    matchDate: string
}

export interface CreateMatchDto {
    homeTeamId: number
    awayTeamId: number
    homeScore: number
    awayScore: number
    matchDate: string
}

export type UpdateMatchDto = CreateMatchDto
