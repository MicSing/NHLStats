import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import { bettingService } from '../../services/bettingService'
import { cacheService } from '../../services/cacheService'
import Pagination from '../Pagination'
import LoadingSpinner from '../LoadingSpinner'
import StatusBadge from '../StatusBadge'
import type { BetDto, BetLegDto, BetStatus, LegStatus, ApiBetType } from '../../types/bet'
import type { Season } from '../../types/season'
import type { User } from '../../types/user'
import type { WeekGroup } from '../../types/stats'

interface WeekInfo {
    seasonId: number
    weekNumber: number
    date: string
}

const PAGE_SIZE = 10

type SortBy = 'createdOn' | 'evaluatedOn' | 'stake' | 'odds' | 'win'
type SortDir = 'asc' | 'desc'


const ALL_BET_TYPES: ApiBetType[] = [
    'TeamWin', 'TeamWinOrDraw', 'TeamDraw',
    'UserGoal', 'UserPenalty', 'UserPlusPoint', 'UserMinusPoint',
    'MatchTotalGoals', 'HostedShutoutWin', 'OpponentShutoutWin',
]

const STATUS_BORDER: Record<BetStatus, string> = {
    Pending: 'border-l-blue-500',
    Won: 'border-l-green-500',
    Lost: 'border-l-red-500',
    Cancelled: 'border-l-gray-600',
}

const LEG_STATUS_DOT: Record<LegStatus, string> = {
    Pending:   'bg-blue-400',
    Won:       'bg-green-500',
    Lost:      'bg-red-500',
    Cancelled: 'bg-gray-500',
}

function getLegDisplay(leg: BetLegDto): { marketKey: string; marketColor: string; selection: string } {
    const occSuffix = leg.occasions > 1 ? ` (${leg.occasions}+)` : ''
    switch (leg.betType) {
        case 'TeamWin':
        case 'TeamWinOrDraw':
            return { marketKey: 'betting.match', marketColor: 'text-primary', selection: leg.targetName ?? '?' }
        case 'TeamDraw':
            return { marketKey: 'betting.drawLabel', marketColor: 'text-text-muted', selection: 'X' }
        case 'UserGoal':
            return { marketKey: 'betting.goals', marketColor: 'text-green-400', selection: `${leg.targetName ?? '?'}${occSuffix}` }
        case 'UserPenalty':
            return { marketKey: 'betting.penalties', marketColor: 'text-red-400', selection: `${leg.targetName ?? '?'}${occSuffix}` }
        case 'UserPlusPoint':
            return { marketKey: 'betting.tickets.plus', marketColor: 'text-green-400', selection: `${leg.targetName ?? '?'}${occSuffix}` }
        case 'UserMinusPoint':
            return { marketKey: 'betting.tickets.minus', marketColor: 'text-orange-400', selection: `${leg.targetName ?? '?'}${occSuffix}` }
        case 'MatchTotalGoals':
            return { marketKey: 'betting.totalGoals', marketColor: 'text-purple-400', selection: `${leg.occasions}+` }
        case 'HostedShutoutWin':
        case 'OpponentShutoutWin':
            return { marketKey: 'betting.tickets.bet', marketColor: 'text-cyan-400', selection: leg.targetName ?? '?' }
        default:
            return { marketKey: 'betting.tickets.bet', marketColor: 'text-text-muted', selection: leg.targetName ?? '?' }
    }
}

function potentialWin(bet: BetDto): number {
    return bet.stake * bet.totalOdds
}

function weekKey(seasonId: number, weekNumber: number): string {
    return `${seasonId}:${weekNumber}`
}

interface TicketsTabProps {
    refreshKey?: number
}

export default function TicketsTab({ refreshKey }: TicketsTabProps) {
    const { t } = useTranslation()
    const { error } = useToast()
    const { user } = useAuth()
    const currentLoginId = user?.id ?? null
    const [searchParams, setSearchParams] = useSearchParams()

    const [bets, setBets] = useState<BetDto[] | null>(null)
    const [seasons, setSeasons] = useState<Season[]>([])
    const [users, setUsers] = useState<User[]>([])
    const [matchWeekMap, setMatchWeekMap] = useState<Map<number, WeekInfo>>(new Map())
    const [filterOpen, setFilterOpen] = useState(false)

    // Read all filter state from URL
    const p = searchParams
    const filterId = p.get('id') ?? ''
    const filterUserId = p.get('userId') ?? ''
    const filterMatchNumber = p.get('matchNumber') ?? ''
    const filterSeasonId = p.get('seasonId') ?? ''
    const filterWeek = p.get('week') ?? ''
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

                const seasonIds = [...new Set(allBets.flatMap(b => b.legs.map(l => l.seasonId)))]
                const weekGroupsBySeason = await Promise.all(
                    seasonIds.map(id => cacheService.getSeasonWeeklyGroups(id).catch(() => [] as WeekGroup[])),
                )
                const weekMap = new Map<number, WeekInfo>()
                seasonIds.forEach((seasonId, i) => {
                    weekGroupsBySeason[i].forEach(group => {
                        group.matches.forEach(m => {
                            weekMap.set(m.matchId, { seasonId, weekNumber: group.weekNumber, date: m.matchDate })
                        })
                    })
                })
                setMatchWeekMap(weekMap)
            } catch {
                error(t('betting.loadError'))
            }
        }
        void load()
    }, [error, t])

    useEffect(() => {
        if (!refreshKey) return
        bettingService.listAll().then(setBets).catch(() => { /* silent */ })
    }, [refreshKey])

    const setParam = (key: string, val: string) => {
        setSearchParams(prev => {
            const next = new URLSearchParams(prev)
            if (val) next.set(key, val); else next.delete(key)
            if (key !== 'page') next.set('page', '1')
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
                if (!user || !b.createdByName.toLowerCase().includes(user.name.toLowerCase())) return false
            }
            if (filterMatchNumber) {
                const mn = parseInt(filterMatchNumber, 10)
                if (!b.legs.some(l => l.matchNumber === mn)) return false
            }
            if (filterSeasonId) {
                const sid = parseInt(filterSeasonId, 10)
                if (!b.legs.some(l => l.seasonId === sid)) return false
            }
            if (filterWeek) {
                if (!b.legs.some(l => {
                    const info = matchWeekMap.get(l.matchId)
                    return info != null && weekKey(info.seasonId, info.weekNumber) === filterWeek
                })) return false
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
    }, [bets, filterId, filterUserId, filterMatchNumber, filterSeasonId, filterWeek, filterStatus,
        filterStructure, filterBetType, filterStakeMin, filterStakeMax,
        filterOddsMin, filterOddsMax, filterWinMin, filterWinMax, users, currentLoginId, matchWeekMap])

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

    const weekOptions = useMemo(() => {
        const byKey = new Map<string, WeekInfo>()
        bets?.forEach(b => b.legs.forEach(l => {
            const info = matchWeekMap.get(l.matchId)
            if (info) byKey.set(weekKey(info.seasonId, info.weekNumber), info)
        }))
        return [...byKey.entries()].sort((a, b) => new Date(b[1].date).getTime() - new Date(a[1].date).getTime())
    }, [bets, matchWeekMap])

    const totalItems = sorted.length
    const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE))
    const safePage = Math.min(Math.max(1, page), totalPages)
    const pageItems = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

    const activeFilters = [
        filterId && { key: 'id', label: t('betting.tickets.chipId', { value: filterId }) },
        filterUserId && { key: 'userId', label: t('betting.tickets.chipUser', { value: users.find(u => String(u.id) === filterUserId)?.name ?? filterUserId }) },
        filterMatchNumber && { key: 'matchNumber', label: t('betting.tickets.chipMatch', { value: filterMatchNumber }) },
        filterSeasonId && { key: 'seasonId', label: t('betting.tickets.chipSeason', { value: seasons.find(s => String(s.id) === filterSeasonId)?.name ?? filterSeasonId }) },
        filterWeek && { key: 'week', label: t('betting.tickets.chipWeek', { value: weekOptions.find(([k]) => k === filterWeek)?.[1].weekNumber ?? filterWeek }) },
        filterStatus && { key: 'status', label: t('betting.tickets.chipStatus', { value: filterStatus }) },
        filterStructure && { key: 'structure', label: filterStructure === 'single' ? t('betting.tickets.single') : t('betting.tickets.combo') },
        filterBetType && { key: 'betType', label: t('betting.tickets.chipType', { value: filterBetType }) },
        filterStakeMin && { key: 'stakeMin', label: t('betting.tickets.chipStakeMin', { value: filterStakeMin }) },
        filterStakeMax && { key: 'stakeMax', label: t('betting.tickets.chipStakeMax', { value: filterStakeMax }) },
        filterOddsMin && { key: 'oddsMin', label: t('betting.tickets.chipOddsMin', { value: filterOddsMin }) },
        filterOddsMax && { key: 'oddsMax', label: t('betting.tickets.chipOddsMax', { value: filterOddsMax }) },
        filterWinMin && { key: 'winMin', label: t('betting.tickets.chipWinMin', { value: filterWinMin }) },
        filterWinMax && { key: 'winMax', label: t('betting.tickets.chipWinMax', { value: filterWinMax }) },
    ].filter(Boolean) as { key: string; label: string }[]

    const SORT_OPTIONS: { value: SortBy; label: string }[] = [
        { value: 'createdOn', label: t('betting.tickets.sortNewest') },
        { value: 'evaluatedOn', label: t('betting.tickets.sortEvaluated') },
        { value: 'stake', label: t('betting.stake') },
        { value: 'odds', label: t('betting.oddsLabel') },
        { value: 'win', label: t('betting.tickets.sortWin') },
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
                    <label className="text-xs text-text-muted">{t('betting.tickets.sort')}</label>
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

                <span className="text-text-muted text-sm ml-auto">{t('betting.tickets.count', { count: totalItems })}</span>

                <button
                    onClick={() => setFilterOpen(o => !o)}
                    className="relative flex items-center gap-1.5 px-3 py-1.5 text-sm rounded border border-border bg-surface hover:bg-border transition-colors"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h18M6 8h12M10 12h4" />
                    </svg>
                    {t('betting.tickets.filters')}
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
                                ;['id','userId','matchNumber','seasonId','week','status','structure','betType',
                                  'stakeMin','stakeMax','oddsMin','oddsMax','winMin','winMax'].forEach(k => next.delete(k))
                                next.set('page', '1')
                                return next
                            })
                        }}
                        className="text-xs text-text-muted hover:text-danger"
                    >
                        {t('betting.tickets.clearAll')}
                    </button>
                </div>
            )}

            {/* Filter modal */}
            {filterOpen && (
                <div className="card p-5 border border-border">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-sm">{t('betting.tickets.filters')}</h3>
                        <button onClick={() => setFilterOpen(false)} className="text-text-muted hover:text-text text-xl leading-none">×</button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <label className="flex flex-col gap-1">
                            <span className="text-xs text-text-muted">{t('betting.tickets.ticketId')}</span>
                            <input
                                type="text"
                                value={filterId}
                                onChange={e => setParam('id', e.target.value)}
                                placeholder="B-ABC123"
                                className="text-sm bg-bg border border-border rounded px-2 py-1.5 text-text placeholder-text-muted"
                            />
                        </label>

                        <label className="flex flex-col gap-1">
                            <span className="text-xs text-text-muted">{t('betting.tickets.user')}</span>
                            <select
                                value={filterUserId}
                                onChange={e => setParam('userId', e.target.value)}
                                className="text-sm bg-bg border border-border rounded px-2 py-1.5 text-text"
                            >
                                <option value="">{t('betting.tickets.allUsers')}</option>
                                {users.map(u => (
                                    <option key={u.id} value={u.id}>{u.name}</option>
                                ))}
                            </select>
                        </label>

                        <label className="flex flex-col gap-1">
                            <span className="text-xs text-text-muted">{t('betting.tickets.matchNum')}</span>
                            <input
                                type="number"
                                value={filterMatchNumber}
                                onChange={e => setParam('matchNumber', e.target.value)}
                                placeholder="e.g. 12"
                                className="text-sm bg-bg border border-border rounded px-2 py-1.5 text-text placeholder-text-muted"
                            />
                        </label>

                        <label className="flex flex-col gap-1">
                            <span className="text-xs text-text-muted">{t('betting.tickets.season')}</span>
                            <select
                                value={filterSeasonId}
                                onChange={e => setParam('seasonId', e.target.value)}
                                className="text-sm bg-bg border border-border rounded px-2 py-1.5 text-text"
                            >
                                <option value="">{t('betting.tickets.allSeasons')}</option>
                                {seasons.map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </label>

                        <label className="flex flex-col gap-1">
                            <span className="text-xs text-text-muted">{t('betting.tickets.week')}</span>
                            <select
                                value={filterWeek}
                                onChange={e => setParam('week', e.target.value)}
                                className="text-sm bg-bg border border-border rounded px-2 py-1.5 text-text"
                            >
                                <option value="">{t('betting.tickets.allWeeks')}</option>
                                {weekOptions.map(([key, info]) => (
                                    <option key={key} value={key}>
                                        {t('betting.tickets.weekLabel', { week: info.weekNumber, date: new Date(info.date).toLocaleDateString() })}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="flex flex-col gap-1">
                            <span className="text-xs text-text-muted">{t('betting.tickets.status')}</span>
                            <select
                                value={filterStatus}
                                onChange={e => setParam('status', e.target.value)}
                                className="text-sm bg-bg border border-border rounded px-2 py-1.5 text-text"
                            >
                                <option value="">{t('betting.tickets.all')}</option>
                                <option value="Pending">{t('betting.outcomePending')}</option>
                                <option value="Won">{t('betting.outcomeWon')}</option>
                                <option value="Lost">{t('betting.outcomeLost')}</option>
                                <option value="Cancelled">{t('betting.outcomeCancelled')}</option>
                            </select>
                        </label>

                        <label className="flex flex-col gap-1">
                            <span className="text-xs text-text-muted">{t('betting.tickets.structure')}</span>
                            <select
                                value={filterStructure}
                                onChange={e => setParam('structure', e.target.value)}
                                className="text-sm bg-bg border border-border rounded px-2 py-1.5 text-text"
                            >
                                <option value="">{t('betting.tickets.all')}</option>
                                <option value="single">{t('betting.tickets.single')}</option>
                                <option value="combo">{t('betting.tickets.combo')}</option>
                            </select>
                        </label>

                        <label className="flex flex-col gap-1">
                            <span className="text-xs text-text-muted">{t('betting.tickets.betType')}</span>
                            <select
                                value={filterBetType}
                                onChange={e => setParam('betType', e.target.value)}
                                className="text-sm bg-bg border border-border rounded px-2 py-1.5 text-text"
                            >
                                <option value="">{t('betting.tickets.all')}</option>
                                {ALL_BET_TYPES.map(bt => (
                                    <option key={bt} value={bt}>{t(`betting.tickets.betTypes.${bt}`)}</option>
                                ))}
                            </select>
                        </label>

                        <div className="flex flex-col gap-1">
                            <span className="text-xs text-text-muted">{t('betting.stakeLabel')}</span>
                            <div className="flex gap-2">
                                <input
                                    type="number"
                                    value={filterStakeMin}
                                    onChange={e => setParam('stakeMin', e.target.value)}
                                    placeholder={t('betting.tickets.min')}
                                    className="w-full text-sm bg-bg border border-border rounded px-2 py-1.5 text-text placeholder-text-muted"
                                    />
                                <input
                                    type="number"
                                    value={filterStakeMax}
                                    onChange={e => setParam('stakeMax', e.target.value)}
                                    placeholder={t('betting.tickets.max')}
                                    className="w-full text-sm bg-bg border border-border rounded px-2 py-1.5 text-text placeholder-text-muted"
                                />
                            </div>
                        </div>

                        <div className="flex flex-col gap-1">
                            <span className="text-xs text-text-muted">{t('betting.oddsLabel')}</span>
                            <div className="flex gap-2">
                                <input
                                    type="number"
                                    value={filterOddsMin}
                                    onChange={e => setParam('oddsMin', e.target.value)}
                                    placeholder={t('betting.tickets.min')}
                                    className="w-full text-sm bg-bg border border-border rounded px-2 py-1.5 text-text placeholder-text-muted"
                                />
                                <input
                                    type="number"
                                    value={filterOddsMax}
                                    onChange={e => setParam('oddsMax', e.target.value)}
                                    placeholder={t('betting.tickets.max')}
                                    className="w-full text-sm bg-bg border border-border rounded px-2 py-1.5 text-text placeholder-text-muted"
                                />
                            </div>
                        </div>

                        <div className="flex flex-col gap-1">
                            <span className="text-xs text-text-muted">{t('betting.tickets.winAmountEur')}</span>
                            <div className="flex gap-2">
                                <input
                                    type="number"
                                    value={filterWinMin}
                                    onChange={e => setParam('winMin', e.target.value)}
                                    placeholder={t('betting.tickets.min')}
                                    className="w-full text-sm bg-bg border border-border rounded px-2 py-1.5 text-text placeholder-text-muted"
                                />
                                <input
                                    type="number"
                                    value={filterWinMax}
                                    onChange={e => setParam('winMax', e.target.value)}
                                    placeholder={t('betting.tickets.max')}
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
                    <p className="text-text-muted text-sm">{t('betting.tickets.noMatch')}</p>
                </section>
            ) : (
                <div className="space-y-3">
                    {pageItems.map(bet => {
                        const win = potentialWin(bet)
                        const structure = bet.legs.length === 1 ? t('betting.tickets.single') : t('betting.tickets.combo')
                        const avatarText = bet.createdByName.slice(0, 2).toUpperCase()
                        const winAmount = bet.status === 'Won' && bet.wonAmount != null ? bet.wonAmount : win
                        const winClass = bet.status === 'Won' ? 'text-green-400' : bet.status === 'Lost' ? 'text-text-muted line-through' : 'text-text'
                        const isAnon = bet.legs.some(l => l.isAnonymized)
                        const netProfit = bet.status === 'Won'
                            ? (bet.wonAmount != null ? bet.wonAmount : win) - bet.stake
                            : bet.status === 'Lost'
                                ? -bet.stake
                                : bet.status === 'Cancelled'
                                    ? 0
                                    : win - bet.stake
                        return (
                            <div key={bet.id} className={`card border-l-2 ${STATUS_BORDER[bet.status]} hover:shadow-card-hover transition-shadow`}>
                                {/* Header */}
                                <div className="p-3 sm:p-4 border-b border-border flex flex-col gap-2.5">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary font-black text-[10px] sm:text-[11px] shrink-0">
                                                {avatarText}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                                                    <span className="font-bold text-text text-xs sm:text-sm truncate">{bet.createdByName}</span>
                                                    <span className="font-mono text-[9px] sm:text-[10px] font-black bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                                                        {bet.shortId}
                                                    </span>
                                                </div>
                                                <div className="text-[9px] sm:text-[10px] text-text-muted uppercase font-bold tracking-wider mt-0.5 truncate">
                                                    {structure} • {new Date(bet.createdOn).toLocaleDateString()}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3 shrink-0">
                                            <div className="text-right hidden sm:block">
                                                <div className="text-[9px] text-text-muted uppercase font-bold tracking-widest mb-0.5">{t('betting.tickets.stakeOdds')}</div>
                                                <div className="font-black text-text text-sm whitespace-nowrap">
                                                    {bet.stake.toFixed(2)}€ <span className="text-text-muted font-normal text-xs">×</span>{' '}
                                                    {isAnon
                                                        ? <span className="blur-sm select-none">?.??</span>
                                                        : bet.totalOdds.toFixed(2)
                                                    }
                                                </div>
                                            </div>

                                            <div className="text-right hidden sm:block ml-2">
                                                <div className="text-[9px] text-text-muted uppercase font-bold tracking-widest mb-0.5">
                                                    {bet.status === 'Won' ? t('betting.tickets.won') : t('betting.tickets.win')}
                                                </div>
                                                <div className={`font-black text-sm ${winClass}`}>
                                                    {isAnon
                                                        ? <span className="blur-sm select-none">?.??€</span>
                                                        : `${winAmount.toFixed(2)}€`
                                                    }
                                                </div>
                                                <div className="text-[10px] text-text-muted font-medium mt-0.5 whitespace-nowrap">
                                                    {isAnon ? (
                                                        <span className="blur-sm select-none">({t('betting.tickets.profit')}: +?.??€)</span>
                                                    ) : bet.status === 'Won' ? (
                                                        <span>({t('betting.tickets.profit')}: <span className="text-green-400 font-semibold">+{netProfit.toFixed(2)}€</span>)</span>
                                                    ) : bet.status === 'Lost' ? (
                                                        <span>({t('betting.tickets.profit')}: <span className="text-danger font-semibold">−{bet.stake.toFixed(2)}€</span>)</span>
                                                    ) : bet.status === 'Cancelled' ? (
                                                        <span>({t('betting.tickets.profit')}: <span>0.00€</span>)</span>
                                                    ) : (
                                                        <span>({t('betting.tickets.profit')}: <span>+{Math.max(0, netProfit).toFixed(2)}€</span>)</span>
                                                    )}
                                                </div>
                                            </div>

                                            <StatusBadge status={bet.status} />
                                        </div>
                                    </div>

                                    {/* Mobile-only stats row */}
                                    <div className="flex sm:hidden items-center justify-between bg-bg/60 border border-border/50 rounded-lg px-2.5 py-1.5 text-xs">
                                        <div>
                                            <span className="text-[10px] text-text-muted uppercase font-bold mr-1.5">{t('betting.tickets.stakeOdds')}:</span>
                                            <span className="font-bold text-text">
                                                {bet.stake.toFixed(2)}€ × {isAnon ? <span className="blur-sm select-none">?.??</span> : bet.totalOdds.toFixed(2)}
                                            </span>
                                        </div>
                                        <div className="text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <span className="text-[10px] text-text-muted uppercase font-bold">
                                                    {bet.status === 'Won' ? t('betting.tickets.won') : t('betting.tickets.win')}:
                                                </span>
                                                <span className={`font-bold ${winClass}`}>
                                                    {isAnon ? <span className="blur-sm select-none">?.??€</span> : `${winAmount.toFixed(2)}€`}
                                                </span>
                                            </div>
                                            <div className="text-[10px] text-text-muted font-medium mt-0.5">
                                                {isAnon ? (
                                                    <span className="blur-sm select-none">({t('betting.tickets.profit')}: +?.??€)</span>
                                                ) : bet.status === 'Won' ? (
                                                    <span>({t('betting.tickets.profit')}: <span className="text-green-400 font-semibold">+{netProfit.toFixed(2)}€</span>)</span>
                                                ) : bet.status === 'Lost' ? (
                                                    <span>({t('betting.tickets.profit')}: <span className="text-danger font-semibold">−{bet.stake.toFixed(2)}€</span>)</span>
                                                ) : bet.status === 'Cancelled' ? (
                                                    <span>({t('betting.tickets.profit')}: <span>0.00€</span>)</span>
                                                ) : (
                                                    <span>({t('betting.tickets.profit')}: <span>+{Math.max(0, netProfit).toFixed(2)}€</span>)</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Leg cards grid */}
                                <div className={`grid gap-2 px-4 pb-4 ${bet.legs.length === 1 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
                                    {bet.legs.map(leg => {
                                        if (leg.isAnonymized) {
                                            return (
                                                <div key={leg.id} className="bg-bg border border-border/50 rounded-lg px-3 py-2.5 relative overflow-hidden">
                                                    <div className="text-[9px] text-text-muted uppercase font-bold tracking-wider mb-1.5">
                                                        {leg.homeTeamName && leg.awayTeamName
                                                            ? `${leg.homeTeamName} vs ${leg.awayTeamName}`
                                                            : `Match #${leg.matchNumber}`}
                                                    </div>
                                                    <div className="blur-sm select-none text-transparent text-xs">
                                                        Hidden bet details here
                                                    </div>
                                                    <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center text-[10px] text-text-muted font-semibold pb-1.5">
                                                        {t('betting.tickets.revealedOnEval')}
                                                    </div>
                                                </div>
                                            )
                                        }
                                        const matchName = leg.homeTeamName && leg.awayTeamName
                                            ? `${leg.homeTeamName} vs ${leg.awayTeamName}`
                                            : `Match #${leg.matchNumber}`
                                        const { marketKey, marketColor, selection } = getLegDisplay(leg)
                                        return (
                                            <div key={leg.id} className="bg-bg border border-border rounded-lg px-3 py-2.5">
                                                <div className="flex items-center justify-between gap-2 mb-1.5">
                                                    <div className="text-[9px] text-text-muted uppercase font-bold tracking-wider truncate">
                                                        {matchName}
                                                    </div>
                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                        <span className="text-[10px] text-text-muted font-mono">{leg.odds.toFixed(2)}</span>
                                                        <span className={`w-2 h-2 rounded-full ${LEG_STATUS_DOT[leg.status]}`} />
                                                    </div>
                                                </div>
                                                <div className="text-xs">
                                                    <span className={`font-bold ${marketColor}`}>{t(marketKey)}:</span>{' '}
                                                    <span className="text-text font-medium">{selection}</span>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>

                                {bet.evaluatedOn && (
                                    <div className="px-4 pb-2 text-[9px] text-text-muted text-right">
                                        {t('betting.tickets.evaluated', { date: new Date(bet.evaluatedOn).toLocaleDateString() })}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}

            <Pagination
                currentPage={safePage}
                totalItems={totalItems}
                pageSize={PAGE_SIZE}
                onPageChange={n => setParam('page', String(n))}
            />
        </div>
    )
}
