import { TrophyIcon, SkullIcon, HockeyIcon, FlagBannerIcon } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import type { WeekSummary } from './statsTypes'
import { teamLogoUrl } from '../../utils/teamLogoUrl'

export default function WeekCard({ variant, week }: { variant: 'best' | 'worst'; week: WeekSummary | null }) {
    const { t } = useTranslation()
    const isBest = variant === 'best'
    const borderColor = isBest ? 'border-l-success' : 'border-l-danger'
    const labelColor = isBest ? 'text-success' : 'text-danger'
    const Icon = isBest ? TrophyIcon : SkullIcon
    const label = isBest ? t('userStats.bestWeek') : t('userStats.worstWeek')

    if (!week) {
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

    const dateLabels = week.matchDates.map((d) => {
        const date = new Date(d + 'T00:00:00Z')
        return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' })
    })

    const uniqueOpponents = week.opponents.filter(
        (o, i, arr) => arr.findIndex((x) => x.shortName === o.shortName) === i,
    )

    return (
        <div className={`bg-surface rounded-xl p-5 border border-border border-l-4 ${borderColor} flex flex-col gap-3`}>
            <span className={`text-[10px] uppercase tracking-wider font-medium flex items-center gap-1.5 ${labelColor}`}>
                <Icon size={14} weight="bold" />
                {label}
            </span>
            <div>
                <p className="text-text font-bold text-base">{week.seasonName} · {t('userStats.weekLabel', { week: week.weekNumber })}</p>
                <p className="text-text-muted text-xs mt-0.5">{dateLabels.join(', ')}</p>
            </div>
            <div className="flex gap-1 flex-wrap">
                {uniqueOpponents.map((opp, idx) => (
                    <img
                        key={idx}
                        src={teamLogoUrl(opp.shortName || '')}
                        alt={opp.name}
                        title={opp.name}
                        className="w-6 h-6 object-contain"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                    />
                ))}
            </div>
            <div className="flex gap-4 items-center mt-auto pt-1">
                <span className="text-success font-bold text-lg">+{week.totalPlus}</span>
                <span className="text-danger font-bold text-lg">−{week.totalMinus}</span>
                <span className="flex items-center gap-1 text-text-muted font-bold text-lg">
                    <HockeyIcon size={18} />
                    {week.goalCount}
                </span>
                <span className="flex items-center gap-1 text-text-muted font-bold text-lg">
                    <FlagBannerIcon size={18} />
                    {week.penaltyCount}
                </span>
            </div>
        </div>
    )
}
