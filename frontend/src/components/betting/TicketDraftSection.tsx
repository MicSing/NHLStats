import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { bettingService } from '../../services/bettingService'
import type { ApiBetType } from '../../types/bet'
import { type DraftLeg, describeLeg } from './bettingTypes'

const USER_EVENT_TYPES: ApiBetType[] = ['UserGoal', 'UserPenalty', 'UserPlusPoint', 'UserMinusPoint']

interface TicketDraftSectionProps {
    legs: DraftLeg[]
    totalOdds: number
    stakeInput: string
    onStakeChange: (v: string) => void
    onRemove: (key: string) => void
    onClear: () => void
    onCreate: () => Promise<void>
    canCreate: boolean
    potentialWin: number
    maxStake?: number
    onUpdateOccasions: (key: string, occasions: number, newOdds: number) => void
}

const QUICK_STAKES = [0.05, 0.1, 0.5, 1] as const

export default function TicketDraftSection({
    legs,
    totalOdds,
    stakeInput,
    onStakeChange,
    onRemove,
    onClear,
    onCreate,
    canCreate,
    potentialWin,
    maxStake,
    onUpdateOccasions,
}: TicketDraftSectionProps) {
    const { t } = useTranslation()
    const [loadingOccasions, setLoadingOccasions] = useState<Record<string, boolean>>({})

    const handleOccasionsChange = async (leg: DraftLeg, newOccasions: number) => {
        if (!leg.userId) return
        const n = Math.max(leg.minOccasions, Math.min(10, newOccasions))
        setLoadingOccasions((prev) => ({ ...prev, [leg.key]: true }))
        try {
            const result = await bettingService.getUserEventOddsForOccasions(leg.matchId, leg.betType, leg.userId, n)
            if (result) {
                onUpdateOccasions(leg.key, result.occasions, result.odds)
            }
        } finally {
            setLoadingOccasions((prev) => ({ ...prev, [leg.key]: false }))
        }
    }

    const handleQuickStake = (val: (typeof QUICK_STAKES)[number] | 'max') => {
        if (val === 'max') {
            if (maxStake != null) onStakeChange(maxStake.toFixed(2))
        } else {
            const current = parseFloat(stakeInput) || 0
            onStakeChange((current + val).toFixed(2))
        }
    }

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
                    {legs.map((leg) => {
                        const isUserEvent = USER_EVENT_TYPES.includes(leg.betType)
                        const isLoading = loadingOccasions[leg.key] ?? false
                        return (
                            <li
                                key={leg.key}
                                className="flex flex-col gap-1 px-3 py-2 border border-border rounded bg-bg"
                            >
                                <div className="flex items-center justify-between">
                                    <span className="text-sm">{describeLeg(leg, t)}</span>
                                    <span className="flex items-center gap-3">
                                        <span className="font-bold text-warning">
                                            {isLoading ? '…' : `×${leg.odds.toFixed(2)}`}
                                        </span>
                                        <button
                                            onClick={() => onRemove(leg.key)}
                                            className="text-text-muted hover:text-danger text-sm"
                                            aria-label={t('betting.removeLeg')}
                                        >
                                            ✕
                                        </button>
                                    </span>
                                </div>
                                {isUserEvent && (
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-xs text-text-muted">{t('betting.occasions')}:</span>
                                        <input
                                            type="number"
                                            min={leg.minOccasions}
                                            max={10}
                                            value={leg.occasions}
                                            disabled={isLoading}
                                            onChange={(e) => {
                                                const n = parseInt(e.target.value, 10)
                                                if (!isNaN(n)) void handleOccasionsChange(leg, n)
                                            }}
                                            className="w-16 px-2 py-0.5 text-xs rounded border border-border bg-bg-secondary disabled:opacity-40"
                                        />
                                    </div>
                                )}
                            </li>
                        )
                    })}
                </ul>
            )}

            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-3">
                <div className="flex items-center gap-3 text-sm">
                    <span className="text-text-muted">{t('betting.totalOdds')}:</span>
                    <strong className="text-lg">×{totalOdds.toFixed(2)}</strong>
                </div>
                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-3">
                        <label className="text-sm text-text-muted">{t('betting.stakeLabel')}</label>
                        <input
                            type="number"
                            min={0}
                            step={0.05}
                            value={stakeInput}
                            onChange={(e) => onStakeChange(e.target.value)}
                            className="w-28 px-3 py-1.5 rounded border border-border bg-bg text-sm"
                        />
                        <span className="text-xs text-success">
                            → {potentialWin.toFixed(2)} € {t('betting.potentialWin')}
                        </span>
                    </div>
                    <div className="flex gap-1.5">
                        {QUICK_STAKES.map((v) => (
                            <button
                                key={v}
                                type="button"
                                onClick={() => handleQuickStake(v)}
                                className="flex-1 px-2 py-1 text-[10px] font-bold rounded border border-border bg-bg-secondary text-text-muted hover:bg-primary/10 hover:text-primary hover:border-primary/40 transition-colors"
                            >
                                {v}
                            </button>
                        ))}
                        <button
                            type="button"
                            onClick={() => handleQuickStake('max')}
                            disabled={maxStake == null}
                            className="flex-1 px-2 py-1 text-[10px] font-bold rounded border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                            MAX
                        </button>
                    </div>
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
