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
    matchHasGoalTotalLeg: boolean
    matchHasPlusPointLeg: boolean
    matchHasMinusPointLeg: boolean
    matchHasShutoutLeg: boolean
    onAddLeg: (leg: Omit<DraftLeg, 'key' | 'maxOccasions'> & { maxOccasions?: number }) => void
}

export default function MarketsSection({
    match, odds, currentUserId, matchHasTeamOutcome, matchHasGoalTotalLeg, matchHasPlusPointLeg, matchHasMinusPointLeg, matchHasShutoutLeg, onAddLeg,
}: MarketsSectionProps) {
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

    const hostedTeamName = isHostingHome ? match.homeTeamName : isHostingAway ? match.awayTeamName : null
    const opponentTeamName = isHostingHome ? match.awayTeamName : isHostingAway ? match.homeTeamName : null
    const hostedShutoutLabel = hostedTeamName != null && opponentTeamName != null
        ? t('betting.hostedShutoutWinNamed', { team: hostedTeamName, opponent: opponentTeamName })
        : t('betting.hostedShutoutWin')
    const opponentShutoutLabel = hostedTeamName != null && opponentTeamName != null
        ? t('betting.opponentShutoutWinNamed', { team: opponentTeamName, opponent: hostedTeamName })
        : t('betting.opponentShutoutWin')

    // "Unavailable" (no odds data / below-threshold probability) drives visibility — hidden unless
    // Show Unavailable is on. "Already picked elsewhere in this match" (matchHasX) never hides a
    // button; it only disables it, so the user can see why an option isn't selectable.
    const homeUnavailable = (isUserInMatch && !isHostingHome) || homeOdds == null || (homeOdds != null && homeOdds < 1)
    const drawUnavailable = isUserInMatch || drawOdds == null || drawOdds < 1
    const awayUnavailable = (isUserInMatch && !isHostingAway) || awayOdds == null || (awayOdds != null && awayOdds < 1)
    const home1XUnavailable = (isUserInMatch && !isHostingHome) || home1XOdds == null || (home1XOdds != null && home1XOdds < 1)
    const away1XUnavailable = (isUserInMatch && !isHostingAway) || away1XOdds == null || (away1XOdds != null && away1XOdds < 1)

    const homeDisabled = homeUnavailable || matchHasTeamOutcome
    const drawDisabled = drawUnavailable || matchHasTeamOutcome
    const awayDisabled = awayUnavailable || matchHasTeamOutcome
    const home1XDisabled = home1XUnavailable || matchHasTeamOutcome
    const away1XDisabled = away1XUnavailable || matchHasTeamOutcome

    const show1X2Section = showUnavailable || !homeUnavailable || !drawUnavailable || !awayUnavailable
    const show1XSection = showUnavailable || !home1XUnavailable || !away1XUnavailable

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
                {(showUnavailable || !homeUnavailable) && (
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
                {(showUnavailable || !drawUnavailable) && (
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
                {(showUnavailable || !awayUnavailable) && (
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
                {(showUnavailable || !home1XUnavailable) && (
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
                {(showUnavailable || !away1XUnavailable) && (
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

            {/* Match Total Goals */}
            {odds != null && odds.matchTotalGoals.length > 0 && (
            <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted mb-2">
                    {t('betting.totalGoals')}
                </h3>
                <div className="flex gap-2">
                    {odds.matchTotalGoals.map((g) => {
                        const disabled = matchHasGoalTotalLeg || g.odds < 1
                        if (!showUnavailable && g.odds < 1) return null
                        const label = `${g.threshold}+`
                        return (
                            <OddsButton
                                key={`goals-${g.threshold}`}
                                label={label}
                                subLabel={t('betting.totalGoals')}
                                odds={g.odds}
                                disabled={disabled}
                                onClick={() =>
                                    onAddLeg({
                                        matchId: match.id,
                                        matchNumber: match.matchNumber,
                                        betType: 'MatchTotalGoals',
                                        userId: null,
                                        teamId: null,
                                        label: `${t('betting.totalGoals')}: ${label}`,
                                        odds: g.odds,
                                        occasions: g.threshold,
                                        minOccasions: g.threshold,
                                    })
                                }
                            />
                        )
                    })}
                </div>
            </div>
            )}

            {/* Shutout Win */}
            {(() => {
                const hostedShutoutUnavailable = (odds?.hostedShutoutWinOdds ?? 0) < 1
                // Match participants are not eligible to bet OpponentShutoutWin at all — treat that
                // as unavailable (hidden) rather than merely disabled, same as home/away eligibility.
                const opponentShutoutUnavailable = isUserInMatch || (odds?.opponentShutoutWinOdds ?? 0) < 1
                const showShutoutSection = showUnavailable || !hostedShutoutUnavailable || !opponentShutoutUnavailable
                return showShutoutSection && (
                    <div className="flex gap-2">
                        {(showUnavailable || !hostedShutoutUnavailable) && (
                            <OddsButton
                                label={isHostingHome ? t('betting.betOnHomeShort') : t('betting.betOnAwayShort')}
                                subLabel={hostedShutoutLabel}
                                odds={odds?.hostedShutoutWinOdds ?? null}
                                disabled={matchHasShutoutLeg || hostedShutoutUnavailable}
                                onClick={() =>
                                    odds?.hostedShutoutWinOdds != null &&
                                    onAddLeg({
                                        matchId: match.id,
                                        matchNumber: match.matchNumber,
                                        betType: 'HostedShutoutWin',
                                        userId: null,
                                        teamId: null,
                                        label: hostedShutoutLabel,
                                        odds: odds.hostedShutoutWinOdds,
                                        occasions: 1,
                                        minOccasions: 1,
                                    })
                                }
                            />
                        )}
                        {(showUnavailable || !opponentShutoutUnavailable) && (
                            <OddsButton
                                label={isHostingHome ? t('betting.betOnAwayShort') : t('betting.betOnHomeShort')}
                                subLabel={opponentShutoutLabel}
                                odds={odds?.opponentShutoutWinOdds ?? null}
                                disabled={matchHasShutoutLeg || opponentShutoutUnavailable}
                                onClick={() =>
                                    odds?.opponentShutoutWinOdds != null &&
                                    onAddLeg({
                                        matchId: match.id,
                                        matchNumber: match.matchNumber,
                                        betType: 'OpponentShutoutWin',
                                        userId: null,
                                        teamId: null,
                                        label: opponentShutoutLabel,
                                        odds: odds.opponentShutoutWinOdds,
                                        occasions: 1,
                                        minOccasions: 1,
                                    })
                                }
                            />
                        )}
                    </div>
                )
            })()}

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
                                                maxOccasions: entry?.maxOccasions ?? occasions,
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
                                                maxOccasions: entry?.maxOccasions ?? occasions,
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
                                        forceDisabled={isUserInMatch || matchHasPlusPointLeg}
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
                                                maxOccasions: entry?.maxOccasions ?? occasions,
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
                                        forceDisabled={isUserInMatch || matchHasMinusPointLeg}
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
                                                maxOccasions: entry?.maxOccasions ?? occasions,
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
