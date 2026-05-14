import { useTranslation } from 'react-i18next'
import type { BetDto } from '../../types/bet'
import { describeApiLeg } from './bettingTypes'

interface LiveTicketsSectionProps {
    tickets: BetDto[]
    onCancel: (id: string) => Promise<void>
}

export default function LiveTicketsSection({ tickets, onCancel }: LiveTicketsSectionProps) {
    const { t } = useTranslation()
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
                                        <li key={l.id}>
                                            {l.isAnonymized ? '🔒 hidden' : describeApiLeg(l, t)}
                                        </li>
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
