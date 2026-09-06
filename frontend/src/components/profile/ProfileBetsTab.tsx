import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
    CaretDownIcon,
    CheckCircleIcon,
    XCircleIcon,
    ClockIcon,
    ProhibitIcon,
    FunnelIcon,
    ReceiptIcon,
    PercentIcon,
    XIcon,
    ArrowCounterClockwiseIcon,
} from '@phosphor-icons/react'
import { bettingService } from '../../services/bettingService'
import { cacheService } from '../../services/cacheService'
import { describeApiLeg } from '../betting/bettingTypes'
import type { BetDto, BetStatus, ApiBetType } from '../../types/bet'
import type { Season } from '../../types/season'
import type { WeekGroup } from '../../types/stats'
import LoadingSpinner from '../LoadingSpinner'

type FilterStatus = 'all' | BetStatus

interface WeekInfo {
    seasonId: number
    weekNumber: number
    date: string
}

const ALL_BET_TYPES: ApiBetType[] = [
    'TeamWin', 'TeamWinOrDraw', 'TeamDraw',
    'UserGoal', 'UserPenalty', 'UserPlusPoint', 'UserMinusPoint',
    'MatchTotalGoals', 'HostedShutoutWin', 'OpponentShutoutWin',
]

function potentialWin(bet: BetDto): number {
    return Math.round(bet.stake * bet.totalOdds * 100) / 100
}

function weekKey(seasonId: number, weekNumber: number): string {
    return `${seasonId}:${weekNumber}`
}

export default function ProfileBetsTab() {
    const { t } = useTranslation()
    const [bets, setBets] = useState<BetDto[] | null>(null)
    const [loading, setLoading] = useState(true)
    const [seasons, setSeasons] = useState<Season[]>([])
    const [matchWeekMap, setMatchWeekMap] = useState<Map<number, WeekInfo>>(new Map())
    const [expandedBetId, setExpandedBetId] = useState<string | null>(null)

    // Filter state
    const [filterModalOpen, setFilterModalOpen] = useState(false)
    const [filterId, setFilterId] = useState('')
    const [filterMatchNumber, setFilterMatchNumber] = useState('')
    const [filterSeasonId, setFilterSeasonId] = useState('')
    const [filterWeek, setFilterWeek] = useState('')
    const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
    const [filterStructure, setFilterStructure] = useState<'all' | 'single' | 'combo'>('all')
    const [filterBetType, setFilterBetType] = useState<ApiBetType | ''>('')
    const [filterStakeMin, setFilterStakeMin] = useState('')
    const [filterStakeMax, setFilterStakeMax] = useState('')
    const [filterOddsMin, setFilterOddsMin] = useState('')
    const [filterOddsMax, setFilterOddsMax] = useState('')
    const [filterWinMin, setFilterWinMin] = useState('')
    const [filterWinMax, setFilterWinMax] = useState('')

    useEffect(() => {
        let isMounted = true
        Promise.all([
            bettingService.listHistory(),
            cacheService.getSeasons().catch(() => [] as Season[]),
        ])
            .then(async ([historyBets, allSeasons]) => {
                if (!isMounted) return
                setBets(historyBets)
                setSeasons(allSeasons)
                setLoading(false)

                const seasonIds = [...new Set(historyBets.flatMap(b => b.legs.map(l => l.seasonId)))]
                const weekGroupsBySeason = await Promise.all(
                    seasonIds.map(id => cacheService.getSeasonWeeklyGroups(id).catch(() => [] as WeekGroup[])),
                )
                if (!isMounted) return
                const weekMap = new Map<number, WeekInfo>()
                seasonIds.forEach((seasonId, i) => {
                    weekGroupsBySeason[i]?.forEach(group => {
                        group.matches?.forEach(m => {
                            weekMap.set(m.matchId, { seasonId, weekNumber: group.weekNumber, date: m.matchDate })
                        })
                    })
                })
                setMatchWeekMap(weekMap)
            })
            .catch(() => {
                if (isMounted) setLoading(false)
            })
        return () => {
            isMounted = false
        }
    }, [])

    const toggleExpand = (id: string) => {
        setExpandedBetId((prev) => (prev === id ? null : id))
    }

    const weekOptions = useMemo(() => {
        const byKey = new Map<string, WeekInfo>()
        bets?.forEach(b => b.legs.forEach(l => {
            const info = matchWeekMap.get(l.matchId)
            if (info) byKey.set(weekKey(info.seasonId, info.weekNumber), info)
        }))
        return [...byKey.entries()].sort((a, b) => new Date(b[1].date).getTime() - new Date(a[1].date).getTime())
    }, [bets, matchWeekMap])

    const clearAllFilters = () => {
        setFilterId('')
        setFilterMatchNumber('')
        setFilterSeasonId('')
        setFilterWeek('')
        setFilterStatus('all')
        setFilterStructure('all')
        setFilterBetType('')
        setFilterStakeMin('')
        setFilterStakeMax('')
        setFilterOddsMin('')
        setFilterOddsMax('')
        setFilterWinMin('')
        setFilterWinMax('')
    }

    // Active filters
    const activeFilters = useMemo(() => {
        const list: { key: string; label: string; onRemove: () => void }[] = []
        if (filterId) {
            list.push({ key: 'id', label: `ID: ${filterId}`, onRemove: () => setFilterId('') })
        }
        if (filterMatchNumber) {
            list.push({ key: 'match', label: `#${filterMatchNumber}`, onRemove: () => setFilterMatchNumber('') })
        }
        if (filterSeasonId) {
            const sName = seasons.find(s => String(s.id) === filterSeasonId)?.name ?? filterSeasonId
            list.push({ key: 'season', label: sName, onRemove: () => setFilterSeasonId('') })
        }
        if (filterWeek) {
            const foundWeek = weekOptions.find(([k]) => k === filterWeek)?.[1]
            list.push({
                key: 'week',
                label: foundWeek ? `W${foundWeek.weekNumber}` : filterWeek,
                onRemove: () => setFilterWeek(''),
            })
        }
        if (filterStatus !== 'all') {
            list.push({ key: 'status', label: filterStatus, onRemove: () => setFilterStatus('all') })
        }
        if (filterStructure !== 'all') {
            list.push({
                key: 'structure',
                label: filterStructure === 'single' ? t('betting.tickets.single') : t('betting.tickets.combo'),
                onRemove: () => setFilterStructure('all'),
            })
        }
        if (filterBetType) {
            list.push({
                key: 'betType',
                label: t(`betting.tickets.betTypes.${filterBetType}`),
                onRemove: () => setFilterBetType(''),
            })
        }
        if (filterStakeMin || filterStakeMax) {
            const label = filterStakeMin && filterStakeMax
                ? `${filterStakeMin}€ - ${filterStakeMax}€`
                : filterStakeMin ? `≥ ${filterStakeMin}€` : `≤ ${filterStakeMax}€`
            list.push({
                key: 'stake',
                label: `${t('profile.bets.stake')}: ${label}`,
                onRemove: () => { setFilterStakeMin(''); setFilterStakeMax('') },
            })
        }
        if (filterOddsMin || filterOddsMax) {
            const label = filterOddsMin && filterOddsMax
                ? `×${filterOddsMin} - ×${filterOddsMax}`
                : filterOddsMin ? `≥ ×${filterOddsMin}` : `≤ ×${filterOddsMax}`
            list.push({
                key: 'odds',
                label: `${t('profile.bets.totalOdds')}: ${label}`,
                onRemove: () => { setFilterOddsMin(''); setFilterOddsMax('') },
            })
        }
        if (filterWinMin || filterWinMax) {
            const label = filterWinMin && filterWinMax
                ? `${filterWinMin}€ - ${filterWinMax}€`
                : filterWinMin ? `≥ ${filterWinMin}€` : `≤ ${filterWinMax}€`
            list.push({
                key: 'win',
                label: `Win: ${label}`,
                onRemove: () => { setFilterWinMin(''); setFilterWinMax('') },
            })
        }
        return list
    }, [filterId, filterMatchNumber, filterSeasonId, filterWeek, filterStatus, filterStructure, filterBetType, filterStakeMin, filterStakeMax, filterOddsMin, filterOddsMax, filterWinMin, filterWinMax, seasons, weekOptions, t])

    const filteredBets = useMemo(() => {
        if (!bets) return []
        return bets.filter((b) => {
            if (filterId && !b.shortId.toLowerCase().includes(filterId.toLowerCase())) return false
            if (filterMatchNumber) {
                const mn = parseInt(filterMatchNumber, 10)
                if (!b.legs.some((l) => l.matchNumber === mn)) return false
            }
            if (filterSeasonId) {
                const sid = parseInt(filterSeasonId, 10)
                if (!b.legs.some((l) => l.seasonId === sid)) return false
            }
            if (filterWeek) {
                if (!b.legs.some((l) => {
                    const info = matchWeekMap.get(l.matchId)
                    return info != null && weekKey(info.seasonId, info.weekNumber) === filterWeek
                })) return false
            }
            if (filterStatus !== 'all' && b.status !== filterStatus) return false
            if (filterStructure === 'single' && b.legs.length !== 1) return false
            if (filterStructure === 'combo' && b.legs.length < 2) return false
            if (filterBetType && !b.legs.some((l) => l.betType === filterBetType)) return false
            if (filterStakeMin && b.stake < parseFloat(filterStakeMin)) return false
            if (filterStakeMax && b.stake > parseFloat(filterStakeMax)) return false
            if (filterOddsMin && b.totalOdds < parseFloat(filterOddsMin)) return false
            if (filterOddsMax && b.totalOdds > parseFloat(filterOddsMax)) return false
            const win = potentialWin(b)
            if (filterWinMin && win < parseFloat(filterWinMin)) return false
            if (filterWinMax && win > parseFloat(filterWinMax)) return false
            return true
        })
    }, [
        bets,
        filterId,
        filterMatchNumber,
        filterSeasonId,
        filterWeek,
        filterStatus,
        filterStructure,
        filterBetType,
        filterStakeMin,
        filterStakeMax,
        filterOddsMin,
        filterOddsMax,
        filterWinMin,
        filterWinMax,
        matchWeekMap,
    ])

    // Metrics (based on all user's bets)
    const metrics = useMemo(() => {
        if (!bets || bets.length === 0) {
            return { totalBets: 0, totalStake: 0, netProfit: 0, winRate: 0 }
        }
        const totalBets = bets.length
        let totalStake = 0
        let netProfit = 0
        let wonCount = 0
        let evaluatedCount = 0

        for (const b of bets) {
            totalStake += b.stake
            if (b.status === 'Won') {
                netProfit += b.stake * b.totalOdds - b.stake
                wonCount++
                evaluatedCount++
            } else if (b.status === 'Lost') {
                netProfit -= b.stake
                evaluatedCount++
            }
        }

        const winRate = evaluatedCount > 0 ? (wonCount / evaluatedCount) * 100 : 0
        return { totalBets, totalStake, netProfit, winRate }
    }, [bets])

    if (loading) {
        return (
            <div className="card p-8 flex justify-center">
                <LoadingSpinner />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header / Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="card p-3.5 bg-surface border-border">
                    <div className="flex items-center gap-1.5 text-text-muted text-xs mb-1">
                        <ReceiptIcon size={14} />
                        <span>{t('betting.totalBets')}</span>
                    </div>
                    <span className="text-xl font-bold text-text">{metrics.totalBets}</span>
                </div>

                <div className="card p-3.5 bg-surface border-border">
                    <div className="flex items-center gap-1.5 text-text-muted text-xs mb-1">
                        <span>{t('profile.bets.stake')}</span>
                    </div>
                    <span className="text-xl font-bold text-text">
                        {metrics.totalStake.toFixed(2)} €
                    </span>
                </div>

                <div className="card p-3.5 bg-surface border-border">
                    <div className="flex items-center gap-1.5 text-text-muted text-xs mb-1">
                        <span>{t('profile.bets.profit')}</span>
                    </div>
                    <span
                        className={`text-xl font-bold ${
                            metrics.netProfit >= 0 ? 'text-success' : 'text-danger'
                        }`}
                    >
                        {metrics.netProfit >= 0 ? '+' : ''}
                        {metrics.netProfit.toFixed(2)} €
                    </span>
                </div>

                <div className="card p-3.5 bg-surface border-border">
                    <div className="flex items-center gap-1.5 text-text-muted text-xs mb-1">
                        <PercentIcon size={14} />
                        <span>Win Rate</span>
                    </div>
                    <span className="text-xl font-bold text-primary">
                        {metrics.winRate.toFixed(1)} %
                    </span>
                </div>
            </div>

            {/* Filter controls: modal button + quick pills */}
            <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full">
                    <button
                        type="button"
                        onClick={() => setFilterModalOpen(true)}
                        className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all shrink-0 ${
                            activeFilters.length > 0
                                ? 'bg-primary/10 border-primary text-primary shadow-sm'
                                : 'bg-surface border-border text-text hover:bg-border'
                        }`}
                        title={t('profile.bets.filters')}
                    >
                        <FunnelIcon size={14} weight={activeFilters.length > 0 ? 'fill' : 'regular'} />
                        <span>{t('profile.bets.filters')}</span>
                        {activeFilters.length > 0 && (
                            <span className="w-4 h-4 rounded-full bg-primary text-white text-[10px] flex items-center justify-center font-bold">
                                {activeFilters.length}
                            </span>
                        )}
                    </button>

                    {(
                        [
                            { key: 'all', label: t('profile.bets.filterAll') },
                            { key: 'Won', label: t('profile.bets.filterWon') },
                            { key: 'Lost', label: t('profile.bets.filterLost') },
                            { key: 'Pending', label: t('profile.bets.filterPending') },
                            { key: 'Cancelled', label: t('profile.bets.filterCancelled') },
                        ] as const
                    ).map((tab) => (
                        <button
                            key={tab.key}
                            type="button"
                            onClick={() => setFilterStatus(tab.key)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                                filterStatus === tab.key
                                    ? 'bg-primary text-white'
                                    : 'bg-surface border border-border text-text-muted hover:text-text hover:bg-border'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                <span className="text-xs text-text-muted ml-auto font-medium">
                    {t('betting.tickets.count', { count: filteredBets.length })}
                </span>
            </div>

            {/* Active filter chips */}
            {activeFilters.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-lg bg-surface/50 border border-border text-xs">
                    <span className="text-[11px] text-text-muted font-medium mr-1">
                        {t('profile.bets.filters')}:
                    </span>
                    {activeFilters.map((f) => (
                        <span
                            key={f.key}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium text-[11px]"
                        >
                            {f.label}
                            <button
                                type="button"
                                onClick={f.onRemove}
                                className="hover:text-danger ml-0.5 rounded-full"
                                aria-label={`Remove ${f.label}`}
                            >
                                ×
                            </button>
                        </span>
                    ))}
                    <button
                        type="button"
                        onClick={clearAllFilters}
                        className="text-[11px] text-text-muted hover:text-danger ml-auto flex items-center gap-1 font-medium transition-colors"
                    >
                        <ArrowCounterClockwiseIcon size={12} />
                        {t('profile.bets.clearAll')}
                    </button>
                </div>
            )}

            {/* Filter Modal */}
            {filterModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div
                        className="card max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border-border bg-surface overflow-hidden"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="bets-filter-modal-title"
                    >
                        {/* Modal Header */}
                        <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                                    <FunnelIcon size={18} weight="fill" />
                                </div>
                                <div>
                                    <h3 id="bets-filter-modal-title" className="font-bold text-base text-text">
                                        {t('profile.bets.filterModalTitle')}
                                    </h3>
                                    <p className="text-xs text-text-muted">
                                        {t('betting.tickets.count', { count: filteredBets.length })}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setFilterModalOpen(false)}
                                className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-border transition-colors"
                                aria-label="Close"
                            >
                                <XIcon size={20} />
                            </button>
                        </div>

                        {/* Modal Body - Inputs Grid */}
                        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                {/* Ticket ID */}
                                <label className="flex flex-col gap-1">
                                    <span className="text-xs font-medium text-text-muted">
                                        {t('betting.tickets.ticketId')}
                                    </span>
                                    <input
                                        type="text"
                                        value={filterId}
                                        onChange={(e) => setFilterId(e.target.value)}
                                        placeholder="B-ABC123"
                                        className="input text-xs sm:text-sm"
                                    />
                                </label>

                                {/* Match Number */}
                                <label className="flex flex-col gap-1">
                                    <span className="text-xs font-medium text-text-muted">
                                        {t('betting.tickets.matchNum')}
                                    </span>
                                    <input
                                        type="number"
                                        value={filterMatchNumber}
                                        onChange={(e) => setFilterMatchNumber(e.target.value)}
                                        placeholder="e.g. 12"
                                        className="input text-xs sm:text-sm"
                                    />
                                </label>

                                {/* Season */}
                                <label className="flex flex-col gap-1">
                                    <span className="text-xs font-medium text-text-muted">
                                        {t('betting.tickets.season')}
                                    </span>
                                    <select
                                        value={filterSeasonId}
                                        onChange={(e) => setFilterSeasonId(e.target.value)}
                                        className="input text-xs sm:text-sm"
                                    >
                                        <option value="">{t('betting.tickets.allSeasons')}</option>
                                        {seasons.map((s) => (
                                            <option key={s.id} value={s.id}>
                                                {s.name}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                {/* Week */}
                                <label className="flex flex-col gap-1">
                                    <span className="text-xs font-medium text-text-muted">
                                        {t('betting.tickets.week')}
                                    </span>
                                    <select
                                        value={filterWeek}
                                        onChange={(e) => setFilterWeek(e.target.value)}
                                        className="input text-xs sm:text-sm"
                                    >
                                        <option value="">{t('betting.tickets.allWeeks')}</option>
                                        {weekOptions.map(([key, info]) => (
                                            <option key={key} value={key}>
                                                {t('betting.tickets.weekLabel', {
                                                    week: info.weekNumber,
                                                    date: new Date(info.date).toLocaleDateString(),
                                                })}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                {/* Status */}
                                <label className="flex flex-col gap-1">
                                    <span className="text-xs font-medium text-text-muted">
                                        {t('betting.tickets.status')}
                                    </span>
                                    <select
                                        value={filterStatus}
                                        onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
                                        className="input text-xs sm:text-sm"
                                    >
                                        <option value="all">{t('betting.tickets.all')}</option>
                                        <option value="Pending">{t('betting.outcomePending')}</option>
                                        <option value="Won">{t('betting.outcomeWon')}</option>
                                        <option value="Lost">{t('betting.outcomeLost')}</option>
                                        <option value="Cancelled">{t('betting.outcomeCancelled')}</option>
                                    </select>
                                </label>

                                {/* Structure */}
                                <label className="flex flex-col gap-1">
                                    <span className="text-xs font-medium text-text-muted">
                                        {t('betting.tickets.structure')}
                                    </span>
                                    <select
                                        value={filterStructure}
                                        onChange={(e) => setFilterStructure(e.target.value as 'all' | 'single' | 'combo')}
                                        className="input text-xs sm:text-sm"
                                    >
                                        <option value="all">{t('betting.tickets.all')}</option>
                                        <option value="single">{t('betting.tickets.single')}</option>
                                        <option value="combo">{t('betting.tickets.combo')}</option>
                                    </select>
                                </label>

                                {/* Bet Type */}
                                <label className="flex flex-col gap-1 sm:col-span-2">
                                    <span className="text-xs font-medium text-text-muted">
                                        {t('betting.tickets.betType')}
                                    </span>
                                    <select
                                        value={filterBetType}
                                        onChange={(e) => setFilterBetType(e.target.value as ApiBetType | '')}
                                        className="input text-xs sm:text-sm"
                                    >
                                        <option value="">{t('betting.tickets.all')}</option>
                                        {ALL_BET_TYPES.map((bt) => (
                                            <option key={bt} value={bt}>
                                                {t(`betting.tickets.betTypes.${bt}`)}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                {/* Stake Min / Max */}
                                <div className="flex flex-col gap-1">
                                    <span className="text-xs font-medium text-text-muted">
                                        {t('profile.bets.stake')} (€)
                                    </span>
                                    <div className="flex gap-2">
                                        <input
                                            type="number"
                                            value={filterStakeMin}
                                            onChange={(e) => setFilterStakeMin(e.target.value)}
                                            placeholder={t('betting.tickets.min')}
                                            className="input text-xs sm:text-sm w-full"
                                        />
                                        <input
                                            type="number"
                                            value={filterStakeMax}
                                            onChange={(e) => setFilterStakeMax(e.target.value)}
                                            placeholder={t('betting.tickets.max')}
                                            className="input text-xs sm:text-sm w-full"
                                        />
                                    </div>
                                </div>

                                {/* Total Odds Min / Max */}
                                <div className="flex flex-col gap-1">
                                    <span className="text-xs font-medium text-text-muted">
                                        {t('profile.bets.totalOdds')}
                                    </span>
                                    <div className="flex gap-2">
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={filterOddsMin}
                                            onChange={(e) => setFilterOddsMin(e.target.value)}
                                            placeholder={t('betting.tickets.min')}
                                            className="input text-xs sm:text-sm w-full"
                                        />
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={filterOddsMax}
                                            onChange={(e) => setFilterOddsMax(e.target.value)}
                                            placeholder={t('betting.tickets.max')}
                                            className="input text-xs sm:text-sm w-full"
                                        />
                                    </div>
                                </div>

                                {/* Win Min / Max */}
                                <div className="flex flex-col gap-1 sm:col-span-2">
                                    <span className="text-xs font-medium text-text-muted">
                                        {t('betting.wonAmountLabel')} / {t('betting.potentialWin')} (€)
                                    </span>
                                    <div className="flex gap-2">
                                        <input
                                            type="number"
                                            value={filterWinMin}
                                            onChange={(e) => setFilterWinMin(e.target.value)}
                                            placeholder={t('betting.tickets.min')}
                                            className="input text-xs sm:text-sm w-full"
                                        />
                                        <input
                                            type="number"
                                            value={filterWinMax}
                                            onChange={(e) => setFilterWinMax(e.target.value)}
                                            placeholder={t('betting.tickets.max')}
                                            className="input text-xs sm:text-sm w-full"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 border-t border-border bg-surface/80 flex items-center justify-between gap-3">
                            <button
                                type="button"
                                onClick={clearAllFilters}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium text-text-muted hover:text-danger hover:bg-border transition-colors flex items-center gap-1.5"
                            >
                                <ArrowCounterClockwiseIcon size={14} />
                                {t('profile.bets.resetFilters')}
                            </button>
                            <button
                                type="button"
                                onClick={() => setFilterModalOpen(false)}
                                className="btn btn-primary text-xs px-5 py-2 font-semibold"
                            >
                                {t('profile.bets.applyFilters')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Bets list / tickets */}
            {filteredBets.length === 0 ? (
                <div className="card p-8 text-center">
                    <p className="text-text-muted text-sm">{t('profile.bets.noBetsFound')}</p>
                    {activeFilters.length > 0 && (
                        <button
                            type="button"
                            onClick={clearAllFilters}
                            className="mt-3 text-xs text-primary hover:underline font-medium"
                        >
                            {t('profile.bets.clearAll')}
                        </button>
                    )}
                </div>
            ) : (
                <div className="space-y-3">
                    {filteredBets.map((b) => {
                        const isExpanded = expandedBetId === b.id
                        const profit =
                            b.status === 'Won'
                                ? b.stake * b.totalOdds - b.stake
                                : b.status === 'Lost'
                                    ? -b.stake
                                    : null

                        return (
                            <div
                                key={b.id}
                                className="card overflow-hidden border-border transition-all duration-200 hover:border-primary/40"
                            >
                                {/* Ticket header bar */}
                                <div
                                    onClick={() => toggleExpand(b.id)}
                                    className="p-3 sm:p-4 bg-surface/90 hover:bg-surface flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 cursor-pointer select-none"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="shrink-0">
                                            {b.status === 'Won' && (
                                                <div className="w-8 h-8 rounded-lg bg-success/20 text-success flex items-center justify-center">
                                                    <CheckCircleIcon size={18} weight="bold" />
                                                </div>
                                            )}
                                            {b.status === 'Lost' && (
                                                <div className="w-8 h-8 rounded-lg bg-danger/20 text-danger flex items-center justify-center">
                                                    <XCircleIcon size={18} weight="bold" />
                                                </div>
                                            )}
                                            {b.status === 'Pending' && (
                                                <div className="w-8 h-8 rounded-lg bg-amber-400/20 text-amber-400 flex items-center justify-center">
                                                    <ClockIcon size={18} weight="bold" />
                                                </div>
                                            )}
                                            {b.status === 'Cancelled' && (
                                                <div className="w-8 h-8 rounded-lg bg-stone-500/20 text-text-muted flex items-center justify-center">
                                                    <ProhibitIcon size={18} weight="bold" />
                                                </div>
                                            )}
                                        </div>

                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono font-bold text-sm text-primary">
                                                    #{b.shortId}
                                                </span>
                                                <span className="text-xs text-text-muted">
                                                    {new Date(b.createdOn).toLocaleString('sk-SK', {
                                                        day: '2-digit',
                                                        month: '2-digit',
                                                        year: 'numeric',
                                                        hour: '2-digit',
                                                        minute: '2-digit',
                                                    })}
                                                </span>
                                            </div>
                                            <p className="text-xs text-text-muted mt-0.5">
                                                {b.legs.length === 1
                                                    ? t('profile.bets.legsCount_1', { count: 1 })
                                                    : t('profile.bets.legsCount', { count: b.legs.length })}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Right side odds, stake, profit */}
                                    <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-4 pt-2 sm:pt-0 border-t sm:border-t-0 border-border">
                                        <div className="text-left sm:text-right">
                                            <span className="text-[10px] text-text-muted uppercase block">
                                                {t('profile.bets.totalOdds')}
                                            </span>
                                            <span className="text-sm font-semibold text-text">
                                                ×{b.totalOdds.toFixed(2)}
                                            </span>
                                        </div>

                                        <div className="text-left sm:text-right">
                                            <span className="text-[10px] text-text-muted uppercase block">
                                                {t('profile.bets.stake')}
                                            </span>
                                            <span className="text-sm font-semibold text-text">
                                                {b.stake.toFixed(2)} €
                                            </span>
                                        </div>

                                        <div className="text-right min-w-[70px]">
                                            <span className="text-[10px] text-text-muted uppercase block">
                                                {t('profile.bets.profit')}
                                            </span>
                                            {profit == null ? (
                                                <span className="text-xs font-medium text-amber-400">
                                                    {b.status === 'Cancelled'
                                                        ? t('betting.outcomeCancelled')
                                                        : t('betting.outcomePending')}
                                                </span>
                                            ) : profit >= 0 ? (
                                                <span className="text-sm font-bold text-success">
                                                    +{profit.toFixed(2)} €
                                                </span>
                                            ) : (
                                                <span className="text-sm font-bold text-danger">
                                                    {profit.toFixed(2)} €
                                                </span>
                                            )}
                                        </div>

                                        <CaretDownIcon
                                            size={16}
                                            className={`text-text-muted transition-transform duration-200 ${
                                                isExpanded ? 'rotate-180' : ''
                                            }`}
                                        />
                                    </div>
                                </div>

                                {/* Expanded Legs List */}
                                {isExpanded && (
                                    <div className="border-t border-border bg-bg/50 p-3 sm:p-4 divide-y divide-border/60">
                                        {b.legs.map((leg) => {
                                            const legDesc = leg.isAnonymized ? '[hidden]' : describeApiLeg(leg, t)
                                            return (
                                                <div
                                                    key={leg.id}
                                                    className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3 text-xs"
                                                >
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                                                        <div className="min-w-0">
                                                            <p className="font-medium text-text truncate">
                                                                {legDesc}
                                                            </p>
                                                            {(leg.homeTeamName || leg.awayTeamName) && (
                                                                <p className="text-[11px] text-text-muted truncate">
                                                                    {leg.homeTeamName} vs {leg.awayTeamName}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-3 shrink-0">
                                                        <span className="font-mono font-medium text-text">
                                                            ×{leg.odds.toFixed(2)}
                                                        </span>
                                                        <span
                                                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                                                                leg.status === 'Won'
                                                                    ? 'bg-success/20 text-success'
                                                                    : leg.status === 'Lost'
                                                                        ? 'bg-danger/20 text-danger'
                                                                        : leg.status === 'Cancelled'
                                                                            ? 'bg-stone-500/20 text-text-muted'
                                                                            : 'bg-amber-400/20 text-amber-400'
                                                            }`}
                                                        >
                                                            {leg.status}
                                                        </span>
                                                    </div>
                                                </div>
                                            )
                                        })}
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
