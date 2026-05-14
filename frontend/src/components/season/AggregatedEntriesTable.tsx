import { useTranslation } from 'react-i18next'

export interface AggEntry {
    id: number
    userId: number
    userName: string
    totalPlus: number
    totalMinus: number
    matchesPlayed: number
}

interface Props {
    entries: AggEntry[]
}

export default function AggregatedEntriesTable({ entries }: Props) {
    const { t } = useTranslation()

    if (entries.length === 0) return null

    return (
        <section className="mb-8" aria-label={t('season.aggregatedEntries')}>
            <h2 className="text-sm font-bold uppercase tracking-wider text-text-muted mb-3">
                {t('season.aggregatedEntries')}
            </h2>
            <div className="bg-surface border border-border rounded-lg overflow-hidden shadow-card">
                <div className="overflow-x-auto">
                <table className="w-full min-w-[320px] text-sm">
                    <thead className="bg-bg border-b border-border text-[11px] uppercase tracking-wider text-text-muted">
                        <tr>
                            <th className="py-3 px-5 font-semibold text-left">{t('season.player')}</th>
                            <th className="py-3 px-5 font-semibold text-center">+</th>
                            <th className="py-3 px-5 font-semibold text-center">−</th>
                            <th className="py-3 px-5 font-semibold text-center">{t('match.matchesPlayed', { defaultValue: 'Matches Played' })}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {entries.map((e) => (
                            <tr key={e.id} className="hover:bg-bg/60 transition-colors">
                                <td className="py-3 px-5 font-semibold">{e.userName}</td>
                                <td className="py-3 px-5 text-center text-success font-bold tabular-nums">{e.totalPlus}</td>
                                <td className="py-3 px-5 text-center text-danger font-bold tabular-nums">{e.totalMinus}</td>
                                <td className="py-3 px-5 text-center text-text-muted tabular-nums">{e.matchesPlayed}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                </div>
            </div>
        </section>
    )
}
