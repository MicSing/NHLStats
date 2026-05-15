export const LeagueType = {
    NHL: 'NHL',
    IIHF: 'IIHF',
    Olympic: 'Olympic',
} as const

export type LeagueTypeValue = typeof LeagueType[keyof typeof LeagueType]

export interface Team {
    id: number
    name: string
    shortName: string
    leagueType: LeagueTypeValue
}
