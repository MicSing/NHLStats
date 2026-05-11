import apiClient from './apiClient'
import type { BettingBalanceDto, BetHistoryItem, MatchOddsDto } from '../types/bet'

export const bettingService = {
    async getBalance(): Promise<BettingBalanceDto> {
        return apiClient.get<BettingBalanceDto>('/api/betting/balance')
    },

    async getHistory(seasonId?: number): Promise<BetHistoryItem[]> {
        const url = seasonId
            ? `/api/betting/history?seasonId=${seasonId}`
            : '/api/betting/history'
        return apiClient.get<BetHistoryItem[]>(url)
    },

    async placeBet(matchId: number, payload: {
        betType: string
        teamId: number | null
        userId: number | null
        amount: number
    }): Promise<void> {
        await apiClient.post(`/api/betting/matches/${matchId}/bet`, payload)
    },

    async updateBet(matchId: number, payload: {
        betType: string
        teamId: number | null
        userId: number | null
        amount: number
    }): Promise<void> {
        await apiClient.put(`/api/betting/matches/${matchId}/bet`, payload)
    },

    async cancelBet(matchId: number): Promise<void> {
        await apiClient.delete(`/api/betting/matches/${matchId}/bet`)
    },

    async getMatchOdds(matchId: number): Promise<MatchOddsDto | null> {
        try {
            return await apiClient.get<MatchOddsDto>(`/api/betting/matches/${matchId}/odds`)
        } catch {
            return null
        }
    },
}
