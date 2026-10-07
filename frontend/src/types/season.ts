import type { User } from './user'
import type { LeagueTypeValue } from './team'
import type { SeasonUserPositionCode } from './seasonUserPosition'
import type { GamingConsoleValue } from './gamingConsole'

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
    nhlYear: number | null
    console: GamingConsoleValue | null
}

export interface SeasonUser extends User {
    position: SeasonUserPositionCode | null
    /** Only season-active users are added to new matches. */
    isActiveInSeason: boolean
}

export interface SeasonDetail extends Season {
    users: SeasonUser[]
}

export interface CreateSeasonDto {
    name: string
    hostedTeamId?: number | null
    startedOn: string
    status?: string | null
    parentSeasonId?: number | null
    leagueType: LeagueTypeValue
    nhlYear?: number | null
    console?: GamingConsoleValue | null
}

export type UpdateSeasonDto = CreateSeasonDto

export interface ImportRealSeasonMatchesResult {
    imported: number
    skipped: number
    errors: string[]
}

export interface PositionWheelEntry {
    userId: number
    name: string
    position: SeasonUserPositionCode | null
    hasPreviousStats: boolean
    minusPoints: number
    plusPoints: number
    penalties: number
    goals: number
}

export interface PositionWheelState {
    previousSeasonId: number | null
    previousSeasonName: string | null
    /** Season-active players in spin order. */
    order: PositionWheelEntry[]
    currentSpinnerUserId: number | null
    availablePositions: SeasonUserPositionCode[]
}

export interface PositionWheelSpinResult {
    userId: number
    position: SeasonUserPositionCode
    state: PositionWheelState
}
