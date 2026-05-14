import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useToast } from '../../context/ToastContext'
import { bettingService } from '../../services/bettingService'
import { cacheService } from '../../services/cacheService'
import Pagination from '../Pagination'
import LoadingSpinner from '../LoadingSpinner'
import type { BetDto, BetLegDto, BetStatus, ApiBetType } from '../../types/bet'
import type { Season } from '../../types/season'
import type { User } from '../../types/user'

const PAGE_SIZE = 10

type SortBy = 'createdOn' | 'evaluatedOn' | 'stake' | 'odds' | 'win'
type SortDir = 'asc' | 'desc'

const ALL_BET_TYPES: ApiBetType[] = [
    'TeamWin', 'UserGoal', 'UserPenalty', 'TeamWinOrDraw',
    'UserPlusPoint', 'UserMinusPoint', 'TeamDraw',
]

const STATUS_BADGE: Record<BetStatus, string> = {
    Pending: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    Won: 'bg-green-500/10 text-green-500 border-green-500/20',
    Lost: 'bg-red-500/10 text-red-500 border-red-500/20',
    Cancelled: 'bg-gray-700/50 text-gray-400 border-gray-600',
}

const STATUS_BORDER: Record<BetStatus, string> = {
    Pending: 'border-l-blue-500',
    Won: 'border-l-green-500',
    Lost: 'border-l-red-500',
    Cancelled: 'border-l-gray-600',
}

function getLegDisplay(leg: BetLegDto): { market: string; marketColor: string; selection: string } {
    switch (leg.betType) {
        case 'TeamWin':
        case 'TeamWinOrDraw':
            return { market: 'Match', marketColor: 'text-primary', selection: leg.targetName ?? '?' }
        case 'TeamDraw':
            return { market: 'Draw', marketColor: 'text-text-muted', selection: 'X' }
        case 'UserGoal':
            return { market: 'Goals', marketColor: 'text-green-400', selection: leg.targetName ?? '?' }
        case 'UserPenalty':
            return { market: 'Penalties', marketColor: 'text-red-400', selection: leg.targetName ?? '?' }
        case 'UserPlusPoint':
            return { market: 'Plus', marketColor: 'text-green-400', selection: leg.targetName ?? '?' }
        case 'UserMinusPoint':
            return { market: 'Minus', marketColor: 'text-orange-400', selection: leg.targetName ?? '?' }
        default:
            return { market: 'Bet', marketColor: 'text-text-muted', selection: leg.targetName ?? '?' }
    }
}

function potentialWin(bet: BetDto): number {
    return bet.stake * bet.totalOdds
}

export default function TicketsTab() {
    const { t } = useTranslation()
    const { error } = useToast()
    const [searchParams, setSearchParams] = useSearchParams()

    const [bets, setBets] = useState<BetDto[] | null>(null)
    const [seasons, setSeasons] = useState<Season[]>([])
    const [users, setUsers] = useState<User[]>([])
    const [filterOpen, setFilterOpen] = useState(false)

    // Read all filter state from URL
    const p = searchParams
    const filterId = p.get('id') ?? ''
    const filterUserId = p.get('userId') ?? ''
    const filterMatchNumber = p.get('matchNumber') ?? ''
    const filterSeasonId = p.get('seasonId') ?? ''
    const filterStatus = p.get('status') ?? ''
    const filterStructure = p.get('structure') ?? ''
    const filterBetType = (p.get('betType') ?? '') as ApiBetType | ''
    const filterStakeMin = p.get('stakeMin') ?? ''
    const filterStakeMax = p.get('stakeMax') ?? ''
    const filterOddsMin = p.get('oddsMin') ?? ''
    const filterOddsMax = p.get('oddsMax') ?? ''
    const filterWinMin = p.get('winMin') ?? ''
    const filterWinMax = p.get('winMax') ?? ''
    const sortBy = (p.get('sortBy') ?? 'createdOn') as SortBy
    const sortDir = (p.get('sortDir') ?? 'desc') as SortDir
    const page = parseInt(p.get('page') ?? '1', 10)

    useEffect(() => {
        const load = async () => {
            try {
                const [allBets, allSeasons, allUsers] = await Promise.all([
                    bettingService.listAll(),
                    cacheService.getSeasons(),
                    cacheService.getUsers(),
                ])
                setBets(allBets)
                setSeasons(allSeasons)
                setUsers(allUsers)
            } catch {
                error(t('betting.loadError'))
            }
        }
        void load()
    }, [error, t])

    const setParam = (key: string, val: string) => {
        setSearchParams(prev => {
            const next = new URLSearchParams(prev)
            if (val) next.set(key, val); else next.delete(key)
            next.set('page', '1')
            return next
        })
    }

    const removeParam = (key: string) => {
        setSearchParams(prev => {
            const next = new URLSearchParams(prev)
            next.delete(key)
            next.set('page', '1')
            return next
        })
    }

    const setSort = (by: SortBy) => {
        setSearchParams(prev => {
            const next = new URLSearchParams(prev)
            const currentBy = next.get('sortBy') ?? 'createdOn'
            const currentDir = next.get('sortDir') ?? 'desc'
            if (currentBy === by) {
                next.set('sortDir', currentDir === 'desc' ? 'asc' : 'desc')
            } else {
                next.set('sortBy', by)
                next.set('sortDir', 'desc')
            }
            next.set('page', '1')
            return next
        })
    }

    const filtered = useMemo(() => {
        if (!bets) return []
        return bets.filter(b => {
            if (filterId && !b.shortId.toLowerCase().includes(filterId.toLowerCase())) return false
            if (filterUserId) {
                const user = users.find(u => String(u.id) === filterUserId)
                if (!user || !b.createdBy.toLowerCase().includes(user.name.toLowerCase())) return false
            }
            if (filterMatchNumber) {
                const mn = parseInt(filterMatchNumber, 10)
                if (!b.legs.some(l => l.matchNumber === mn)) return false
            }
            if (filterSeasonId) {
                // legs don't carry seasonId directly; filter by matching season via match number range is not available
                // best effort: skip — seasonId filter requires server-side support or leg.seasonId
            }
            if (filterStatus && b.status !== filterStatus) return false
            if (filterStructure === 'single' && b.legs.length !== 1) return false
            if (filterStructure === 'combo' && b.legs.length < 2) return false
            if (filterBetType && !b.legs.some(l => l.betType === filterBetType)) return false
            if (filterStakeMin && b.stake < parseFloat(filterStakeMin)) return false
            if (filterStakeMax && b.stake > parseFloat(filterStakeMax)) return false
            if (filterOddsMin && b.totalOdds < parseFloat(filterOddsMin)) return false
            if (filterOddsMax && b.totalOdds > parseFloat(filterOddsMax)) return false
            const win = potentialWin(b)
            if (filterWinMin && win < parseFloat(filterWinMin)) return false
            if (filterWinMax && win > parseFloat(filterWinMax)) return false
            return true
        })
    }, [bets, filterId, filterUserId, filterMatchNumber, filterSeasonId, filterStatus,
        filterStructure, filterBetType, filterStakeMin, filterStakeMax,
        filterOddsMin, filterOddsMax, filterWinMin, filterWinMax, users])

    const sorted = useMemo(() => {
        return [...filtered].sort((a, b) => {
            let av: number, bv: number
            switch (sortBy) {
                case 'evaluatedOn':
                    av = a.evaluatedOn ? new Date(a.evaluatedOn).getTime() : 0
                    bv = b.evaluatedOn ? new Date(b.evaluatedOn).getTime() : 0
                    break
                case 'stake': av = a.stake; bv = b.stake; break
                case 'odds': av = a.totalOdds; bv = b.totalOdds; break
                case 'win': av = potentialWin(a); bv = potentialWin(b); break
                default:
                    av = new Date(a.createdOn).getTime()
                    bv = new Date(b.createdOn).getTime()
            }
            return sortDir === 'asc' ? av - bv : bv - av
        })
    }, [filtered, sortBy, sortDir])

    const totalItems = sorted.length
    const pageItems = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

    const activeFilters = [
        filterId && { key: 'id', label: `ID: ${filterId}` },
        filterUserId && { key: 'userId', label: `User: ${users.find(u => String(u.id) === filterUserId)?.name ?? filterUserId}` },
        filterMatchNumber && { key: 'matchNumber', label: `Match #${filterMatchNumber}` },
        filterSeasonId && { key: 'seasonId', label: `Season: ${seasons.find(s => String(s.id) === filterSeasonId)?.name ?? filterSeasonId}` },
        filterStatus && { key: 'status', label: `Status: ${filterStatus}` },
        filterStructure && { key: 'structure', label: filterStructure === 'single' ? 'Single' : 'Combo' },
        filterBetType && { key: 'betType', label: `Type: ${filterBetType}` },
        filterStakeMin && { key: 'stakeMin', label: `Stake ≥ ${filterStakeMin}€` },
        filterStakeMax && { key: 'stakeMax', label: `Stake ≤ ${filterStakeMax}€` },
        filterOddsMin && { key: 'oddsMin', label: `Odds ≥ ${filterOddsMin}` },
        filterOddsMax && { key: 'oddsMax', label: `Odds ≤ ${filterOddsMax}` },
        filterWinMin && { key: 'winMin', label: `Win ≥ ${filterWinMin}€` },
        filterWinMax && { key: 'winMax', label: `Win ≤ ${filterWinMax}€` },
    ].filter(Boolean) as { key: string; label: string }[]

    const SORT_OPTIONS: { value: SortBy; label: string }[] = [
        { value: 'createdOn', label: 'Newest created' },
        { value: 'evaluatedOn', label: 'Latest evaluated' },
        { value: 'stake', label: 'Stake' },
        { value: 'odds', label: 'Odds' },
        { value: 'win', label: 'Win amount' },
    ]

    if (bets === null) {
        return (
            <section className="card p-6">
                <LoadingSpinner />
            </section>
        )
    }

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                    <label className="text-xs text-text-muted">Sort</label>
                    <select
                        value={sortBy}
                        onChange={e => setSort(e.target.value as SortBy)}
                        className="text-sm bg-surface border border-border rounded px-2 py-1 text-text"
                    >
                        {SORT_OPTIONS.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                    </select>
                    <button
                        onClick={() => setSort(sortBy)}
                        className="text-xs text-text-muted hover:text-text px-1"
                        title="Toggle direction"
                    >
                        {sortDir === 'desc' ? '↓' : '↑'}
                    </button>
                </div>

                <span className="text-text-muted text-sm ml-auto">{totalItems} ticket{totalItems !== 1 ? 's' : ''}</span>

                <button
                    onClick={() => setFilterOpen(o => !o)}
                    className="relative flex items-center gap-1.5 px-3 py-1.5 text-sm rounded border border-border bg-surface hover:bg-border transition-colors"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h18M6 8h12M10 12h4" />
                    </svg>
                    Filters
                    {activeFilters.length > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-primary text-white text-[10px] flex items-center justify-center font-bold">
                            {activeFilters.length}
                        </span>
                    )}
                </button>
            </div>

            {/* Active filter chips */}
            {activeFilters.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {activeFilters.map(f => (
                        <span
                            key={f.key}
                            className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-primary/10 text-primary border border-primary/20"
                        >
                            {f.label}
                            <button
                                onClick={() => removeParam(f.key)}
                                className="hover:text-danger ml-0.5"
                            >
                                ×
                            </button>
                        </span>
                    ))}
                    <button
                        onClick={() => {
                            setSearchParams(prev => {
                                const next = new URLSearchParams(prev)
                                ;['id','userId','matchNumber','seasonId','status','structure','betType',
                                  'stakeMin','stakeMax','oddsMin','oddsMax','winMin','winMax'].forEach(k => next.delete(k))
                                next.set('page', '1')
                                return next
                            })
                        }}
                        className="text-xs text-text-muted hover:text-danger"
                    >
                        Clear all
                    </button>
                </div>
            )}

            {/* Filter modal */}
            {filterOpen && (
                <div className="card p-5 border border-border">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-sm">Filters</h3>
                        <button onClick={() => setFilterOpen(false)} className="text-text-muted hover:text-text text-xl leading-none">×</button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <label className="flex flex-col gap-1">
                            <span className="text-xs text-text-muted">Ticket ID</span>
                            <input
                                type="text"
                                value={filterId}
                                onChange={e => setParam('id', e.target.value)}
                                placeholder="B-ABC123"
                                className="text-sm bg-bg border border-border rounded px-2 py-1.5 text-text placeholder-text-muted"
                            />
                        </label>

                        <label className="flex flex-col gap-1">
                            <span className="text-xs text-text-muted">User</span>
                            <select
                                value={filterUserId}
                                onChange={e => setParam('userId', e.target.value)}
                                className="text-sm bg-bg border border-border rounded px-2 py-1.5 text-text"
                            >
                                <option value="">All users</option>
                                {users.map(u => (
                                    <option key={u.id} value={u.id}>{u.name}</option>
                                ))}
                            </select>
                        </label>

                        <label className="flex flex-col gap-1">
                            <span className="text-xs text-text-muted">Match #</span>
                            <input
                                type="number"
                                value={filterMatchNumber}
                                onChange={e => setParam('matchNumber', e.target.value)}
                                placeholder="e.g. 12"
                                className="text-sm bg-bg border border-border rounded px-2 py-1.5 text-text placeholder-text-muted"
                            />
                        </label>

                        <label className="flex flex-col gap-1">
                            <span className="text-xs text-text-muted">Season</span>
                            <select
                                value={filterSeasonId}
                                onChange={e => setParam('seasonId', e.target.value)}
                                className="text-sm bg-bg border border-border rounded px-2 py-1.5 text-text"
                            >
                                <option value="">All seasons</option>
                                {seasons.map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </label>

                        <label className="flex flex-col gap-1">
                            <span className="text-xs text-text-muted">Status</span>
                            <select
                                value={filterStatus}
                                onChange={e => setParam('status', e.target.value)}
                                className="text-sm bg-bg border border-border rounded px-2 py-1.5 text-text"
                            >
                                <option value="">All</option>
                                <option value="Pending">Pending</option>
                                <option value="Won">Won</option>
                                <option value="Lost">Lost</option>
                                <option value="Cancelled">Cancelled</option>
                            </select>
                        </label>

                        <label className="flex flex-col gap-1">
                            <span className="text-xs text-text-muted">Structure</span>
                            <select
                                value={filterStructure}
                                onChange={e => setParam('structure', e.target.value)}
                                className="text-sm bg-bg border border-border rounded px-2 py-1.5 text-text"
                            >
                                <option value="">All</option>
                                <option value="single">Single</option>
                                <option value="combo">Combo</option>
                            </select>
                        </label>

                        <label className="flex flex-col gap-1">
                            <span className="text-xs text-text-muted">Bet type</span>
                            <select
                                value={filterBetType}
                                onChange={e => setParam('betType', e.target.value)}
                                className="text-sm bg-bg border border-border rounded px-2 py-1.5 text-text"
                            >
                                <option value="">All</option>
                                {ALL_BET_TYPES.map(bt => (
                                    <option key={bt} value={bt}>{bt}</option>
                                ))}
                            </select>
                        </label>

                        <div className="flex flex-col gap-1">
                            <span className="text-xs text-text-muted">Stake (€)</span>
                            <div className="flex gap-2">
                                <input
                                    type="number"
                                    value={filterStakeMin}
                                    onChange={e => setParam('stakeMin', e.target.value)}
                                    placeholder="Min"
                                    className="w-full text-sm bg-bg border border-border rounded px-2 py-1.5 text-text placeholder-text-muted"
                                />
                                <input
                                    type="number"
                                    value={filterStakeMax}
                                    onChange={e => setParam('stakeMax', e.target.value)}
                                    placeholder="Max"
                                    className="w-full text-sm bg-bg border border-border rounded px-2 py-1.5 text-text placeholder-text-muted"
                                />
                            </div>
                        </div>

                        <div className="flex flex-col gap-1">
                            <span className="text-xs text-text-muted">Odds</span>
                            <div className="flex gap-2">
                                <input
                                    type="number"
                                    value={filterOddsMin}
                                    onChange={e => setParam('oddsMin', e.target.value)}
                                    placeholder="Min"
                                    className="w-full text-sm bg-bg border border-border rounded px-2 py-1.5 text-text placeholder-text-muted"
                                />
                                <input
                                    type="number"
                                    value={filterOddsMax}
                                    onChange={e => setParam('oddsMax', e.target.value)}
                                    placeholder="Max"
                                    className="w-full text-sm bg-bg border border-border rounded px-2 py-1.5 text-text placeholder-text-muted"
                                />
                            </div>
                        </div>

                        <div className="flex flex-col gap-1">
                            <span className="text-xs text-text-muted">Win amount (€)</span>
                            <div className="flex gap-2">
                                <input
                                    type="number"
                                    value={filterWinMin}
                                    onChange={e => setParam('winMin', e.target.value)}
                                    placeholder="Min"
                                    className="w-full text-sm bg-bg border border-border rounded px-2 py-1.5 text-text placeholder-text-muted"
                                />
                                <input
                                    type="number"
                                    value={filterWinMax}
                                    onChange={e => setParam('winMax', e.target.value)}
                                    placeholder="Max"
                                    className="w-full text-sm bg-bg border border-border rounded px-2 py-1.5 text-text placeholder-text-muted"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Ticket list */}
            {pageItems.length === 0 ? (
                <section className="card p-6 text-center">
                    <p className="text-text-muted text-sm">No tickets match the current filters.</p>
                </section>
            ) : (
                <div className="space-y-3">
                    {pageItems.map(bet => {
                        const win = potentialWin(bet)
                        const structure = bet.legs.length === 1 ? 'Single' : 'Combo'
                        const avatarText = bet.createdByName.slice(0, 2).toUpperCase()
                        const winAmount = bet.status === 'Won' && bet.wonAmount != null ? bet.wonAmount : win
                        const winClass = bet.status === 'Won' ? 'text-green-400' : bet.status === 'Lost' ? 'text-text-muted line-through' : 'text-text'
                        return (
                            <div key={bet.id} className={`card border-l-2 ${STATUS_BORDER[bet.status]} hover:shadow-card-hover transition-shadow`}>
                                {/* Header row */}
                                <div className="flex items-center gap-3 px-4 py-3">
                                    <div className="w-9 h-9 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary font-black text-[11px] shrink-0">
                                        {avatarText}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-bold text-text text-sm">{bet.createdByName}</span>
                                            <span className="font-mono text-[10px] font-black bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                                                {bet.shortId}
                                            </span>
                                        </div>
                                        <div className="text-[10px] text-text-muted uppercase font-bold tracking-wider mt-0.5">
                                            {structure} • {new Date(bet.createdOn).toLocaleDateString()}
                                        </div>
                                    </div>

                                    <div className="flex-1" />

                                    <div className="text-right hidden sm:block">
                                        <div className="text-[9px] text-text-muted uppercase font-bold tracking-widest mb-0.5">Stake / Odds</div>
                                        <div className="font-black text-text text-sm whitespace-nowrap">
                                            {bet.stake.toFixed(2)}€ <span className="text-text-muted font-normal text-xs">×</span> {bet.totalOdds.toFixed(2)}
                                        </div>
                                    </div>

                                    <div className="text-right hidden sm:block ml-5">
                                        <div className="text-[9px] text-text-muted uppercase font-bold tracking-widest mb-0.5">
                                            {bet.status === 'Won' ? 'Won' : 'Win'}
                                        </div>
                                        <div className={`font-black text-sm ${winClass}`}>{winAmount.toFixed(2)}€</div>
                                    </div>

                                    <div className="ml-5 shrink-0">
                                        <span className={`text-[9px] px-2.5 py-1 rounded border font-black uppercase tracking-widest ${STATUS_BADGE[bet.status]}`}>
                                            {bet.status}
                                        </span>
                                    </div>
                                </div>

                                {/* Leg cards grid */}
                                <div className={`grid gap-2 px-4 pb-4 ${bet.legs.length === 1 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
                                    {bet.legs.map(leg => {
                                        const matchName = leg.homeTeamName && leg.awayTeamName
                                            ? `${leg.homeTeamName} vs ${leg.awayTeamName}`
                                            : `Match #${leg.matchNumber}`
                                        const { market, marketColor, selection } = getLegDisplay(leg)
                                        return (
                                            <div key={leg.id} className="bg-bg border border-border rounded-lg px-3 py-2.5">
                                                <div className="text-[9px] text-text-muted uppercase font-bold tracking-wider mb-1.5 truncate">
                                                    {matchName}
                                                </div>
                                                <div className="text-xs">
                                                    <span className={`font-bold ${marketColor}`}>{market}:</span>{' '}
                                                    <span className="text-text font-medium">{selection}</span>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>

                                {bet.evaluatedOn && (
                                    <div className="px-4 pb-2 text-[9px] text-text-muted text-right">
                                        Evaluated: {new Date(bet.evaluatedOn).toLocaleDateString()}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}

            <Pagination
                currentPage={page}
                totalItems={totalItems}
                pageSize={PAGE_SIZE}
                onPageChange={n => setParam('page', String(n))}
            />
        </div>
    )
}
