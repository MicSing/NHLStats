export type ProposalStatus = 'Proposed' | 'Confirmed' | 'Rejected'
export type ProposalConfidence = 'Low' | 'Medium' | 'High'

/** An event suggested by the Collector app; it changes nothing until an admin confirms it. */
export interface MatchEventProposal {
    id: number
    matchId: number
    clientEventId: string
    apiKeyName: string | null
    eventType: 'Goal' | 'Penalty' | 'PeriodChange' | 'MatchEnd' | 'ShootoutGoal'
    isOpponent: boolean
    eventSubtype: string | null
    goalType: 'Regular' | 'PowerPlay' | 'ShortHanded' | 'Shootout' | null
    userId: number | null
    userName: string | null
    rosterPlayerId: number | null
    playerName: string | null
    period: number | null
    gameClock: string | null
    strength: string | null
    confidence: ProposalConfidence
    note: string | null
    mediaRef: string | null
    occurredAt: string | null
    status: ProposalStatus
    matchEventId: number | null
    createdAt: string
    resolvedAt: string | null
}

export interface ConfirmProposalDto {
    userId?: number | null
    rosterPlayerId?: number | null
    isOpponent?: boolean | null
    goalType?: MatchEventProposal['goalType']
    clearUser?: boolean
}

export interface ApiKey {
    id: number
    name: string
    prefix: string
    createdAt: string
    lastUsedAt: string | null
    revokedAt: string | null
}

export interface CreatedApiKey {
    apiKey: ApiKey
    key: string
}
