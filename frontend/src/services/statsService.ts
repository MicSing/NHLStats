import apiClient from './apiClient'
import type {
    HeadToHeadMatch,
    UserMatchSummary,
    UserPointReasonBreakdown,
} from '../types/stats'
import type { User } from '../types/user'

export const statsService = {
    /** GET /api/stats/users/{userId}/point-reasons?seasonId={optional} */
    getUserPointReasonBreakdown(
        userId: number,
        seasonId?: number,
    ): Promise<UserPointReasonBreakdown> {
        const query = seasonId != null ? `?seasonId=${seasonId}` : ''
        return apiClient.get<UserPointReasonBreakdown>(
            `/api/stats/users/${userId}/point-reasons${query}`,
        )
    },

    /** GET /api/stats/users/{userId}/match-history?seasonId={optional} */
    getUserMatchHistory(
        userId: number,
        seasonId?: number,
    ): Promise<UserMatchSummary[]> {
        const query = seasonId != null ? `?seasonId=${seasonId}` : ''
        return apiClient.get<UserMatchSummary[]>(
            `/api/stats/users/${userId}/match-history${query}`,
        )
    },

    /** GET /api/stats/head-to-head/{teamId}?hostedTeamId={hostedTeamId} */
    getHeadToHead(
        teamId: number,
        hostedTeamId: number,
    ): Promise<HeadToHeadMatch[]> {
        return apiClient.get<HeadToHeadMatch[]>(
            `/api/stats/head-to-head/${teamId}?hostedTeamId=${hostedTeamId}`,
        )
    },

    /** GET /api/seasons/{id}/users */
    getSeasonUsers(seasonId: number): Promise<User[]> {
        return apiClient.get<User[]>(`/api/seasons/${seasonId}/users`)
    },
}
