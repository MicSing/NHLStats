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
} from '@phosphor-icons/react'
import { bettingService } from '../../services/bettingService'
import { describeApiLeg } from '../betting/bettingTypes'
import type { BetDto, BetStatus } from '../../types/bet'
import LoadingSpinner from '../LoadingSpinner'

type FilterStatus = 'all' | BetStatus

export default function ProfileBetsTab() {
    const { t } = useTranslation()
    const [bets, setBets] = useState<BetDto[] | null>(null)
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState<FilterStatus>('all')
    const [expandedBetId, setExpandedBetId] = useState<string | null>(null)

    useEffect(() => {
        let isMounted = true
        bettingService
            .listHistory()
            .then((data) => {
                if (isMounted) {
                    setBets(data)
                    setLoading(false)
                }
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

    const filteredBets = useMemo(() => {
        if (!bets) return []
        if (filter === 'all') return bets
        return bets.filter((b) => b.status === filter)
    }, [bets, filter])

    // Metrics
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

            {/* Filter pills */}
            <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
                    <div className="p-1.5 rounded-lg bg-surface border border-border text-text-muted mr-1 shrink-0">
                        <FunnelIcon size={14} />
                    </div>
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
                            onClick={() => setFilter(tab.key)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                                filter === tab.key
                                    ? 'bg-primary text-white'
                                    : 'bg-surface border border-border text-text-muted hover:text-text hover:bg-border'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Bets list / tickets */}
            {filteredBets.length === 0 ? (
                <div className="card p-8 text-center">
                    <p className="text-text-muted text-sm">{t('profile.bets.noBetsFound')}</p>
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
