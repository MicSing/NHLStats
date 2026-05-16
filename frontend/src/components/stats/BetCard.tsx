import { Trophy, Skull } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import type { BetDto, BetLegDto } from '../../types/bet'

const LEG_TYPE_LABEL: Record<BetLegDto['betType'], string> = {
    TeamWin: 'Win',
    TeamWinOrDraw: '1X',
    TeamDraw: 'Draw',
    UserGoal: 'Goal',
    UserPenalty: 'Penalty',
    UserPlusPoint: '+Point',
    UserMinusPoint: '−Point',
}

const LEG_STATUS_DOT: Record<BetLegDto['status'], string> = {
    Pending: 'bg-blue-400',
    Won: 'bg-green-500',
    Lost: 'bg-red-500',
    Cancelled: 'bg-gray-500',
}

export default function BetCard({ variant, bet }: { variant: 'best' | 'worst'; bet: BetDto | null }) {
    const { t } = useTranslation()
    const isBest = variant === 'best'
    const borderColor = isBest ? 'border-l-success' : 'border-l-danger'
    const labelColor = isBest ? 'text-success' : 'text-danger'
    const Icon = isBest ? Trophy : Skull
    const label = isBest ? t('userStats.bestBet') : t('userStats.worstBet')

    if (!bet) {
        return (
            <div className={`bg-surface rounded-xl p-5 border border-border border-l-4 ${borderColor} flex flex-col gap-2`}>
                <span className={`text-[10px] uppercase tracking-wider font-medium flex items-center gap-1.5 ${labelColor}`}>
                    <Icon size={14} weight="bold" />
                    {label}
                </span>
                <p className="text-text-muted text-sm">{t('common.noData')}</p>
            </div>
        )
    }

    const date = new Date(bet.evaluatedOn ?? bet.createdOn).toLocaleDateString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric',
    })
    const structure = bet.legs.length === 1 ? t('userStats.betSingle') : t('userStats.betCombo', { count: bet.legs.length })
    const potentialWin = bet.stake * bet.totalOdds
    const netProfit = bet.wonAmount != null ? bet.wonAmount - bet.stake : null

    return (
        <div className={`bg-surface rounded-xl p-5 border border-border border-l-4 ${borderColor} flex flex-col gap-3`}>
            {/* Header */}
            <div className="flex items-center justify-between">
                <span className={`text-[10px] uppercase tracking-wider font-medium flex items-center gap-1.5 ${labelColor}`}>
                    <Icon size={14} weight="bold" />
                    {label}
                </span>
                <span className="text-[10px] uppercase tracking-wider font-bold text-text-muted bg-border/50 px-1.5 py-0.5 rounded">
                    {structure}
                </span>
            </div>

            {/* ID + date */}
            <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-text bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                    {bet.shortId}
                </span>
                <span className="text-text-muted text-xs">{date}</span>
            </div>

            {/* Legs */}
            <div className="space-y-1.5">
                {bet.legs.map((leg) => {
                    const matchName = leg.homeTeamName && leg.awayTeamName
                        ? `${leg.homeTeamName} vs ${leg.awayTeamName}`
                        : `Match #${leg.matchNumber}`
                    const typeLabel = LEG_TYPE_LABEL[leg.betType] ?? leg.betType
                    return (
                        <div key={leg.id} className="bg-bg rounded-lg px-3 py-2 flex items-center gap-2">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${LEG_STATUS_DOT[leg.status]}`} />
                            <div className="min-w-0 flex-1">
                                <p className="text-[10px] text-text-muted truncate">{matchName}</p>
                                <p className="text-xs text-text font-medium truncate">
                                    <span className="text-text-muted">{typeLabel}:</span>{' '}
                                    {leg.targetName ?? '—'}
                                </p>
                            </div>
                            <span className="text-xs font-mono text-text-muted shrink-0">{leg.odds.toFixed(2)}</span>
                        </div>
                    )
                })}
            </div>

            {/* Bottom: financials */}
            <div className="flex items-end justify-between mt-auto pt-1 border-t border-border/50">
                <div className="text-xs text-text-muted">
                    {bet.stake.toFixed(2)}€ <span className="opacity-60">×</span> {bet.totalOdds.toFixed(2)}
                </div>
                {isBest ? (
                    <div className="text-right">
                        <div className="text-success font-bold text-lg leading-none">{bet.wonAmount!.toFixed(2)}€</div>
                        {netProfit != null && (
                            <div className="text-[10px] text-success/70 mt-0.5">+{netProfit.toFixed(2)}€ profit</div>
                        )}
                    </div>
                ) : (
                    <div className="text-right">
                        <div className="text-danger font-bold text-lg leading-none">−{bet.stake.toFixed(2)}€</div>
                        <div className="text-[10px] text-text-muted mt-0.5">could win {potentialWin.toFixed(2)}€</div>
                    </div>
                )}
            </div>
        </div>
    )
}
