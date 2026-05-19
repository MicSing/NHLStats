import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { MatchOddsDto } from '../../types/bet'
import type { FutureMatch } from '../../types/match'
import { type DraftLeg } from './bettingTypes'
import OddsButton from './OddsButton'
import PlayerMarketRow from './PlayerMarketRow'


interface MarketsSectionProps {
    match: FutureMatch | null
    odds: MatchOddsDto | null
    currentUserId: number | null
    matchHasTeamOutcome: boolean
    onAddLeg: (leg: Omit<DraftLeg, 'key'>) => void
}

export default function MarketsSection({ match, odds, currentUserId, matchHasTeamOutcome, onAddLeg }: MarketsSectionProps) {
    const { t } = useTranslation()
    const [showUnavailable, setShowUnavailable] = useState(false)

    if (!match) {
        return (
            <section className="card p-4">
                <p className="text-text-muted text-sm">{t('betting.selectMatchHint')}</p>
            </section>
        )
    }

    const isHostingHome = match.hostedTeamId === match.homeTeamId
    const isHostingAway = match.hostedTeamId === match.awayTeamId
    const homeOdds = odds?.teamWin?.homeOdds ?? null
    const awayOdds = odds?.teamWin?.awayOdds ?? null
    const drawOdds = odds?.teamWin?.drawOdds ?? null
    const home1XOdds = odds?.teamWin?.home1XOdds ?? null
    const away1XOdds = odds?.teamWin?.away1XOdds ?? null
    const matchTitle = `${match.homeTeamName ?? '?'} vs ${match.awayTeamName ?? '?'}`
    const isUserInMatch = (match.userMatches ?? []).some((u) => u.userId === currentUserId)
    const users = (match.userMatches ?? []).filter((u) => u.userId !== currentUserId)

    const homeLabel = `${t('betting.homeWin')} (${match.homeTeamName ?? '?'})`
    const awayLabel = `${t('betting.awayWin')} (${match.awayTeamName ?? '?'})`
    const home1XLabel = `${t('betting.home1X')} (${match.homeTeamName ?? '?'})`
    const away1XLabel = `${t('betting.away1X')} (${match.awayTeamName ?? '?'})`

    const homeDisabled = (isUserInMatch && !isHostingHome) || homeOdds == null || matchHasTeamOutcome || (homeOdds != null && homeOdds < 1)
    const drawDisabled = isUserInMatch || drawOdds == null || drawOdds < 1
    const awayDisabled = (isUserInMatch && !isHostingAway) || awayOdds == null || matchHasTeamOutcome || (awayOdds != null && awayOdds < 1)
    const home1XDisabled = isUserInMatch || home1XOdds == null || matchHasTeamOutcome || (home1XOdds != null && home1XOdds < 1)
    const away1XDisabled = isUserInMatch || away1XOdds == null || matchHasTeamOutcome || (away1XOdds != null && away1XOdds < 1)
    const show1X2Section = showUnavailable || !homeDisabled || !drawDisabled || !awayDisabled
    const show1XSection = showUnavailable || !home1XDisabled || !away1XDisabled

    return (
        <section className="card p-4 space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-sm font-bold uppercase tracking-wider text-text-muted truncate min-w-0">
                    {t('betting.marketsFor', { match: matchTitle })}
                </h2>
                <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-text-muted">{t('betting.showUnavailable')}</span>
                        <button
                            onClick={() => setShowUnavailable((v) => !v)}
                            aria-label={t('betting.showUnavailable')}
                            className={`w-8 h-4 rounded-full relative transition-colors ${showUnavailable ? 'bg-primary' : 'bg-surface border border-border'}`}
                        >
                            <span
                                className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full transition-all ${showUnavailable ? 'bg-white translate-x-4' : 'bg-text-muted translate-x-0'}`}
                            />
                        </button>
                    </div>
                    <span className="text-xs font-mono text-text-muted">
                        {t('betting.matchNumber', { number: match.matchNumber })}
                    </span>
                </div>
            </div>

            {/* 1 X 2 */}
            {show1X2Section && (
            <div className="flex gap-2">
                {(showUnavailable || !homeDisabled) && (
                    <OddsButton
                        label={t('betting.betOnHomeShort')}
                        subLabel={homeLabel}
                        odds={homeOdds}
                        disabled={homeDisabled}
                        onClick={() =>
                            homeOdds != null &&
                            onAddLeg({
                                matchId: match.id,
                                matchNumber: match.matchNumber,
                                betType: 'TeamWin',
                                userId: null,
                                teamId: match.homeTeamId,
                                label: homeLabel,
                                odds: homeOdds,
                                occasions: 1,
                                minOccasions: 1,
                            })
                        }
                    />
                )}
                {(showUnavailable || !drawDisabled) && (
                    <OddsButton
                        label={t('betting.betOnDrawShort')}
                        subLabel={t('betting.drawLabel')}
                        odds={drawOdds}
                        disabled={drawDisabled}
                        onClick={() =>
                            drawOdds != null &&
                            onAddLeg({
                                matchId: match.id,
                                matchNumber: match.matchNumber,
                                betType: 'TeamDraw',
                                userId: null,
                                teamId: null,
                                label: t('betting.drawLabel'),
                                odds: drawOdds,
                                occasions: 1,
                                minOccasions: 1,
                            })
                        }
                    />
                )}
                {(showUnavailable || !awayDisabled) && (
                    <OddsButton
                        label={t('betting.betOnAwayShort')}
                        subLabel={awayLabel}
                        odds={awayOdds}
                        disabled={awayDisabled}
                        onClick={() =>
                            awayOdds != null &&
                            onAddLeg({
                                matchId: match.id,
                                matchNumber: match.matchNumber,
                                betType: 'TeamWin',
                                userId: null,
                                teamId: match.awayTeamId,
                                label: awayLabel,
                                odds: awayOdds,
                                occasions: 1,
                                minOccasions: 1,
                            })
                        }
                    />
                )}
            </div>
            )}

            {/* 1X / 2X (double chance) */}
            {show1XSection && (
            <div className="flex gap-2">
                {(showUnavailable || !home1XDisabled) && (
                    <OddsButton
                        label={t('betting.betOnHome1XShort')}
                        subLabel={home1XLabel}
                        odds={home1XOdds}
                        disabled={home1XDisabled}
                        onClick={() =>
                            home1XOdds != null &&
                            onAddLeg({
                                matchId: match.id,
                                matchNumber: match.matchNumber,
                                betType: 'TeamWinOrDraw',
                                userId: null,
                                teamId: match.homeTeamId,
                                label: home1XLabel,
                                odds: home1XOdds,
                                occasions: 1,
                                minOccasions: 1,
                            })
                        }
                    />
                )}
                {(showUnavailable || !away1XDisabled) && (
                    <OddsButton
                        label={t('betting.betOnAway1XShort')}
                        subLabel={away1XLabel}
                        odds={away1XOdds}
                        disabled={away1XDisabled}
                        onClick={() =>
                            away1XOdds != null &&
                            onAddLeg({
                                matchId: match.id,
                                matchNumber: match.matchNumber,
                                betType: 'TeamWinOrDraw',
                                userId: null,
                                teamId: match.awayTeamId,
                                label: away1XLabel,
                                odds: away1XOdds,
                                occasions: 1,
                                minOccasions: 1,
                            })
                        }
                    />
                )}
            </div>
            )}

            {/* User markets */}
            <div className={`grid grid-cols-1 gap-4 ${isUserInMatch && !showUnavailable ? 'md:grid-cols-2' : 'md:grid-cols-2 xl:grid-cols-4'}`}>
                <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted mb-2">
                        {t('betting.goals')}
                    </h3>
                    {users.length === 0 ? (
                        <p className="text-xs text-text-muted">{t('betting.noUsers')}</p>
                    ) : (
                        <div className="space-y-1">
                            {users.map((u) => {
                                const entry = odds?.userGoal.find((x) => x.userId === u.userId)
                                const raw = entry?.odds ?? null
                                if (!showUnavailable && (entry == null || entry.effectiveOdds < 1)) return null
                                const displayOdds = entry?.effectiveOdds ?? raw
                                const occasions = entry?.minOccasions ?? 1
                                return (
                                    <PlayerMarketRow
                                        key={`goal-${u.userId}`}
                                        name={u.userName ?? t('betting.unknownUser')}
                                        odds={displayOdds}
                                        occasionsBadge={occasions > 1 ? occasions : undefined}
                                        onAdd={() =>
                                            displayOdds != null &&
                                            onAddLeg({
                                                matchId: match.id,
                                                matchNumber: match.matchNumber,
                                                betType: 'UserGoal',
                                                userId: u.userId,
                                                teamId: null,
                                                label: `${t('betting.goals')}: ${u.userName ?? '?'}`,
                                                odds: displayOdds,
                                                occasions,
                                                minOccasions: occasions,
                                            })
                                        }
                                    />
                                )
                            })}
                        </div>
                    )}
                </div>
                <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted mb-2">
                        {t('betting.penalties')}
                    </h3>
                    {users.length === 0 ? (
                        <p className="text-xs text-text-muted">{t('betting.noUsers')}</p>
                    ) : (
                        <div className="space-y-1">
                            {users.map((u) => {
                                const entry = odds?.userPenalty.find((x) => x.userId === u.userId)
                                const raw = entry?.odds ?? null
                                if (!showUnavailable && (entry == null || entry.effectiveOdds < 1)) return null
                                const displayOdds = entry?.effectiveOdds ?? raw
                                const occasions = entry?.minOccasions ?? 1
                                return (
                                    <PlayerMarketRow
                                        key={`pen-${u.userId}`}
                                        name={u.userName ?? t('betting.unknownUser')}
                                        odds={displayOdds}
                                        occasionsBadge={occasions > 1 ? occasions : undefined}
                                        onAdd={() =>
                                            displayOdds != null &&
                                            onAddLeg({
                                                matchId: match.id,
                                                matchNumber: match.matchNumber,
                                                betType: 'UserPenalty',
                                                userId: u.userId,
                                                teamId: null,
                                                label: `${t('betting.penalties')}: ${u.userName ?? '?'}`,
                                                odds: displayOdds,
                                                occasions,
                                                minOccasions: occasions,
                                            })
                                        }
                                    />
                                )
                            })}
                        </div>
                    )}
                </div>
                {(!isUserInMatch || showUnavailable) && (
                <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted mb-2">
                        {t('betting.plusPoints')}
                    </h3>
                    {users.length === 0 ? (
                        <p className="text-xs text-text-muted">{t('betting.noUsers')}</p>
                    ) : (
                        <div className="space-y-1">
                            {users.map((u) => {
                                const entry = odds?.userPlusPoint.find((x) => x.userId === u.userId)
                                const raw = entry?.odds ?? null
                                if (!showUnavailable && (entry == null || entry.effectiveOdds < 1)) return null
                                const displayOdds = entry?.effectiveOdds ?? raw
                                const occasions = entry?.minOccasions ?? 1
                                return (
                                    <PlayerMarketRow
                                        key={`plus-${u.userId}`}
                                        name={u.userName ?? t('betting.unknownUser')}
                                        odds={displayOdds}
                                        occasionsBadge={occasions > 1 ? occasions : undefined}
                                        forceDisabled={isUserInMatch}
                                        onAdd={() =>
                                            displayOdds != null &&
                                            onAddLeg({
                                                matchId: match.id,
                                                matchNumber: match.matchNumber,
                                                betType: 'UserPlusPoint',
                                                userId: u.userId,
                                                teamId: null,
                                                label: `${t('betting.plusPoints')}: ${u.userName ?? '?'}`,
                                                odds: displayOdds,
                                                occasions,
                                                minOccasions: occasions,
                                            })
                                        }
                                    />
                                )
                            })}
                        </div>
                    )}
                </div>
                )}
                {(!isUserInMatch || showUnavailable) && (
                <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted mb-2">
                        {t('betting.minusPoints')}
                    </h3>
                    {users.length === 0 ? (
                        <p className="text-xs text-text-muted">{t('betting.noUsers')}</p>
                    ) : (
                        <div className="space-y-1">
                            {users.map((u) => {
                                const entry = odds?.userMinusPoint.find((x) => x.userId === u.userId)
                                const raw = entry?.odds ?? null
                                if (!showUnavailable && (entry == null || entry.effectiveOdds < 1)) return null
                                const displayOdds = entry?.effectiveOdds ?? raw
                                const occasions = entry?.minOccasions ?? 1
                                return (
                                    <PlayerMarketRow
                                        key={`minus-${u.userId}`}
                                        name={u.userName ?? t('betting.unknownUser')}
                                        odds={displayOdds}
                                        occasionsBadge={occasions > 1 ? occasions : undefined}
                                        forceDisabled={isUserInMatch}
                                        onAdd={() =>
                                            displayOdds != null &&
                                            onAddLeg({
                                                matchId: match.id,
                                                matchNumber: match.matchNumber,
                                                betType: 'UserMinusPoint',
                                                userId: u.userId,
                                                teamId: null,
                                                label: `${t('betting.minusPoints')}: ${u.userName ?? '?'}`,
                                                odds: displayOdds,
                                                occasions,
                                                minOccasions: occasions,
                                            })
                                        }
                                    />
                                )
                            })}
                        </div>
                    )}
                </div>
                )}
            </div>
        </section>
    )
}
