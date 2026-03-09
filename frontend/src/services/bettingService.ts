import type { UpsertUserBetInput, UserBet, MatchBet, BetType, BetSelection } from '../types/bet'

const STORAGE_KEY = 'nhlstats-bets-v1'
const MATCH_BETS_KEY = 'nhlstats-match-bets-v2'

function readBets(): UserBet[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return []

        const parsed = JSON.parse(raw) as unknown
        return Array.isArray(parsed) ? (parsed as UserBet[]) : []
    } catch {
        return []
    }
}

function writeBets(bets: UserBet[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bets))
}

function readMatchBets(): MatchBet[] {
    try {
        const raw = localStorage.getItem(MATCH_BETS_KEY)
        if (!raw) return []
        const parsed = JSON.parse(raw) as unknown
        return Array.isArray(parsed) ? (parsed as MatchBet[]) : []
    } catch {
        return []
    }
}

function writeMatchBets(bets: MatchBet[]): void {
    localStorage.setItem(MATCH_BETS_KEY, JSON.stringify(bets))
}

function createBetId(): string {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export const bettingService = {
    getUserBets(userId: number): UserBet[] {
        return readBets()
            .filter((bet) => bet.userId === userId)
            .sort((a, b) => new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime())
    },

    upsertUserBet(input: UpsertUserBetInput): UserBet {
        const allBets = readBets()
        const existingIndex = allBets.findIndex(
            (bet) => bet.userId === input.userId && bet.matchId === input.matchId,
        )

        const selectedTeamId = input.selection === 'home' ? input.homeTeamId : input.awayTeamId
        const selectedTeamName = input.selection === 'home' ? input.homeTeamName : input.awayTeamName

        const nextBet: UserBet = {
            id: existingIndex >= 0 ? allBets[existingIndex].id : createBetId(),
            userId: input.userId,
            seasonId: input.seasonId,
            seasonName: input.seasonName,
            matchId: input.matchId,
            matchNumber: input.matchNumber,
            homeTeamId: input.homeTeamId,
            homeTeamName: input.homeTeamName,
            awayTeamId: input.awayTeamId,
            awayTeamName: input.awayTeamName,
            matchDate: input.matchDate,
            selection: input.selection,
            selectedTeamId,
            selectedTeamName,
            stake: input.stake,
            placedAt: new Date().toISOString(),
        }

        if (existingIndex >= 0) {
            allBets[existingIndex] = nextBet
        } else {
            allBets.push(nextBet)
        }

        writeBets(allBets)
        return nextBet
    },

    removeBet(betId: string): void {
        const allBets = readBets()
        const next = allBets.filter((bet) => bet.id !== betId)
        writeBets(next)
    },

    // Match bets (simplified single-choice)
    getMatchBet(userId: number, matchId: number): MatchBet | undefined {
        return readMatchBets().find((bet) => bet.userId === userId && bet.matchId === matchId)
    },

    upsertMatchBet(
        userId: number,
        matchId: number,
        betType: BetType,
        teamSelection?: BetSelection,
        betOnUserId?: number,
        betOnUserName?: string,
    ): MatchBet {
        const allBets = readMatchBets()
        const existingIndex = allBets.findIndex(
            (bet) => bet.userId === userId && bet.matchId === matchId,
        )

        const nextBet: MatchBet = {
            id: existingIndex >= 0 ? allBets[existingIndex].id : createBetId(),
            userId,
            matchId,
            betType,
            teamSelection: betType === 'teamWin' ? teamSelection : undefined,
            betOnUserId: betType !== 'teamWin' ? betOnUserId : undefined,
            betOnUserName: betType !== 'teamWin' ? betOnUserName : undefined,
            placedAt: new Date().toISOString(),
        }

        if (existingIndex >= 0) {
            allBets[existingIndex] = nextBet
        } else {
            allBets.push(nextBet)
        }

        writeMatchBets(allBets)
        return nextBet
    },

    removeMatchBet(userId: number, matchId: number): void {
        const allBets = readMatchBets()
        const next = allBets.filter((bet) => !(bet.userId === userId && bet.matchId === matchId))
        writeMatchBets(next)
    },
}