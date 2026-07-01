export interface TeamOption {
    id: number
    name: string
    shortName: string
}

export interface TeamStatsPairedContributor {
    name: string
    count: number
}

export interface TeamStatsLeader {
    name: string
    count: number
    pairedContributors: TeamStatsPairedContributor[]
}

export interface TeamStatsSummary {
    hostedTeamId: number
    opponentTeamId: number
    matchesPlayed: number
    topScoringUser: TeamStatsLeader | null
    topScoringPlayer: TeamStatsLeader | null
    topPenalizedUser: TeamStatsLeader | null
    topPenalizedPlayer: TeamStatsLeader | null
    topPlusUser: TeamStatsLeader | null
    topMinusUser: TeamStatsLeader | null
    totalPlusPoints: number
    totalMinusPoints: number
    avgPlusPerMatch: number
    avgMinusPerMatch: number
    avgGoalsPerMatch: number
    avgPenaltiesPerMatch: number
}

export interface TeamStatsMatch {
    matchId: number
    seasonId: number
    seasonName: string
    matchDate: string
    isHome: boolean
    homeScore: number
    awayScore: number
    completionType: string
}
