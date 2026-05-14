import { useTranslation } from 'react-i18next'
import { type DraftLeg, describeLeg } from './bettingTypes'

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
}

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
}: TicketDraftSectionProps) {
    const { t } = useTranslation()
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
