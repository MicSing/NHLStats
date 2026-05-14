import { useTranslation } from 'react-i18next'
import LoadingSpinner from '../LoadingSpinner'
import type { BetDto } from '../../types/bet'
import { describeApiLeg } from './bettingTypes'

interface ArchiveTableProps {
    bets: BetDto[] | null
}

export default function ArchiveTable({ bets }: ArchiveTableProps) {
    const { t } = useTranslation()

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
                                                {l.isAnonymized ? '[hidden]' : describeApiLeg(l, t)}
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
