import { Trophy, Skull, Hockey, FlagBanner } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import type { MatchHistoryItem } from '../../types/stats'
import { teamLogoUrl } from '../../utils/teamLogoUrl'

export default function MatchCard({ variant, match, seasonWeekLabel }: {
    variant: 'best' | 'worst'
    match: MatchHistoryItem | null
    seasonWeekLabel?: string
}) {
    const { t } = useTranslation()
    const isBest = variant === 'best'
    const borderColor = isBest ? 'border-l-success' : 'border-l-danger'
    const labelColor = isBest ? 'text-success' : 'text-danger'
    const Icon = isBest ? Trophy : Skull
    const label = isBest ? t('userStats.bestMatch') : t('userStats.worstMatch')

    if (!match) {
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

    const logo = teamLogoUrl(match.opponentShortName || '')
    const date = new Date(match.matchDate).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    })
    const score = `${match.homeScore}–${match.awayScore}`
    const side = match.isHome ? t('userStats.home') : t('userStats.away')
    const dateLine = seasonWeekLabel ? `${date} · ${seasonWeekLabel}` : date

    return (
        <div className={`bg-surface rounded-xl p-5 border border-border border-l-4 ${borderColor} flex flex-col gap-3`}>
            <span className={`text-[10px] uppercase tracking-wider font-medium flex items-center gap-1.5 ${labelColor}`}>
                <Icon size={14} weight="bold" />
                {label}
            </span>
            <div className="flex items-center gap-3">
                <img
                    src={logo}
                    alt={match.opponentName}
                    className="w-8 h-8 object-contain flex-shrink-0"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                />
                <div className="min-w-0">
                    <p className="text-text font-semibold text-sm truncate">{match.opponentName}</p>
                    <p className="text-text-muted text-xs">{score} · {side}</p>
                </div>
            </div>
            <p className="text-text-muted text-xs">{dateLine}</p>
            <div className="flex gap-4 items-center mt-auto pt-1">
                <span className="text-success font-bold text-lg">+{match.totalPlus}</span>
                <span className="text-danger font-bold text-lg">−{match.totalMinus}</span>
                <span className="flex items-center gap-1 text-text-muted font-bold text-lg">
                    <Hockey size={18} />
                    {match.goalCount}
                </span>
                <span className="flex items-center gap-1 text-text-muted font-bold text-lg">
                    <FlagBanner size={18} />
                    {match.penaltyCount}
                </span>
            </div>
        </div>
    )
}
