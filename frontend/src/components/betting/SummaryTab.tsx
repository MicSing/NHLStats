import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { FunnelIcon } from '@phosphor-icons/react'
import { useToast } from '../../context/ToastContext'
import { bettingService } from '../../services/bettingService'
import { cacheService } from '../../services/cacheService'
import LoadingSpinner from '../LoadingSpinner'
import type { BetDto, ApiBetType } from '../../types/bet'
import type { Season } from '../../types/season'
import type { User } from '../../types/user'
import type { WeekGroup } from '../../types/stats'

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
    return bet.stake * bet.totalOdds
}

function weekKey(seasonId: number, weekNumber: number): string {
    return `${seasonId}:${weekNumber}`
}

interface RowMetrics {
    key: string
    name: string
    totalBets: number
    totalStake: number
    netProfit: number
    winRate: number
}

function summarize(bets: BetDto[]): { totalBets: number; totalStake: number; netProfit: number; winRate: number } {
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
    return { totalBets: bets.length, totalStake, netProfit, winRate }
}

interface SummaryTabProps {
    refreshKey?: number
}

export default function SummaryTab({ refreshKey }: SummaryTabProps) {
    const { t } = useTranslation()
    const { error } = useToast()
    const [searchParams, setSearchParams] = useSearchParams()

    const [bets, setBets] = useState<BetDto[] | null>(null)
    const [seasons, setSeasons] = useState<Season[]>([])
    const [users, setUsers] = useState<User[]>([])
    const [matchWeekMap, setMatchWeekMap] = useState<Map<number, WeekInfo>>(new Map())
    const [filterOpen, setFilterOpen] = useState(false)

    // Read all filter state from URL (shared param names with the Tickets tab)
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
            return next
        })
    }

    const removeParam = (key: string) => {
        setSearchParams(prev => {
            const next = new URLSearchParams(prev)
            next.delete(key)
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
        filterOddsMin, filterOddsMax, filterWinMin, filterWinMax, users, matchWeekMap])

    const weekOptions = useMemo(() => {
        const byKey = new Map<string, WeekInfo>()
        bets?.forEach(b => b.legs.forEach(l => {
            const info = matchWeekMap.get(l.matchId)
            if (info) byKey.set(weekKey(info.seasonId, info.weekNumber), info)
        }))
        return [...byKey.entries()].sort((a, b) => new Date(b[1].date).getTime() - new Date(a[1].date).getTime())
    }, [bets, matchWeekMap])

    const rows: RowMetrics[] = useMemo(() => {
        const byUser = new Map<string, BetDto[]>()
        for (const b of filtered) {
            const key = b.createdBy || b.createdByName
            const list = byUser.get(key)
            if (list) list.push(b); else byUser.set(key, [b])
        }
        return [...byUser.entries()]
            .map(([key, userBets]) => ({ key, name: userBets[0].createdByName, ...summarize(userBets) }))
            .sort((a, b) => b.netProfit - a.netProfit)
    }, [filtered])

    const overall = useMemo(() => summarize(filtered), [filtered])

    const activeExtraFilters = [
        filterId && { key: 'id', label: t('betting.tickets.chipId', { value: filterId }) },
        filterUserId && { key: 'userId', label: t('betting.tickets.chipUser', { value: users.find(u => String(u.id) === filterUserId)?.name ?? filterUserId }) },
        filterMatchNumber && { key: 'matchNumber', label: t('betting.tickets.chipMatch', { value: filterMatchNumber }) },
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

    if (bets === null) {
        return (
            <section className="card p-6">
                <LoadingSpinner />
            </section>
        )
    }

    return (
        <div className="space-y-4">
            {/* Prominent Season / Week filters */}
            <div className="flex flex-wrap items-end gap-3">
                <label className="flex flex-col gap-1">
                    <span className="text-xs text-text-muted">{t('betting.tickets.season')}</span>
                    <select
                        value={filterSeasonId}
                        onChange={e => setParam('seasonId', e.target.value)}
                        className="text-sm bg-surface border border-border rounded px-2 py-1.5 text-text min-w-[10rem]"
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
                        className="text-sm bg-surface border border-border rounded px-2 py-1.5 text-text min-w-[12rem]"
                    >
                        <option value="">{t('betting.tickets.allWeeks')}</option>
                        {weekOptions.map(([key, info]) => (
                            <option key={key} value={key}>
                                {t('betting.tickets.weekLabel', { week: info.weekNumber, date: new Date(info.date).toLocaleDateString() })}
                            </option>
                        ))}
                    </select>
                </label>

                <button
                    onClick={() => setFilterOpen(o => !o)}
                    className="relative flex items-center gap-1.5 px-3 py-1.5 text-sm rounded border border-border bg-surface hover:bg-border transition-colors"
                >
                    <FunnelIcon size={16} weight={activeExtraFilters.length > 0 ? 'fill' : 'regular'} />
                    {t('betting.tickets.filters')}
                    {activeExtraFilters.length > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-primary text-white text-[10px] flex items-center justify-center font-bold">
                            {activeExtraFilters.length}
                        </span>
                    )}
                </button>

                <span className="text-text-muted text-sm ml-auto self-center">{t('betting.tickets.count', { count: filtered.length })}</span>
            </div>

            {/* Active (hidden) filter chips */}
            {activeExtraFilters.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {activeExtraFilters.map(f => (
                        <span
                            key={f.key}
                            className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-primary/10 text-primary border border-primary/20"
                        >
                            {f.label}
                            <button onClick={() => removeParam(f.key)} className="hover:text-danger ml-0.5">×</button>
                        </span>
                    ))}
                    <button
                        onClick={() => {
                            setSearchParams(prev => {
                                const next = new URLSearchParams(prev)
                                ;['id', 'userId', 'matchNumber', 'status', 'structure', 'betType',
                                    'stakeMin', 'stakeMax', 'oddsMin', 'oddsMax', 'winMin', 'winMax'].forEach(k => next.delete(k))
                                return next
                            })
                        }}
                        className="text-xs text-text-muted hover:text-danger"
                    >
                        {t('betting.tickets.clearAll')}
                    </button>
                </div>
            )}

            {/* Hidden filters panel */}
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

            {/* Summary table */}
            {rows.length === 0 ? (
                <section className="card p-6 text-center">
                    <p className="text-text-muted text-sm">{t('betting.tickets.noMatch')}</p>
                </section>
            ) : (
                <div className="card overflow-x-auto border border-border">
                    <table className="w-full text-sm whitespace-nowrap">
                        <thead>
                            <tr className="border-b border-border text-left text-text-muted text-xs uppercase tracking-wider">
                                <th className="px-4 py-2.5 font-semibold">{t('betting.tickets.user')}</th>
                                <th className="px-4 py-2.5 font-semibold text-right">{t('betting.totalBets')}</th>
                                <th className="px-4 py-2.5 font-semibold text-right">{t('profile.bets.stake')}</th>
                                <th className="px-4 py-2.5 font-semibold text-right">{t('profile.bets.profit')}</th>
                                <th className="px-4 py-2.5 font-semibold text-right">{t('profile.bets.winRate')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map(r => (
                                <tr key={r.key} className="border-b border-border/60 last:border-b-0 hover:bg-surface/60">
                                    <td className="px-4 py-2.5 font-medium text-text">{r.name}</td>
                                    <td className="px-4 py-2.5 text-right text-text">{r.totalBets}</td>
                                    <td className="px-4 py-2.5 text-right text-text">{r.totalStake.toFixed(2)} €</td>
                                    <td className={`px-4 py-2.5 text-right font-semibold ${r.netProfit >= 0 ? 'text-success' : 'text-danger'}`}>
                                        {r.netProfit >= 0 ? '+' : ''}{r.netProfit.toFixed(2)} €
                                    </td>
                                    <td className="px-4 py-2.5 text-right text-primary font-semibold">{r.winRate.toFixed(1)} %</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="border-t-2 border-border bg-surface/60 font-bold">
                                <td className="px-4 py-2.5 text-text">{t('betting.tickets.total')}</td>
                                <td className="px-4 py-2.5 text-right text-text">{overall.totalBets}</td>
                                <td className="px-4 py-2.5 text-right text-text">{overall.totalStake.toFixed(2)} €</td>
                                <td className={`px-4 py-2.5 text-right ${overall.netProfit >= 0 ? 'text-success' : 'text-danger'}`}>
                                    {overall.netProfit >= 0 ? '+' : ''}{overall.netProfit.toFixed(2)} €
                                </td>
                                <td className="px-4 py-2.5 text-right text-primary">{overall.winRate.toFixed(1)} %</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}
        </div>
    )
}
