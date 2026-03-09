import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import LoadingSpinner from '../components/LoadingSpinner'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import apiClient from '../services/apiClient'
import type { FutureMatch } from '../types/match'

interface ExpandedState {
    [matchId: number]: boolean
}

type BetType = 'teamWin' | 'userGoal' | 'userPenalty'
type ApiBetType = 'TeamWin' | 'UserGoal' | 'UserPenalty'
type BetSelection = 'home' | 'away'

interface BetChoice {
    type: BetType
    teamSelection?: BetSelection
    userId?: number
}

interface ExistingBetState {
    [matchId: number]: boolean
}

interface BetDrafts {
    [matchId: number]: BetChoice | null
}

export default function BettingPage() {
    const { t } = useTranslation()
    const { user } = useAuth()
    const { success, error } = useToast()
    const [loading, setLoading] = useState(true)
    const [matches, setMatches] = useState<FutureMatch[]>([])
    const [expanded, setExpanded] = useState<ExpandedState>({})
    const [drafts, setDrafts] = useState<BetDrafts>({})
    const [hasExistingBet, setHasExistingBet] = useState<ExistingBetState>({})

    const userId = user?.userId ?? null

    const loadMatches = useCallback(async () => {
        if (!userId) return

        try {
            const futureMatches = await apiClient.get<FutureMatch[]>('/api/matches/future')
            setMatches(futureMatches)

            const initialDrafts: BetDrafts = {}
            const existingBets: ExistingBetState = {}

            for (const match of futureMatches) {
                if (match.bet) {
                    existingBets[match.id] = true

                    if (match.bet.betType === 'TeamWin') {
                        initialDrafts[match.id] = {
                            type: 'teamWin',
                            teamSelection: match.bet.teamId === match.homeTeamId ? 'home' : 'away',
                        }
                    } else if (match.bet.betType === 'UserGoal') {
                        initialDrafts[match.id] = {
                            type: 'userGoal',
                            userId: match.bet.userId ?? undefined,
                        }
                    } else {
                        initialDrafts[match.id] = {
                            type: 'userPenalty',
                            userId: match.bet.userId ?? undefined,
                        }
                    }
                } else {
                    existingBets[match.id] = false
                    initialDrafts[match.id] = null
                }
            }

            setHasExistingBet(existingBets)
            setDrafts(initialDrafts)
        } catch {
            error(t('betting.loadError'))
        } finally {
            setLoading(false)
        }
    }, [userId, error, t])

    useEffect(() => {
        if (!userId) {
            setLoading(false)
            return
        }

        void loadMatches()
    }, [userId, loadMatches])

    const toggleExpanded = (matchId: number) => {
        setExpanded((prev) => ({ ...prev, [matchId]: !prev[matchId] }))
    }

    const selectBet = (matchId: number, choice: BetChoice) => {
        setDrafts((prev) => ({
            ...prev,
            [matchId]: choice,
        }))
    }

    const mapBetType = (type: BetType): ApiBetType => {
        switch (type) {
            case 'teamWin':
                return 'TeamWin'
            case 'userGoal':
                return 'UserGoal'
            default:
                return 'UserPenalty'
        }
    }

    const placeBet = async (match: FutureMatch) => {
        if (!userId) return

        const draft = drafts[match.id]
        if (!draft) {
            error(t('betting.noBetSelected'))
            return
        }

        try {
            const payload = {
                betType: mapBetType(draft.type),
                userId: draft.type === 'teamWin' ? null : (draft.userId ?? null),
                teamId: draft.type === 'teamWin'
                    ? (draft.teamSelection === 'home' ? match.homeTeamId : match.awayTeamId)
                    : null,
                evaluatedOn: null,
            }

            if (hasExistingBet[match.id]) {
                await apiClient.put(`/api/seasons/${match.seasonId}/matches/${match.id}/bet`, payload)
            } else {
                await apiClient.post(`/api/seasons/${match.seasonId}/matches/${match.id}/bet`, payload)
            }

            setHasExistingBet((prev) => ({ ...prev, [match.id]: true }))
            success(t('betting.betPlaced'))
            await loadMatches()
        } catch {
            error(t('betting.betError'))
        }
    }

    const cancelBet = async (match: FutureMatch) => {
        try {
            await apiClient.delete(`/api/seasons/${match.seasonId}/matches/${match.id}/bet`)
            setHasExistingBet((prev) => ({ ...prev, [match.id]: false }))
            setDrafts((prev) => ({ ...prev, [match.id]: null }))
            success('Bet canceled')
            await loadMatches()
        } catch {
            error('Failed to cancel bet')
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-bg text-text p-6">
                <LoadingSpinner />
            </div>
        )
    }

    if (!userId) {
        return (
            <div className="min-h-screen bg-bg text-text p-6">
                <p>{t('betting.loginRequired')}</p>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-bg text-text p-6">
            <h1 className="text-3xl font-bold mb-6">{t('betting.title')}</h1>

            {matches.length === 0 ? (
                <p className="text-gray-400">{t('betting.noMatches')}</p>
            ) : (
                <div className="space-y-4">
                    {matches.map((match) => {
                        const isExpanded = expanded[match.id] ?? false
                        const draft = drafts[match.id]
                        const users = (match.userMatches ?? []).filter(u => u.userId !== userId)
                        const isParticipating = (match.userMatches ?? []).some(u => u.userId === userId)
                        const isHostingHome = match.hostedTeamId === match.homeTeamId
                        const isHostingAway = match.hostedTeamId === match.awayTeamId

                        return (
                            <div
                                key={match.id}
                                className="bg-bg-secondary border border-accent rounded-lg overflow-hidden"
                            >
                                {/* Match Header */}
                                <button
                                    onClick={() => toggleExpanded(match.id)}
                                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-bg-hover transition-colors"
                                >
                                    <div className="flex items-center gap-4">
                                        <span className="text-sm text-gray-400">
                                            {match.seasonName} - {t('betting.matchNumber', { number: match.matchNumber })}
                                        </span>
                                        <span className="font-semibold text-lg">
                                            {match.homeTeamName ?? t('betting.unknownTeam')} vs{' '}
                                            {match.awayTeamName ?? t('betting.unknownTeam')}
                                        </span>
                                    </div>
                                    <span className="text-xl">
                                        {isExpanded ? '▲' : '▼'}
                                    </span>
                                </button>

                                {/* Expanded Betting Options */}
                                {isExpanded && (
                                    <div className="px-6 py-4 border-t border-accent">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {/* Column 1: Home Team */}
                                            <div className="space-y-4">
                                                <h3 className="text-xl font-semibold text-primary">
                                                    {t('betting.homeTeam')}: {match.homeTeamName ?? t('betting.unknownTeam')}
                                                </h3>

                                                {/* Home Team Win */}
                                                {(!isParticipating || isHostingHome) && (
                                                    <div className="bg-bg p-4 rounded-lg">
                                                        <label className="flex items-center gap-2 cursor-pointer">
                                                            <input
                                                                type="radio"
                                                                name={`match-${match.id}`}
                                                                checked={draft?.type === 'teamWin' && draft?.teamSelection === 'home'}
                                                                onChange={() =>
                                                                    selectBet(match.id, {
                                                                        type: 'teamWin',
                                                                        teamSelection: 'home',
                                                                    })
                                                                }
                                                                className="w-4 h-4"
                                                            />
                                                            <span className="font-semibold">{t('betting.betOnHomeWin')}</span>
                                                        </label>
                                                    </div>
                                                )}

                                                {/* Goal Scorer */}
                                                {!isParticipating && (
                                                    <div className="bg-bg p-4 rounded-lg space-y-2">
                                                        <h4 className="font-semibold mb-2">{t('betting.whoWillScore')}</h4>
                                                        {users.length === 0 ? (
                                                            <p className="text-sm text-gray-400">{t('betting.noUsers')}</p>
                                                        ) : (
                                                            users.map((user) => (
                                                                <label
                                                                    key={`goal-${user.userId}`}
                                                                    className="flex items-center gap-2 cursor-pointer"
                                                                >
                                                                    <input
                                                                        type="radio"
                                                                        name={`match-${match.id}`}
                                                                        checked={
                                                                            draft?.type === 'userGoal' &&
                                                                            draft?.userId === user.userId
                                                                        }
                                                                        onChange={() =>
                                                                            selectBet(match.id, {
                                                                                type: 'userGoal',
                                                                                userId: user.userId,
                                                                            })
                                                                        }
                                                                        className="w-4 h-4"
                                                                    />
                                                                    <span>{user.userName ?? t('betting.unknownUser')}</span>
                                                                </label>
                                                            ))
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Column 2: Away Team */}
                                            <div className="space-y-4">
                                                <h3 className="text-xl font-semibold text-secondary">
                                                    {t('betting.awayTeam')}: {match.awayTeamName ?? t('betting.unknownTeam')}
                                                </h3>

                                                {/* Away Team Win */}
                                                {(!isParticipating || isHostingAway) && (
                                                    <div className="bg-bg p-4 rounded-lg">
                                                        <label className="flex items-center gap-2 cursor-pointer">
                                                            <input
                                                                type="radio"
                                                                name={`match-${match.id}`}
                                                                checked={draft?.type === 'teamWin' && draft?.teamSelection === 'away'}
                                                                onChange={() =>
                                                                    selectBet(match.id, {
                                                                        type: 'teamWin',
                                                                        teamSelection: 'away',
                                                                    })
                                                                }
                                                                className="w-4 h-4"
                                                            />
                                                            <span className="font-semibold">{t('betting.betOnAwayWin')}</span>
                                                        </label>
                                                    </div>
                                                )}

                                                {/* Penalty */}
                                                <div className="bg-bg p-4 rounded-lg space-y-2">
                                                    <h4 className="font-semibold mb-2">{t('betting.whoWillBePenalized')}</h4>
                                                    {users.length === 0 ? (
                                                        <p className="text-sm text-gray-400">{t('betting.noUsers')}</p>
                                                    ) : (
                                                        users.map((user) => (
                                                            <label
                                                                key={`penalty-${user.userId}`}
                                                                className="flex items-center gap-2 cursor-pointer"
                                                            >
                                                                <input
                                                                    type="radio"
                                                                    name={`match-${match.id}`}
                                                                    checked={
                                                                        draft?.type === 'userPenalty' &&
                                                                        draft?.userId === user.userId
                                                                    }
                                                                    onChange={() =>
                                                                        selectBet(match.id, {
                                                                            type: 'userPenalty',
                                                                            userId: user.userId,
                                                                        })
                                                                    }
                                                                    className="w-4 h-4"
                                                                />
                                                                <span>{user.userName ?? t('betting.unknownUser')}</span>
                                                            </label>
                                                        ))
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Place/Cancel Bet Buttons */}
                                        <div className="mt-6 flex justify-end gap-3">
                                            {hasExistingBet[match.id] && (
                                                <button
                                                    onClick={() => cancelBet(match)}
                                                    className="px-6 py-2 bg-red-700 text-white rounded-lg hover:bg-red-600 transition-colors font-semibold"
                                                >
                                                    Cancel Bet
                                                </button>
                                            )}
                                            <button
                                                onClick={() => placeBet(match)}
                                                disabled={!draft}
                                                className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {t('betting.placeBet')}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
