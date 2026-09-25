import { useTranslation } from 'react-i18next'
import type { UserSeasonStats, UserSeasonTotals } from '../../types/stats'

export type StatsPhaseFilter = 'All' | 'RegularSeason' | 'Playoff'

interface Props {
    stats: UserSeasonStats[]
    userTotals: UserSeasonTotals[]
    showPhaseSwitch?: boolean
    phase?: StatsPhaseFilter
    onPhaseChange?: (phase: StatsPhaseFilter) => void
}

export default function SeasonStatsTable({ stats, userTotals, showPhaseSwitch, phase = 'All', onPhaseChange }: Props) {
    const { t } = useTranslation()

    if (stats.length === 0 && !showPhaseSwitch) return null

    const phaseOptions: { value: StatsPhaseFilter; label: string }[] = [
        { value: 'All', label: t('season.statsFilterAll') },
        { value: 'RegularSeason', label: t('season.statsFilterSeason') },
        { value: 'Playoff', label: t('season.statsFilterPlayoff') },
    ]

    return (
        <section className="mb-8" aria-label="User stats">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <h2 className="text-sm font-bold uppercase tracking-wider text-text-muted">
                    {t('season.playerStats', { defaultValue: 'Player Stats' })}
                </h2>
                {showPhaseSwitch && (
                    <div className="flex gap-1 rounded-lg bg-surface p-1 border border-border">
                        {phaseOptions.map((opt) => (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={() => onPhaseChange?.(opt.value)}
                                className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors whitespace-nowrap ${
                                    phase === opt.value ? 'bg-primary text-white' : 'text-text-muted hover:text-text'
                                }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>
            <div className="bg-surface border border-border rounded-lg overflow-hidden shadow-card">
                <div className="overflow-x-auto">
                <table className="w-full min-w-[420px] text-xs sm:text-sm">
                    <thead className="bg-bg border-b border-border text-[10px] sm:text-[11px] uppercase tracking-wider text-text-muted">
                        <tr>
                            <th className="py-2 px-2.5 sm:py-3 sm:px-5 font-semibold text-left">{t('season.player')}</th>
                            <th className="py-2 px-2 sm:py-3 sm:px-4 font-semibold text-center" title={t('season.gamesPlayedFull')}>{t('season.gamesPlayed')}</th>
                            <th className="py-2 px-2 sm:py-3 sm:px-4 font-semibold text-center">+</th>
                            <th className="py-2 px-2 sm:py-3 sm:px-4 font-semibold text-center">−</th>
                            <th className="py-2 px-2 sm:py-3 sm:px-4 font-semibold text-center">{t('season.goals')}</th>
                            <th className="py-2 px-2 sm:py-3 sm:px-4 font-semibold text-center">{t('season.penalties')}</th>
                            <th className="py-2 px-2.5 sm:py-3 sm:px-5 font-semibold text-center">{t('season.earnings', { defaultValue: 'Earnings' })}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {stats.map((s) => {
                            const totals = userTotals.find((t) => t.userId === s.userId)
                            return (
                                <tr key={s.userId} className="hover:bg-bg/60 transition-colors group">
                                    <td className="py-2 px-2.5 sm:py-3 sm:px-5 font-semibold whitespace-nowrap">{s.userName}</td>
                                    <td className="py-2 px-2 sm:py-3 sm:px-4 text-center text-text-muted group-hover:text-text transition-colors font-medium tabular-nums">{totals?.gamesPlayed ?? 0}</td>
                                    <td className="py-2 px-2 sm:py-3 sm:px-4 text-center text-success font-bold tabular-nums">{s.totalPlus}</td>
                                    <td className="py-2 px-2 sm:py-3 sm:px-4 text-center text-danger font-bold tabular-nums">{s.totalMinus}</td>
                                    <td className="py-2 px-2 sm:py-3 sm:px-4 text-center text-text-muted group-hover:text-text transition-colors font-medium tabular-nums">{totals?.totalGoals ?? 0}</td>
                                    <td className="py-2 px-2 sm:py-3 sm:px-4 text-center text-text-muted group-hover:text-text transition-colors font-medium tabular-nums">{totals?.totalPenalties ?? 0}</td>
                                    <td className="py-2 px-2.5 sm:py-3 sm:px-5 text-center text-text-muted group-hover:text-text transition-colors font-medium tabular-nums whitespace-nowrap">{s.earnings.toFixed(2)} €</td>
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
