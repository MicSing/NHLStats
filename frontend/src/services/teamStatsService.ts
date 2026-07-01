import apiClient from './apiClient'
import type { TeamOption, TeamStatsMatch, TeamStatsSummary } from '../types/teamStats'

export const teamStatsService = {
    /** GET /api/team-stats/hosted-teams */
    getHostedTeams(): Promise<TeamOption[]> {
        return apiClient.get<TeamOption[]>('/api/team-stats/hosted-teams')
    },

    /** GET /api/team-stats/opponents?hostedTeamId={id} */
    getOpponents(hostedTeamId: number): Promise<TeamOption[]> {
        return apiClient.get<TeamOption[]>(`/api/team-stats/opponents?hostedTeamId=${hostedTeamId}`)
    },

    /** GET /api/team-stats/summary?hostedTeamId={id}&opponentTeamId={id} */
    getSummary(hostedTeamId: number, opponentTeamId: number): Promise<TeamStatsSummary> {
        return apiClient.get<TeamStatsSummary>(
            `/api/team-stats/summary?hostedTeamId=${hostedTeamId}&opponentTeamId=${opponentTeamId}`,
        )
    },

    /** GET /api/team-stats/matches?hostedTeamId={id}&opponentTeamId={id} */
    getMatches(hostedTeamId: number, opponentTeamId: number): Promise<TeamStatsMatch[]> {
        return apiClient.get<TeamStatsMatch[]>(
            `/api/team-stats/matches?hostedTeamId=${hostedTeamId}&opponentTeamId=${opponentTeamId}`,
        )
    },
}
