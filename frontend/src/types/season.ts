import type { User } from './user'

export interface Season {
    id: number
    name: string
    hostedTeamId: number | null
    hostedTeamName: string | null
    startedOn: string
    status: string | null
    parentSeasonId: number | null
}

export interface SeasonDetail extends Season {
    users: User[]
}

export interface CreateSeasonDto {
    name: string
    hostedTeamId?: number | null
    startedOn: string
    status?: string | null
    parentSeasonId?: number | null
}

export type UpdateSeasonDto = CreateSeasonDto
