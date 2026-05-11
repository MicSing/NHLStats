import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import LoadingSpinner from '../components/LoadingSpinner'
import PageLayout from '../components/PageLayout'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { bettingService } from '../services/bettingService'
import type { BettingBalanceDto, MatchOddsDto } from '../types/bet'
import type { FutureMatch } from '../types/match'
import apiClient from '../services/apiClient'

type BetType = 'teamWin' | 'userGoal' | 'userPenalty'
type BetSelection = 'home' | 'away'

interface BetChoice {
    type: BetType
    teamSelection?: BetSelection
    userId?: number
    amount: number
}

interface BetDrafts {
    [matchId: number]: BetChoice | null
}

interface ExistingBetState {
    [matchId: number]: boolean
}

interface ExpandedState {
    [matchId: number]: boolean
}

interface MatchOddsState {
    [matchId: number]: MatchOddsDto | null
}

function mapBetType(type: BetType): string {
    switch (type) {
        case 'teamWin': return 'TeamWin'
        case 'userGoal': return 'UserGoal'
        default: return 'UserPenalty'
    }
}

export default function BettingPage() {
    const { t } = useTranslation()
    const { user } = useAuth()
    const { success, error } = useToast()
    const [loading, setLoading] = useState(true)
    const [matches, setMatches] = useState<FutureMatch[]>([])
    const [balance, setBalance] = useState<BettingBalanceDto | null>(null)
    const [expanded, setExpanded] = useState<ExpandedState>({})
    const [drafts, setDrafts] = useState<BetDrafts>({})
    const [hasExistingBet, setHasExistingBet] = useState<ExistingBetState>({})
    const [matchOdds, setMatchOdds] = useState<MatchOddsState>({})

    const userId = user?.userId ?? null

    const loadData = useCallback(async () => {
        if (!userId) return

        try {
            const [futureMatches, bal] = await Promise.all([
                apiClient.get<FutureMatch[]>('/api/matches/future'),
                bettingService.getBalance(),
            ])

            setMatches(futureMatches)
            setBalance(bal)

            const initialDrafts: BetDrafts = {}
            const existingBets: ExistingBetState = {}

            for (const match of futureMatches) {
                if (match.bet) {
                    existingBets[match.id] = true
                    const amount = match.bet.amount ?? 1
                    if (match.bet.betType === 'TeamWin') {
                        initialDrafts[match.id] = {
                            type: 'teamWin',
                            teamSelection: match.bet.teamId === match.homeTeamId ? 'home' : 'away',
                            amount,
                        }
                    } else if (match.bet.betType === 'UserGoal') {
                        initialDrafts[match.id] = { type: 'userGoal', userId: match.bet.userId ?? undefined, amount }
                    } else {
                        initialDrafts[match.id] = { type: 'userPenalty', userId: match.bet.userId ?? undefined, amount }
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
        void loadData()
    }, [userId, loadData])

    const toggleExpanded = (matchId: number) => {
        setExpanded((prev) => {
            const next = !prev[matchId]
            if (next && !(matchId in matchOdds)) {
                bettingService.getMatchOdds(matchId).then((odds) => {
                    setMatchOdds((o) => ({ ...o, [matchId]: odds }))
                })
            }
            return { ...prev, [matchId]: next }
        })
    }

    const selectBet = (matchId: number, choice: Omit<BetChoice, 'amount'>) => {
        setDrafts((prev) => ({
            ...prev,
            [matchId]: { ...choice, amount: prev[matchId]?.amount ?? 1 },
        }))
    }

    const setAmount = (matchId: number, amount: number) => {
        setDrafts((prev) => {
            const existing = prev[matchId]
            if (!existing) return prev
            return { ...prev, [matchId]: { ...existing, amount } }
        })
    }

    const placeBet = async (match: FutureMatch) => {
        if (!userId) return

        const draft = drafts[match.id]
        if (!draft) {
            error(t('betting.noBetSelected'))
            return
        }

        const payload = {
            betType: mapBetType(draft.type),
            userId: draft.type === 'teamWin' ? null : (draft.userId ?? null),
            teamId: draft.type === 'teamWin'
                ? (draft.teamSelection === 'home' ? match.homeTeamId : match.awayTeamId)
                : null,
            amount: draft.amount,
        }

        try {
            if (hasExistingBet[match.id]) {
                await bettingService.updateBet(match.id, payload)
            } else {
                await bettingService.placeBet(match.id, payload)
            }
            setHasExistingBet((prev) => ({ ...prev, [match.id]: true }))
            success(t('betting.betPlaced'))
            await loadData()
        } catch {
            error(t('betting.betError'))
        }
    }

    const cancelBet = async (matchId: number) => {
        try {
            await bettingService.cancelBet(matchId)
            setHasExistingBet((prev) => ({ ...prev, [matchId]: false }))
            setDrafts((prev) => ({ ...prev, [matchId]: null }))
            success(t('betting.betCancelled'))
            await loadData()
        } catch {
            error(t('betting.betError'))
        }
    }

    if (loading) {
        return (
            <PageLayout>
                <LoadingSpinner />
            </PageLayout>
        )
    }

    if (!userId) {
        return (
            <PageLayout>
                <p>{t('betting.loginRequired')}</p>
            </PageLayout>
        )
    }

    return (
        <PageLayout>
            <div className="space-y-6">
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <h1 className="text-3xl font-bold">{t('betting.title')}</h1>
                    {balance && (
                        <div className="flex gap-4 text-sm">
                            <div className="card px-4 py-2 text-center">
                                <p className="text-text-muted text-xs mb-0.5">{t('betting.availableBalance')}</p>
                                <p className="font-bold text-success text-lg">{balance.availableBalance.toFixed(2)} €</p>
                            </div>
                            {balance.maxWinCap > 0 && (
                                <div className="card px-4 py-2 text-center">
                                    <p className="text-text-muted text-xs mb-0.5">{t('betting.maxWinCap')}</p>
                                    <p className="font-bold text-warning text-lg">{balance.maxWinCap.toFixed(2)} €</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {matches.length === 0 ? (
                    <p className="text-text-muted">{t('betting.noMatches')}</p>
                ) : (
                    <div className="space-y-4">
                        {matches.map((match) => {
                            const isExpanded = expanded[match.id] ?? false
                            const draft = drafts[match.id]
                            const odds = matchOdds[match.id] ?? null
                            const users = (match.userMatches ?? []).filter(u => u.userId !== userId)
const isHostingHome = match.hostedTeamId === match.homeTeamId
                            const isHostingAway = match.hostedTeamId === match.awayTeamId
                            const hasBet = hasExistingBet[match.id]

                            // Resolve current odds for the selected draft option
                            const currentOdds = (() => {
                                if (!draft || !odds) return null
                                if (draft.type === 'teamWin') {
                                    return draft.teamSelection === 'home'
                                        ? odds.teamWin?.homeOdds ?? null
                                        : odds.teamWin?.awayOdds ?? null
                                }
                                const list = draft.type === 'userGoal' ? odds.userGoal : odds.userPenalty
                                return list.find(o => o.userId === draft.userId)?.odds ?? null
                            })()

                            return (
                                <div
                                    key={match.id}
                                    className="bg-bg-secondary border border-accent rounded-lg overflow-hidden"
                                >
                                    <button
                                        onClick={() => toggleExpanded(match.id)}
                                        className="w-full px-6 py-4 flex items-center justify-between hover:bg-bg-hover transition-colors"
                                    >
                                        <div className="flex items-center gap-4">
                                            <span className="text-sm text-text-muted">
                                                {match.seasonName} - {t('betting.matchNumber', { number: match.matchNumber })}
                                            </span>
                                            <span className="font-semibold text-lg">
                                                {match.homeTeamName ?? t('betting.unknownTeam')} vs{' '}
                                                {match.awayTeamName ?? t('betting.unknownTeam')}
                                            </span>
                                            {hasBet && (
                                                <span className="text-xs px-2 py-0.5 rounded bg-primary/20 text-primary font-medium">
                                                    {t('betting.betPlacedBadge')}
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-xl">{isExpanded ? '▲' : '▼'}</span>
                                    </button>

                                    {isExpanded && (
                                        <div className="px-6 py-4 border-t border-accent space-y-4">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                {/* Column 1: Home Team */}
                                                <div className="space-y-4">
                                                    <h3 className="text-xl font-semibold text-primary">
                                                        {t('betting.homeTeam')}: {match.homeTeamName ?? t('betting.unknownTeam')}
                                                    </h3>

                                                    {isHostingHome && (
                                                        <div className="bg-bg p-4 rounded-lg">
                                                            <label className="flex items-center justify-between gap-2 cursor-pointer">
                                                                <div className="flex items-center gap-2">
                                                                    <input
                                                                        type="radio"
                                                                        name={`match-${match.id}`}
                                                                        checked={draft?.type === 'teamWin' && draft?.teamSelection === 'home'}
                                                                        onChange={() => selectBet(match.id, { type: 'teamWin', teamSelection: 'home' })}
                                                                        className="w-4 h-4"
                                                                    />
                                                                    <span className="font-semibold">{t('betting.betOnHomeWin')}</span>
                                                                </div>
                                                                {odds?.teamWin && (
                                                                    <span className="text-xs font-bold text-warning bg-warning/10 px-2 py-0.5 rounded">
                                                                        ×{odds.teamWin.homeOdds.toFixed(2)}
                                                                    </span>
                                                                )}
                                                            </label>
                                                        </div>
                                                    )}

                                                    <div className="bg-bg p-4 rounded-lg space-y-2">
                                                        <h4 className="font-semibold mb-2">{t('betting.whoWillScore')}</h4>
                                                        {users.length === 0 ? (
                                                            <p className="text-sm text-text-muted">{t('betting.noUsers')}</p>
                                                        ) : (
                                                            users.map((u) => {
                                                                const userGoalOdds = odds?.userGoal.find(o => o.userId === u.userId)
                                                                return (
                                                                    <label key={`goal-${u.userId}`} className="flex items-center justify-between gap-2 cursor-pointer">
                                                                        <div className="flex items-center gap-2">
                                                                            <input
                                                                                type="radio"
                                                                                name={`match-${match.id}`}
                                                                                checked={draft?.type === 'userGoal' && draft?.userId === u.userId}
                                                                                onChange={() => selectBet(match.id, { type: 'userGoal', userId: u.userId })}
                                                                                className="w-4 h-4"
                                                                            />
                                                                            <span>{u.userName ?? t('betting.unknownUser')}</span>
                                                                        </div>
                                                                        {userGoalOdds && (
                                                                            <span className="text-xs font-bold text-warning bg-warning/10 px-2 py-0.5 rounded">
                                                                                ×{userGoalOdds.odds.toFixed(2)}
                                                                            </span>
                                                                        )}
                                                                    </label>
                                                                )
                                                            })
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Column 2: Away Team */}
                                                <div className="space-y-4">
                                                    <h3 className="text-xl font-semibold text-secondary">
                                                        {t('betting.awayTeam')}: {match.awayTeamName ?? t('betting.unknownTeam')}
                                                    </h3>

                                                    {isHostingAway && (
                                                        <div className="bg-bg p-4 rounded-lg">
                                                            <label className="flex items-center justify-between gap-2 cursor-pointer">
                                                                <div className="flex items-center gap-2">
                                                                    <input
                                                                        type="radio"
                                                                        name={`match-${match.id}`}
                                                                        checked={draft?.type === 'teamWin' && draft?.teamSelection === 'away'}
                                                                        onChange={() => selectBet(match.id, { type: 'teamWin', teamSelection: 'away' })}
                                                                        className="w-4 h-4"
                                                                    />
                                                                    <span className="font-semibold">{t('betting.betOnAwayWin')}</span>
                                                                </div>
                                                                {odds?.teamWin && (
                                                                    <span className="text-xs font-bold text-warning bg-warning/10 px-2 py-0.5 rounded">
                                                                        ×{odds.teamWin.awayOdds.toFixed(2)}
                                                                    </span>
                                                                )}
                                                            </label>
                                                        </div>
                                                    )}

                                                    <div className="bg-bg p-4 rounded-lg space-y-2">
                                                        <h4 className="font-semibold mb-2">{t('betting.whoWillBePenalized')}</h4>
                                                        {users.length === 0 ? (
                                                            <p className="text-sm text-text-muted">{t('betting.noUsers')}</p>
                                                        ) : (
                                                            users.map((u) => {
                                                                const userPenaltyOdds = odds?.userPenalty.find(o => o.userId === u.userId)
                                                                return (
                                                                    <label key={`penalty-${u.userId}`} className="flex items-center justify-between gap-2 cursor-pointer">
                                                                        <div className="flex items-center gap-2">
                                                                            <input
                                                                                type="radio"
                                                                                name={`match-${match.id}`}
                                                                                checked={draft?.type === 'userPenalty' && draft?.userId === u.userId}
                                                                                onChange={() => selectBet(match.id, { type: 'userPenalty', userId: u.userId })}
                                                                                className="w-4 h-4"
                                                                            />
                                                                            <span>{u.userName ?? t('betting.unknownUser')}</span>
                                                                        </div>
                                                                        {userPenaltyOdds && (
                                                                            <span className="text-xs font-bold text-warning bg-warning/10 px-2 py-0.5 rounded">
                                                                                ×{userPenaltyOdds.odds.toFixed(2)}
                                                                            </span>
                                                                        )}
                                                                    </label>
                                                                )
                                                            })
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Amount + Actions */}
                                            {draft && (
                                                <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-accent">
                                                    <div className="flex items-center gap-3">
                                                        <label className="text-sm font-medium">{t('betting.stakeLabel')}</label>
                                                        <input
                                                            type="number"
                                                            min={0.01}
                                                            step={0.5}
                                                            max={balance?.availableBalance ?? undefined}
                                                            value={draft.amount}
                                                            onChange={(e) => setAmount(match.id, parseFloat(e.target.value) || 0)}
                                                            className="w-28 px-3 py-1.5 rounded border border-accent bg-bg text-sm"
                                                        />
                                                        {balance && (
                                                            <span className="text-xs text-text-muted">
                                                                {t('betting.availableBalance')}: {balance.availableBalance.toFixed(2)} €
                                                            </span>
                                                        )}
                                                        {currentOdds && draft && draft.amount > 0 && (
                                                            <span className="text-xs text-success font-medium">
                                                                → {(draft.amount * currentOdds).toFixed(2)} € {t('betting.potentialWin')}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex gap-3">
                                                        {hasBet && (
                                                            <button
                                                                onClick={() => cancelBet(match.id)}
                                                                className="px-5 py-2 bg-danger/20 text-danger border border-danger/40 rounded-lg hover:bg-danger/30 transition-colors font-semibold text-sm"
                                                            >
                                                                {t('betting.cancelBet')}
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => placeBet(match)}
                                                            className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-semibold text-sm"
                                                        >
                                                            {hasBet ? t('betting.updateBet') : t('betting.placeBet')}
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </PageLayout>
    )
}
