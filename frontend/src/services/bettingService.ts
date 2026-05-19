import apiClient from './apiClient'
import type { ApiBetType, BetDto, BettingBalanceDto, CreateBetDto, MatchOddsDto } from '../types/bet'
import type { FutureMatch } from '../types/match'

const OCCASIONS_CACHE_TTL = 5 * 60 * 1000
const occasionsCache = new Map<string, { odds: number; fetchedAt: number }>()

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

    async listAll(): Promise<BetDto[]> {
        return apiClient.get<BetDto[]>('/api/betting/bets/all')
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

    async getUserEventOddsForOccasions(
        matchId: number,
        betType: ApiBetType,
        userId: number,
        occasions: number,
    ): Promise<{ occasions: number; odds: number } | null> {
        const cacheKey = `${matchId}:${betType}:${userId}:${occasions}`
        const cached = occasionsCache.get(cacheKey)
        if (cached && Date.now() - cached.fetchedAt < OCCASIONS_CACHE_TTL) {
            return { occasions, odds: cached.odds }
        }
        try {
            const result = await apiClient.get<{ occasions: number; odds: number }>(
                `/api/betting/matches/${matchId}/odds/occasions?betType=${betType}&userId=${userId}&occasions=${occasions}`,
            )
            occasionsCache.set(cacheKey, { odds: result.odds, fetchedAt: Date.now() })
            return result
        } catch {
            return null
        }
    },
}
