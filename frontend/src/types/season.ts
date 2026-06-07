import type { User } from './user'
import type { LeagueTypeValue } from './team'

export type SeasonStatus = 'Active' | 'Complete'

export interface Season {
    id: number
    name: string
    hostedTeamId: number | null
    hostedTeamName: string | null
    startedOn: string
    status: SeasonStatus
    parentSeasonId: number | null
    leagueType: LeagueTypeValue
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
    leagueType: LeagueTypeValue
}

export type UpdateSeasonDto = CreateSeasonDto
