import { useTranslation } from 'react-i18next'
import type { UserSeasonStats, UserSeasonTotals } from '../../types/stats'

interface Props {
    stats: UserSeasonStats[]
    userTotals: UserSeasonTotals[]
}

export default function SeasonStatsTable({ stats, userTotals }: Props) {
    const { t } = useTranslation()

    if (stats.length === 0) return null

    return (
        <section className="mb-8" aria-label="User stats">
            <h2 className="text-sm font-bold uppercase tracking-wider text-text-muted mb-3">
                {t('season.playerStats', { defaultValue: 'Player Stats' })}
            </h2>
            <div className="bg-surface border border-border rounded-lg overflow-hidden shadow-card">
                <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-sm">
                    <thead className="bg-bg border-b border-border text-[11px] uppercase tracking-wider text-text-muted">
                        <tr>
                            <th className="py-3 px-5 font-semibold text-left">{t('season.player')}</th>
                            <th className="py-3 px-5 font-semibold text-center">+</th>
                            <th className="py-3 px-5 font-semibold text-center">−</th>
                            <th className="py-3 px-5 font-semibold text-center">{t('season.goals')}</th>
                            <th className="py-3 px-5 font-semibold text-center">{t('season.penalties')}</th>
                            <th className="py-3 px-5 font-semibold text-center">{t('season.earnings', { defaultValue: 'Earnings' })}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {stats.map((s) => {
                            const totals = userTotals.find((t) => t.userId === s.userId)
                            return (
                                <tr key={s.userId} className="hover:bg-bg/60 transition-colors group">
                                    <td className="py-3 px-5 font-semibold">{s.userName}</td>
                                    <td className="py-3 px-5 text-center text-success font-bold tabular-nums">{s.totalPlus}</td>
                                    <td className="py-3 px-5 text-center text-danger font-bold tabular-nums">{s.totalMinus}</td>
                                    <td className="py-3 px-5 text-center text-text-muted group-hover:text-text transition-colors font-medium tabular-nums">{totals?.totalGoals ?? 0}</td>
                                    <td className="py-3 px-5 text-center text-text-muted group-hover:text-text transition-colors font-medium tabular-nums">{totals?.totalPenalties ?? 0}</td>
                                    <td className="py-3 px-5 text-center text-text-muted group-hover:text-text transition-colors font-medium tabular-nums">{s.earnings.toFixed(2)} €</td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
                </div>
            </div>
        </section>
    )
}
