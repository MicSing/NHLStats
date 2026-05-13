import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import LoadingSpinner from '../components/LoadingSpinner'
import PageLayout from '../components/PageLayout'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { bettingService } from '../services/bettingService'
import type {
    ApiBetType,
    BetDto,
    BettingBalanceDto,
    CreateBetLegDto,
    MatchOddsDto,
} from '../types/bet'
import type { FutureMatch } from '../types/match'

type Tab = 'betting' | 'archive'

interface DraftLeg {
    key: string
    matchId: number
    matchNumber: number
    betType: ApiBetType
    userId: number | null
    teamId: number | null
    label: string
    odds: number
}

function legKey(matchId: number, betType: ApiBetType, target: number | null): string {
    return `${matchId}:${betType}:${target ?? '-'}`
}

function describeLeg(leg: DraftLeg, t: (k: string, opts?: Record<string, unknown>) => string): string {
    const matchTag = t('betting.matchNumber', { number: leg.matchNumber })
    return `${matchTag} · ${leg.label}`
}

function describeApiLeg(
    leg: BetDto['legs'][number],
    t: (k: string, opts?: Record<string, unknown>) => string,
): string {
    const tag = t('betting.matchNumber', { number: leg.matchNumber })
    const kind =
        leg.betType === 'TeamWin'
            ? leg.targetName ?? t('betting.unknownTeam')
            : leg.betType === 'UserGoal'
                ? `${t('betting.goals')}: ${leg.targetName ?? t('betting.unknownUser')}`
                : `${t('betting.penalties')}: ${leg.targetName ?? t('betting.unknownUser')}`
    return `${tag} · ${kind} @${leg.odds.toFixed(2)}`
}

export default function BettingPage() {
    const { t } = useTranslation()
    const { user } = useAuth()
    const { success, error } = useToast()

    const userId = user?.userId ?? null

    const [loading, setLoading] = useState(true)
    const [tab, setTab] = useState<Tab>('betting')
    const [matches, setMatches] = useState<FutureMatch[]>([])
    const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null)
    const [oddsByMatch, setOddsByMatch] = useState<Record<number, MatchOddsDto | null>>({})
    const [draftLegs, setDraftLegs] = useState<DraftLeg[]>([])
    const [stakeInput, setStakeInput] = useState<string>('')
    const [activeBets, setActiveBets] = useState<BetDto[]>([])
    const [historyBets, setHistoryBets] = useState<BetDto[] | null>(null)
    const [balance, setBalance] = useState<BettingBalanceDto | null>(null)

    const ensureOdds = useCallback(async (matchId: number) => {
        setOddsByMatch((prev) => {
            if (matchId in prev) return prev
            // mark loading by setting null until result arrives
            return { ...prev, [matchId]: null }
        })
        const odds = await bettingService.getMatchOdds(matchId)
        setOddsByMatch((prev) => ({ ...prev, [matchId]: odds }))
    }, [])

    const loadAll = useCallback(async () => {
        if (!userId) return
        try {
            const [upcoming, active, bal] = await Promise.all([
                bettingService.getUpcoming(7),
                bettingService.listActive(),
                bettingService.getBalance(),
            ])
            setMatches(upcoming)
            setActiveBets(active)
            setBalance(bal)
            if (upcoming.length > 0) {
                setSelectedMatchId((prev) => prev ?? upcoming[0].id)
                void ensureOdds(upcoming[0].id)
            }
        } catch {
            error(t('betting.loadError'))
        } finally {
            setLoading(false)
        }
    }, [userId, ensureOdds, error, t])

    useEffect(() => {
        if (!userId) {
            setLoading(false)
            return
        }
        void loadAll()
    }, [userId, loadAll])

    const selectedMatch = matches.find((m) => m.id === selectedMatchId) ?? null
    const selectedOdds = selectedMatchId != null ? oddsByMatch[selectedMatchId] ?? null : null

    const totalOdds = useMemo(
        () => draftLegs.reduce((p, l) => p * l.odds, 1),
        [draftLegs],
    )

    const stake = parseFloat(stakeInput)
    const stakeValid = Number.isFinite(stake) && stake > 0
    const potentialWin = stakeValid ? stake * totalOdds : 0
    const canCreate =
        draftLegs.length > 0 &&
        stakeValid &&
        (balance == null || stake <= balance.availableBalance) &&
        (balance == null || balance.maxWinCap <= 0 || potentialWin <= balance.maxWinCap)

    const selectMatch = (id: number) => {
        setSelectedMatchId(id)
        void ensureOdds(id)
    }

    const teamOutcomeTypes: ApiBetType[] = ['TeamWin', 'TeamWinOrDraw']

    const addLeg = (leg: Omit<DraftLeg, 'key'>) => {
        const key = legKey(leg.matchId, leg.betType, leg.userId ?? leg.teamId ?? null)
        if (draftLegs.some((l) => l.key === key)) return
        if (
            teamOutcomeTypes.includes(leg.betType) &&
            draftLegs.some((l) => l.matchId === leg.matchId && teamOutcomeTypes.includes(l.betType))
        ) {
            error(t('betting.oneMatchResultPerMatch'))
            return
        }
        setDraftLegs((prev) => [...prev, { ...leg, key }])
    }

    const removeLeg = (key: string) => {
        setDraftLegs((prev) => prev.filter((l) => l.key !== key))
    }

    const clearDraft = () => {
        setDraftLegs([])
        setStakeInput('')
    }

    const placeBet = async () => {
        if (!canCreate) return
        const payload = {
            stake,
            legs: draftLegs.map<CreateBetLegDto>((l) => ({
                matchId: l.matchId,
                betType: l.betType,
                userId: l.userId ?? undefined,
                teamId: l.teamId ?? undefined,
            })),
        }
        try {
            await bettingService.placeBet(payload)
            success(t('betting.betPlaced'))
            clearDraft()
            const [active, bal] = await Promise.all([
                bettingService.listActive(),
                bettingService.getBalance(),
            ])
            setActiveBets(active)
            setBalance(bal)
        } catch {
            error(t('betting.betError'))
        }
    }

    const cancelActive = async (id: string) => {
        try {
            await bettingService.cancelBet(id)
            success(t('betting.betCancelled'))
            const [active, bal] = await Promise.all([
                bettingService.listActive(),
                bettingService.getBalance(),
            ])
            setActiveBets(active)
            setBalance(bal)
        } catch {
            error(t('betting.betError'))
        }
    }

    const loadHistory = useCallback(async () => {
        try {
            const items = await bettingService.listHistory()
            setHistoryBets(items)
        } catch {
            error(t('betting.loadError'))
        }
    }, [error, t])

    useEffect(() => {
        if (tab === 'archive' && historyBets == null) {
            void loadHistory()
        }
    }, [tab, historyBets, loadHistory])

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
                {/* Header: tabs + balance cards */}
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-3">
                    <div className="flex gap-1 rounded-lg bg-surface p-1 border border-border">
                        <button
                            onClick={() => setTab('betting')}
                            className={`px-4 py-1.5 text-sm font-semibold rounded transition-colors ${
                                tab === 'betting' ? 'bg-primary text-white' : 'text-text-muted hover:text-text'
                            }`}
                        >
                            {t('betting.tabBetting')}
                        </button>
                        <button
                            onClick={() => setTab('archive')}
                            className={`px-4 py-1.5 text-sm font-semibold rounded transition-colors ${
                                tab === 'archive' ? 'bg-primary text-white' : 'text-text-muted hover:text-text'
                            }`}
                        >
                            {t('betting.tabArchive')}
                        </button>
                    </div>
                    {balance && (
                        <div className="flex gap-3 text-sm">
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

                {tab === 'betting' ? (
                    <>
                        {/* Live tickets */}
                        <LiveTicketsSection
                            tickets={activeBets}
                            onCancel={cancelActive}
                            t={t}
                        />

                        {/* Upcoming matches */}
                        <UpcomingMatchesSection
                            matches={matches}
                            selectedMatchId={selectedMatchId}
                            onSelect={selectMatch}
                            t={t}
                        />

                        {/* Markets for selected match */}
                        <MarketsSection
                            match={selectedMatch}
                            odds={selectedOdds}
                            currentUserId={userId}
                            matchHasTeamOutcome={
                                selectedMatchId != null &&
                                draftLegs.some(
                                    (l) =>
                                        l.matchId === selectedMatchId &&
                                        teamOutcomeTypes.includes(l.betType),
                                )
                            }
                            onAddLeg={addLeg}
                            t={t}
                        />

                        {/* Ticket draft */}
                        <TicketDraftSection
                            legs={draftLegs}
                            totalOdds={totalOdds}
                            stakeInput={stakeInput}
                            onStakeChange={setStakeInput}
                            onRemove={removeLeg}
                            onClear={clearDraft}
                            onCreate={placeBet}
                            canCreate={canCreate}
                            potentialWin={potentialWin}
                            t={t}
                        />
                    </>
                ) : (
                    <ArchiveTable bets={historyBets} t={t} />
                )}
            </div>
        </PageLayout>
    )
}

interface LiveTicketsProps {
    tickets: BetDto[]
    onCancel: (id: string) => void
    t: (k: string, opts?: Record<string, unknown>) => string
}

function LiveTicketsSection({ tickets, onCancel, t }: LiveTicketsProps) {
    return (
        <section className="card p-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-text-muted mb-3">
                {t('betting.liveTickets')}
            </h2>
            {tickets.length === 0 ? (
                <p className="text-xs text-text-muted italic">{t('betting.noLiveTickets')}</p>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {tickets.map((b) => {
                        const potential = b.stake * b.totalOdds
                        return (
                            <div
                                key={b.id}
                                className="border border-border rounded-lg p-3 bg-bg relative"
                            >
                                <button
                                    onClick={() => onCancel(b.id)}
                                    className="absolute top-2 right-2 text-xs px-2 py-0.5 rounded bg-danger/20 text-danger border border-danger/40 hover:bg-danger/30 font-semibold"
                                >
                                    {t('betting.cancelBet')}
                                </button>
                                <p className="text-xs font-mono font-bold text-primary mb-2">{b.shortId}</p>
                                <ul className="space-y-0.5 text-xs text-text-muted mb-2">
                                    {b.legs.map((l) => (
                                        <li key={l.id}>{describeApiLeg(l, t)}</li>
                                    ))}
                                </ul>
                                <div className="border-t border-border pt-2 flex justify-between items-center text-xs">
                                    <span>
                                        <span className="text-text-muted">{t('betting.stake')}:</span>{' '}
                                        <strong>{b.stake.toFixed(2)} €</strong>
                                    </span>
                                    <span>
                                        <span className="text-text-muted">{t('betting.rate')}:</span>{' '}
                                        <strong>×{b.totalOdds.toFixed(2)}</strong>
                                    </span>
                                    <span className="text-success font-bold">
                                        → {potential.toFixed(2)} €
                                    </span>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </section>
    )
}

interface UpcomingProps {
    matches: FutureMatch[]
    selectedMatchId: number | null
    onSelect: (id: number) => void
    t: (k: string, opts?: Record<string, unknown>) => string
}

function UpcomingMatchesSection({ matches, selectedMatchId, onSelect, t }: UpcomingProps) {
    return (
        <section className="card p-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-text-muted mb-3">
                {t('betting.upcomingMatches')}
            </h2>
            {matches.length === 0 ? (
                <p className="text-text-muted text-sm">{t('betting.noMatches')}</p>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-2">
                    {matches.map((m) => {
                        const active = m.id === selectedMatchId
                        return (
                            <button
                                key={m.id}
                                onClick={() => onSelect(m.id)}
                                className={`text-left px-3 py-2 rounded border transition-colors ${
                                    active
                                        ? 'border-primary bg-primary/10'
                                        : 'border-border bg-bg hover:bg-surface'
                                }`}
                            >
                                <p className="text-[10px] font-mono text-text-muted uppercase">
                                    {t('betting.matchNumber', { number: m.matchNumber })}
                                </p>
                                <p className="text-xs font-semibold leading-tight mt-0.5">
                                    {m.homeTeamName ?? t('betting.unknownTeam')}
                                </p>
                                <p className="text-xs font-semibold leading-tight">
                                    {m.awayTeamName ?? t('betting.unknownTeam')}
                                </p>
                            </button>
                        )
                    })}
                </div>
            )}
        </section>
    )
}

interface MarketsProps {
    match: FutureMatch | null
    odds: MatchOddsDto | null
    currentUserId: number | null
    matchHasTeamOutcome: boolean
    onAddLeg: (leg: Omit<DraftLeg, 'key'>) => void
    t: (k: string, opts?: Record<string, unknown>) => string
}

function MarketsSection({ match, odds, currentUserId, matchHasTeamOutcome, onAddLeg, t }: MarketsProps) {
    if (!match) {
        return (
            <section className="card p-4">
                <p className="text-text-muted text-sm">{t('betting.selectMatchHint')}</p>
            </section>
        )
    }

    const isHostingHome = match.hostedTeamId === match.homeTeamId
    const isHostingAway = match.hostedTeamId === match.awayTeamId
    const homeOdds = odds?.teamWin?.homeOdds ?? null
    const awayOdds = odds?.teamWin?.awayOdds ?? null
    const drawOdds = odds?.teamWin?.drawOdds ?? null
    const home1XOdds = odds?.teamWin?.home1XOdds ?? null
    const away1XOdds = odds?.teamWin?.away1XOdds ?? null
    const matchTitle = `${match.homeTeamName ?? '?'} vs ${match.awayTeamName ?? '?'}`
    const users = (match.userMatches ?? []).filter((u) => u.userId !== currentUserId)

    const homeLabel = `${t('betting.homeWin')} (${match.homeTeamName ?? '?'})`
    const awayLabel = `${t('betting.awayWin')} (${match.awayTeamName ?? '?'})`
    const home1XLabel = `${t('betting.home1X')} (${match.homeTeamName ?? '?'})`
    const away1XLabel = `${t('betting.away1X')} (${match.awayTeamName ?? '?'})`

    return (
        <section className="card p-4 space-y-4">
            <div className="flex items-baseline justify-between">
                <h2 className="text-sm font-bold uppercase tracking-wider text-text-muted">
                    {t('betting.marketsFor', { match: matchTitle })}
                </h2>
                <span className="text-xs font-mono text-text-muted">
                    {t('betting.matchNumber', { number: match.matchNumber })}
                </span>
            </div>

            {/* 1 X 2 */}
            <div className="grid grid-cols-3 gap-2">
                <OddsButton
                    label={t('betting.betOnHomeShort')}
                    subLabel={homeLabel}
                    odds={homeOdds}
                    disabled={!isHostingHome || homeOdds == null || matchHasTeamOutcome}
                    onClick={() =>
                        homeOdds != null &&
                        onAddLeg({
                            matchId: match.id,
                            matchNumber: match.matchNumber,
                            betType: 'TeamWin',
                            userId: null,
                            teamId: match.homeTeamId,
                            label: homeLabel,
                            odds: homeOdds,
                        })
                    }
                />
                <OddsButton
                    label={t('betting.betOnDrawShort')}
                    subLabel={t('betting.drawNotSupported')}
                    odds={drawOdds}
                    disabled
                    onClick={() => undefined}
                />
                <OddsButton
                    label={t('betting.betOnAwayShort')}
                    subLabel={awayLabel}
                    odds={awayOdds}
                    disabled={!isHostingAway || awayOdds == null || matchHasTeamOutcome}
                    onClick={() =>
                        awayOdds != null &&
                        onAddLeg({
                            matchId: match.id,
                            matchNumber: match.matchNumber,
                            betType: 'TeamWin',
                            userId: null,
                            teamId: match.awayTeamId,
                            label: awayLabel,
                            odds: awayOdds,
                        })
                    }
                />
            </div>

            {/* 1X / 2X (double chance) */}
            <div className="grid grid-cols-2 gap-2">
                <OddsButton
                    label={t('betting.betOnHome1XShort')}
                    subLabel={home1XLabel}
                    odds={home1XOdds}
                    disabled={!isHostingHome || home1XOdds == null || matchHasTeamOutcome}
                    onClick={() =>
                        home1XOdds != null &&
                        onAddLeg({
                            matchId: match.id,
                            matchNumber: match.matchNumber,
                            betType: 'TeamWinOrDraw',
                            userId: null,
                            teamId: match.homeTeamId,
                            label: home1XLabel,
                            odds: home1XOdds,
                        })
                    }
                />
                <OddsButton
                    label={t('betting.betOnAway1XShort')}
                    subLabel={away1XLabel}
                    odds={away1XOdds}
                    disabled={!isHostingAway || away1XOdds == null || matchHasTeamOutcome}
                    onClick={() =>
                        away1XOdds != null &&
                        onAddLeg({
                            matchId: match.id,
                            matchNumber: match.matchNumber,
                            betType: 'TeamWinOrDraw',
                            userId: null,
                            teamId: match.awayTeamId,
                            label: away1XLabel,
                            odds: away1XOdds,
                        })
                    }
                />
            </div>

            {/* User markets */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted mb-2">
                        {t('betting.goals')}
                    </h3>
                    {users.length === 0 ? (
                        <p className="text-xs text-text-muted">{t('betting.noUsers')}</p>
                    ) : (
                        <div className="space-y-1">
                            {users.map((u) => {
                                const o = odds?.userGoal.find((x) => x.userId === u.userId)?.odds ?? null
                                return (
                                    <PlayerMarketRow
                                        key={`goal-${u.userId}`}
                                        name={u.userName ?? t('betting.unknownUser')}
                                        odds={o}
                                        onAdd={() =>
                                            o != null &&
                                            onAddLeg({
                                                matchId: match.id,
                                                matchNumber: match.matchNumber,
                                                betType: 'UserGoal',
                                                userId: u.userId,
                                                teamId: null,
                                                label: `${t('betting.goals')}: ${u.userName ?? '?'}`,
                                                odds: o,
                                            })
                                        }
                                    />
                                )
                            })}
                        </div>
                    )}
                </div>
                <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted mb-2">
                        {t('betting.penalties')}
                    </h3>
                    {users.length === 0 ? (
                        <p className="text-xs text-text-muted">{t('betting.noUsers')}</p>
                    ) : (
                        <div className="space-y-1">
                            {users.map((u) => {
                                const o = odds?.userPenalty.find((x) => x.userId === u.userId)?.odds ?? null
                                return (
                                    <PlayerMarketRow
                                        key={`pen-${u.userId}`}
                                        name={u.userName ?? t('betting.unknownUser')}
                                        odds={o}
                                        onAdd={() =>
                                            o != null &&
                                            onAddLeg({
                                                matchId: match.id,
                                                matchNumber: match.matchNumber,
                                                betType: 'UserPenalty',
                                                userId: u.userId,
                                                teamId: null,
                                                label: `${t('betting.penalties')}: ${u.userName ?? '?'}`,
                                                odds: o,
                                            })
                                        }
                                    />
                                )
                            })}
                        </div>
                    )}
                </div>
                <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted mb-2">
                        {t('betting.plusPoints')}
                    </h3>
                    {users.length === 0 ? (
                        <p className="text-xs text-text-muted">{t('betting.noUsers')}</p>
                    ) : (
                        <div className="space-y-1">
                            {users.map((u) => {
                                const o = odds?.userPlusPoint.find((x) => x.userId === u.userId)?.odds ?? null
                                return (
                                    <PlayerMarketRow
                                        key={`plus-${u.userId}`}
                                        name={u.userName ?? t('betting.unknownUser')}
                                        odds={o}
                                        onAdd={() =>
                                            o != null &&
                                            onAddLeg({
                                                matchId: match.id,
                                                matchNumber: match.matchNumber,
                                                betType: 'UserPlusPoint',
                                                userId: u.userId,
                                                teamId: null,
                                                label: `${t('betting.plusPoints')}: ${u.userName ?? '?'}`,
                                                odds: o,
                                            })
                                        }
                                    />
                                )
                            })}
                        </div>
                    )}
                </div>
                <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted mb-2">
                        {t('betting.minusPoints')}
                    </h3>
                    {users.length === 0 ? (
                        <p className="text-xs text-text-muted">{t('betting.noUsers')}</p>
                    ) : (
                        <div className="space-y-1">
                            {users.map((u) => {
                                const o = odds?.userMinusPoint.find((x) => x.userId === u.userId)?.odds ?? null
                                return (
                                    <PlayerMarketRow
                                        key={`minus-${u.userId}`}
                                        name={u.userName ?? t('betting.unknownUser')}
                                        odds={o}
                                        onAdd={() =>
                                            o != null &&
                                            onAddLeg({
                                                matchId: match.id,
                                                matchNumber: match.matchNumber,
                                                betType: 'UserMinusPoint',
                                                userId: u.userId,
                                                teamId: null,
                                                label: `${t('betting.minusPoints')}: ${u.userName ?? '?'}`,
                                                odds: o,
                                            })
                                        }
                                    />
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>
        </section>
    )
}

interface OddsButtonProps {
    label: string
    subLabel: string
    odds: number | null
    disabled?: boolean
    onClick: () => void
}

function OddsButton({ label, subLabel, odds, disabled, onClick }: OddsButtonProps) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className="border border-border bg-bg rounded-lg p-3 text-center hover:border-primary hover:bg-primary/5 disabled:opacity-30 disabled:hover:border-border disabled:hover:bg-bg transition-colors"
        >
            <p className="text-[10px] font-bold uppercase text-text-muted">{label}</p>
            <p className="text-xs text-text-muted truncate">{subLabel}</p>
            <p className="text-lg font-bold mt-1">{odds != null ? `×${odds.toFixed(2)}` : '—'}</p>
        </button>
    )
}

interface PlayerMarketRowProps {
    name: string
    odds: number | null
    onAdd: () => void
}

function PlayerMarketRow({ name, odds, onAdd }: PlayerMarketRowProps) {
    return (
        <button
            onClick={onAdd}
            disabled={odds == null}
            className="w-full flex justify-between items-center px-3 py-2 border border-border rounded bg-bg hover:border-primary hover:bg-primary/5 disabled:opacity-30 disabled:hover:border-border disabled:hover:bg-bg transition-colors"
        >
            <span className="text-sm">{name}</span>
            <span className="font-bold text-warning">{odds != null ? `×${odds.toFixed(2)}` : '—'}</span>
        </button>
    )
}

interface TicketDraftProps {
    legs: DraftLeg[]
    totalOdds: number
    stakeInput: string
    onStakeChange: (v: string) => void
    onRemove: (key: string) => void
    onClear: () => void
    onCreate: () => void
    canCreate: boolean
    potentialWin: number
    t: (k: string, opts?: Record<string, unknown>) => string
}

function TicketDraftSection(props: TicketDraftProps) {
    const { legs, totalOdds, stakeInput, onStakeChange, onRemove, onClear, onCreate, canCreate, potentialWin, t } = props
    return (
        <section className="card p-4 space-y-3">
            <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-wider text-text-muted">
                    {t('betting.ticketDraft')}
                </h2>
                {legs.length > 0 && (
                    <button onClick={onClear} className="text-xs text-text-muted hover:text-danger">
                        ✕
                    </button>
                )}
            </div>

            {legs.length === 0 ? (
                <p className="text-sm text-text-muted italic">{t('betting.draftEmpty')}</p>
            ) : (
                <ul className="space-y-1">
                    {legs.map((leg) => (
                        <li
                            key={leg.key}
                            className="flex items-center justify-between px-3 py-2 border border-border rounded bg-bg"
                        >
                            <span className="text-sm">{describeLeg(leg, t)}</span>
                            <span className="flex items-center gap-3">
                                <span className="font-bold text-warning">×{leg.odds.toFixed(2)}</span>
                                <button
                                    onClick={() => onRemove(leg.key)}
                                    className="text-text-muted hover:text-danger text-sm"
                                    aria-label={t('betting.removeLeg')}
                                >
                                    ✕
                                </button>
                            </span>
                        </li>
                    ))}
                </ul>
            )}

            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-3">
                <div className="flex items-center gap-3 text-sm">
                    <span className="text-text-muted">{t('betting.totalOdds')}:</span>
                    <strong className="text-lg">×{totalOdds.toFixed(2)}</strong>
                </div>
                <div className="flex items-center gap-3">
                    <label className="text-sm text-text-muted">{t('betting.stakeLabel')}</label>
                    <input
                        type="number"
                        min={0.01}
                        step={0.5}
                        value={stakeInput}
                        onChange={(e) => onStakeChange(e.target.value)}
                        className="w-28 px-3 py-1.5 rounded border border-border bg-bg text-sm"
                    />
                    <span className="text-xs text-success">
                        → {potentialWin.toFixed(2)} € {t('betting.potentialWin')}
                    </span>
                </div>
                <button
                    onClick={onCreate}
                    disabled={!canCreate}
                    className="px-5 py-2 bg-primary text-white rounded-lg font-semibold text-sm hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                    {t('betting.createBet')}
                </button>
            </div>
        </section>
    )
}

interface ArchiveProps {
    bets: BetDto[] | null
    t: (k: string, opts?: Record<string, unknown>) => string
}

function ArchiveTable({ bets, t }: ArchiveProps) {
    if (bets == null) {
        return (
            <section className="card p-6">
                <LoadingSpinner />
            </section>
        )
    }

    if (bets.length === 0) {
        return (
            <section className="card p-6 text-center">
                <p className="text-text-muted">{t('betting.noBetHistory')}</p>
            </section>
        )
    }

    return (
        <section className="card overflow-x-auto">
            <table className="w-full text-sm">
                <thead className="bg-surface text-text-muted uppercase text-xs tracking-wider">
                    <tr>
                        <th className="text-left px-4 py-3">{t('betting.id')}</th>
                        <th className="text-left px-4 py-3">{t('betting.date')}</th>
                        <th className="text-left px-4 py-3">{t('betting.ticketDescription')}</th>
                        <th className="text-right px-4 py-3">{t('betting.rate')}</th>
                        <th className="text-right px-4 py-3">{t('betting.profit')}</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-border">
                    {bets.map((b) => {
                        const profit =
                            b.status === 'Won'
                                ? b.stake * b.totalOdds - b.stake
                                : b.status === 'Lost'
                                    ? -b.stake
                                    : null
                        return (
                            <tr key={b.id} className="bg-bg">
                                <td className="px-4 py-3 font-mono font-bold text-primary">{b.shortId}</td>
                                <td className="px-4 py-3 text-text-muted text-xs">
                                    {new Date(b.createdOn).toLocaleString()}
                                </td>
                                <td className="px-4 py-3">
                                    <p className="text-xs leading-relaxed">
                                        {b.legs.map((l, i) => (
                                            <span key={l.id}>
                                                {i > 0 && <span className="text-text-muted">, </span>}
                                                {describeApiLeg(l, t)}
                                            </span>
                                        ))}
                                    </p>
                                </td>
                                <td className="px-4 py-3 text-right">×{b.totalOdds.toFixed(2)}</td>
                                <td className="px-4 py-3 text-right">
                                    {profit == null ? (
                                        <span className="text-text-muted">
                                            {b.status === 'Cancelled'
                                                ? t('betting.outcomeCancelled')
                                                : t('betting.outcomePending')}
                                        </span>
                                    ) : profit >= 0 ? (
                                        <span className="text-success font-semibold">
                                            +{profit.toFixed(2)} €
                                        </span>
                                    ) : (
                                        <span className="text-danger font-semibold">
                                            {profit.toFixed(2)} €
                                        </span>
                                    )}
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </section>
    )
}
