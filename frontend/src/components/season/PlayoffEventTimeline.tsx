import {
    ClockCountdownIcon,
    FlagCheckeredIcon,
    PlusCircleIcon,
    WarningCircleIcon,
    TargetIcon,
    ListBulletsIcon,
} from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import type { Match, MatchEvent } from '../../types/match'
import { teamLogoUrl } from '../../utils/teamLogoUrl'

interface Props {
    events: MatchEvent[]
    match: Match
    hostedTeamId?: number | null
}

export default function PlayoffEventTimeline({ events, match, hostedTeamId }: Props) {
    const { t } = useTranslation()

    const isHomeHosted = hostedTeamId != null ? match.homeTeamId === hostedTeamId : true
    const homeTeamName = match.homeTeamName || match.homeTeamShortName || t('common.homeTeam', 'Domáci')
    const awayTeamName = match.awayTeamName || match.awayTeamShortName || t('common.awayTeam', 'Hostia')

    const getPeriodLabel = (subtype?: string | null) => {
        switch (subtype) {
            case 'P1': return t('match.period1Title', '1. tretina')
            case 'P2': return t('match.period2Title', '2. tretina')
            case 'P3': return t('match.period3Title', '3. tretina')
            case 'OT': return t('match.overtimeTitle', 'Predĺženie')
            case 'SO': return t('match.shootoutTitle', 'Samostatné nájazdy')
            default: return subtype ?? t('match.period1Title', '1. tretina')
        }
    }

    if (events.length === 0) {
        return (
            <div className="text-center py-10 text-text-muted text-sm italic">
                <p>{t('season.playoffNoEventsNotice', 'Pre tento zápas nie je zaznamenaná časová os.')}</p>
            </div>
        )
    }

    return (
        <div className="w-full flex flex-col">
            {/* Header Columns: Home Team vs Away Team */}
            <div className="grid grid-cols-[1fr_36px_1fr] sm:grid-cols-[1fr_44px_1fr] items-center gap-2 pb-3 mb-4 border-b border-border/70 text-xs font-bold uppercase tracking-wider text-text-muted">
                {/* Home side header */}
                <div className="flex items-center gap-2 min-w-0 pr-1">
                    <img
                        src={teamLogoUrl(match.homeTeamShortName)}
                        alt={match.homeTeamShortName ?? ''}
                        className="w-5 h-5 object-contain flex-shrink-0"
                        onError={(e) => { ;(e.target as HTMLImageElement).style.display = 'none' }}
                    />
                    <span className="truncate text-text font-extrabold">{homeTeamName}</span>
                </div>

                {/* Center marker */}
                <div className="flex items-center justify-center">
                    <ListBulletsIcon size={16} className="text-primary" />
                </div>

                {/* Away side header */}
                <div className="flex items-center justify-end gap-2 min-w-0 pl-1 text-right">
                    <span className="truncate text-text font-extrabold">{awayTeamName}</span>
                    <img
                        src={teamLogoUrl(match.awayTeamShortName)}
                        alt={match.awayTeamShortName ?? ''}
                        className="w-5 h-5 object-contain flex-shrink-0"
                        onError={(e) => { ;(e.target as HTMLImageElement).style.display = 'none' }}
                    />
                </div>
            </div>

            {/* Timeline Axis Container */}
            <div className="relative">
                {/* Continuous Center Axis Vertical Line */}
                <div
                    className="absolute left-1/2 top-2 bottom-2 w-px -translate-x-1/2 bg-border/80 pointer-events-none"
                    aria-hidden="true"
                />

                <div className="space-y-3 relative z-10">
                    {events.map((evt) => {
                        const isDivider = evt.eventType === 'PeriodChange' || evt.eventType === 'MatchEnd'

                        if (isDivider) {
                            return (
                                <div key={evt.id} className="flex items-center justify-center py-1">
                                    {evt.eventType === 'PeriodChange' && (
                                        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-surface border border-primary/30 text-primary text-xs sm:text-sm font-bold uppercase tracking-wider shadow-sm z-20">
                                            <ClockCountdownIcon size={15} weight="bold" />
                                            <span>{getPeriodLabel(evt.eventSubtype)}</span>
                                        </div>
                                    )}

                                    {evt.eventType === 'MatchEnd' && (
                                        <div className="flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-950/80 border border-emerald-600/50 text-emerald-400 text-xs sm:text-sm font-bold uppercase tracking-wider shadow-sm z-20">
                                            <FlagCheckeredIcon size={15} weight="bold" />
                                            <span>
                                                {t('match.matchEndTitle', 'Koniec zápasu')} ({evt.eventSubtype ?? 'REG'})
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )
                        }

                        // Determine which team side this event belongs to
                        const isHomeEvent = isHomeHosted ? !evt.isOpponent : evt.isOpponent
                        const teamName = isHomeEvent ? homeTeamName : awayTeamName

                        return (
                            <div
                                key={evt.id}
                                className="grid grid-cols-[1fr_36px_1fr] sm:grid-cols-[1fr_44px_1fr] items-center gap-2"
                            >
                                {/* Left Side: Home Team Event */}
                                <div className="flex justify-end min-w-0">
                                    {isHomeEvent && (
                                        <EventCard
                                            evt={evt}
                                            teamName={teamName}
                                            side="home"
                                        />
                                    )}
                                </div>

                                {/* Center Axis Node / Bullet */}
                                <div className="flex items-center justify-center z-10">
                                    <div
                                        className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center border shadow-sm ${
                                            evt.eventType === 'Goal'
                                                ? isHomeEvent
                                                    ? 'bg-blue-950 text-blue-400 border-blue-500/50 ring-2 ring-blue-500/20'
                                                    : 'bg-red-950 text-red-400 border-red-500/50 ring-2 ring-red-500/20'
                                                : evt.eventType === 'Penalty'
                                                  ? 'bg-amber-950 text-amber-400 border-amber-500/50 ring-1 ring-amber-500/20'
                                                  : evt.eventType === 'ShootoutGoal'
                                                    ? 'bg-purple-950 text-purple-400 border-purple-500/50 ring-1 ring-purple-500/20'
                                                    : 'bg-surface text-text-muted border-border'
                                        }`}
                                        title={`#${evt.orderIndex}`}
                                    >
                                        {evt.eventType === 'Goal' && (
                                            <PlusCircleIcon size={15} weight="bold" />
                                        )}
                                        {evt.eventType === 'Penalty' && (
                                            <WarningCircleIcon size={15} weight="bold" />
                                        )}
                                        {evt.eventType === 'ShootoutGoal' && (
                                            <TargetIcon size={15} weight="bold" />
                                        )}
                                        {evt.eventType === 'Point' && (
                                            <span className="text-[11px] font-bold">
                                                {evt.pointType === 'Positive'
                                                    ? '+1'
                                                    : evt.pointType === 'Negative'
                                                      ? '−1'
                                                      : '•'}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Right Side: Away Team Event */}
                                <div className="flex justify-start min-w-0">
                                    {!isHomeEvent && (
                                        <EventCard
                                            evt={evt}
                                            teamName={teamName}
                                            side="away"
                                        />
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

function EventCard({
    evt,
    teamName,
    side,
}: {
    evt: MatchEvent
    teamName: string
    side: 'home' | 'away'
}) {
    const { t } = useTranslation()
    const isGoal = evt.eventType === 'Goal'
    const isPenalty = evt.eventType === 'Penalty'
    const isShootoutGoal = evt.eventType === 'ShootoutGoal'
    const isPoint = evt.eventType === 'Point'

    // Determine goal scorer display
    let scorerTitle = ''
    if (isGoal) {
        if (evt.isOpponent) {
            scorerTitle = evt.playerName || `${t('match.opponentGoal', 'Gól súpera')} (${teamName})`
        } else {
            scorerTitle = evt.playerName || t('match.teamAiGoal', 'Tímový AI gól')
        }
    } else if (isPenalty) {
        if (evt.isOpponent) {
            scorerTitle = `${t('match.opponentPenalty', 'Faul súpera')} (${teamName})`
        } else {
            scorerTitle = evt.playerName
                ? `${t('userMatchCard.penalty', 'Trest')} - ${evt.playerName}`
                : t('match.teamPenalty', 'Trest tímu')
        }
    } else if (isShootoutGoal) {
        scorerTitle = evt.isOpponent
            ? `${t('match.opponentSoGoal', 'Nájazd')} (${teamName})`
            : t('match.teamSoGoal', 'Nájazd tímu')
    } else if (isPoint) {
        scorerTitle = evt.pointReasonName ?? t('userMatchCard.points', 'Body')
    }

    return (
        <div
            className={`w-full max-w-[340px] rounded-lg border transition-all p-2.5 sm:px-3 text-xs ${
                isGoal
                    ? side === 'home'
                        ? 'bg-blue-950/30 border-blue-600/40 hover:border-blue-500 shadow-sm'
                        : 'bg-red-950/30 border-red-600/40 hover:border-red-500 shadow-sm'
                    : isPenalty
                      ? 'bg-amber-950/20 border-amber-600/40 hover:border-amber-500'
                      : isShootoutGoal
                        ? 'bg-purple-950/20 border-purple-600/40 hover:border-purple-500'
                        : evt.pointType === 'Positive'
                          ? 'bg-emerald-950/20 border-emerald-600/40'
                          : evt.pointType === 'Negative'
                            ? 'bg-red-950/20 border-red-600/40'
                            : 'bg-surface/80 border-border'
            }`}
        >
            <div className="flex items-start justify-between gap-1.5">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    {/* Order index badge */}
                    <span className="text-[10px] font-mono font-bold text-text-muted bg-bg/80 px-1 py-0.2 rounded border border-border/80 flex-shrink-0">
                        #{evt.orderIndex}
                    </span>

                    {/* Scorer name or Event title */}
                    <span
                        className={`truncate ${
                            isGoal
                                ? 'font-black text-xs sm:text-sm text-text'
                                : 'font-semibold text-text'
                        }`}
                        title={scorerTitle}
                    >
                        {scorerTitle}
                    </span>

                    {/* Goal Type badge */}
                    {isGoal && evt.goalType && evt.goalType !== 'Regular' && (
                        <span
                            className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded border flex-shrink-0 ${
                                evt.goalType === 'PowerPlay'
                                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                                    : evt.goalType === 'ShortHanded'
                                      ? 'bg-blue-500/20 text-blue-400 border-blue-500/40'
                                      : 'bg-purple-500/20 text-purple-400 border-purple-500/40'
                            }`}
                        >
                            {evt.goalType === 'PowerPlay'
                                ? 'PP'
                                : evt.goalType === 'ShortHanded'
                                  ? 'SH'
                                  : 'SO'}
                        </span>
                    )}
                </div>
            </div>

            {/* Subtitle / User Name */}
            {evt.userName && (
                <div className="text-[10px] sm:text-[11px] text-text-muted truncate mt-1 flex items-center gap-1">
                    <span>{evt.userName}</span>
                </div>
            )}
        </div>
    )
}
