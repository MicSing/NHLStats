import apiClient from './apiClient'
import type { BetDto, BettingBalanceDto, CreateBetDto, MatchOddsDto } from '../types/bet'
import type { FutureMatch } from '../types/match'

export const bettingService = {
    async getBalance(): Promise<BettingBalanceDto> {
        return apiClient.get<BettingBalanceDto>('/api/betting/balance')
    },

    async listActive(): Promise<BetDto[]> {
        return apiClient.get<BetDto[]>('/api/betting/bets/active')
    },

    async listHistory(seasonId?: number): Promise<BetDto[]> {
        const url = seasonId
            ? `/api/betting/bets/history?seasonId=${seasonId}`
            : '/api/betting/bets/history'
        return apiClient.get<BetDto[]>(url)
    },

    async placeBet(payload: CreateBetDto): Promise<BetDto> {
        return apiClient.post<BetDto>('/api/betting/bets', payload)
    },

    async cancelBet(betId: string): Promise<void> {
        await apiClient.delete(`/api/betting/bets/${betId}`)
    },

    async getMatchOdds(matchId: number): Promise<MatchOddsDto | null> {
        try {
            return await apiClient.get<MatchOddsDto>(`/api/betting/matches/${matchId}/odds`)
        } catch {
            return null
        }
    },

    async getUpcoming(count = 7): Promise<FutureMatch[]> {
        return apiClient.get<FutureMatch[]>(`/api/matches/future?count=${count}`)
    },
}
