export interface RosterPlayer {
    id: number
    firstName: string
    surname: string
    position: string | null
    teamId: number
    teamName: string | null
    teamShortName: string | null
    seasonId: number
    isActive: boolean
}

export interface CreateRosterPlayerDto {
    firstName: string
    surname: string
    position?: string | null
    teamId: number
}

export interface UpdateRosterPlayerDto {
    firstName: string
    surname: string
    position?: string | null
    teamId: number
    isActive: boolean
}

export interface CsvImportResultDto {
    imported: number
    errors: string[]
}
