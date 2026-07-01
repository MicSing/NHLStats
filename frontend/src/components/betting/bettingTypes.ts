import type { ApiBetType, BetDto } from '../../types/bet'

export interface DraftLeg {
    key: string
    matchId: number
    matchNumber: number
    betType: ApiBetType
    userId: number | null
    teamId: number | null
    label: string
    odds: number
    occasions: number
    minOccasions: number
    maxOccasions: number
}

export const teamOutcomeTypes: ApiBetType[] = ['TeamWin', 'TeamWinOrDraw', 'TeamDraw']
export const shutoutWinTypes: ApiBetType[] = ['HostedShutoutWin', 'OpponentShutoutWin']

// One MatchTotalGoals leg, and separately one UserPlusPoint / one UserMinusPoint leg, are allowed
// per match per ticket. Plus and minus are capped independently (a match can carry one of each).
export function matchHasLegOfType(draftLegs: DraftLeg[], matchId: number, betType: ApiBetType): boolean {
    return draftLegs.some((l) => l.matchId === matchId && l.betType === betType)
}

export function legKey(matchId: number, betType: ApiBetType, target: number | null, occasions = 1): string {
    return `${matchId}:${betType}:${target ?? '-'}:${occasions}`
}

type TFn = (k: string, opts?: Record<string, unknown>) => string

export function describeLeg(leg: DraftLeg, t: TFn): string {
    const matchTag = t('betting.matchNumber', { number: leg.matchNumber })
    const occasionsTag = leg.occasions > 1 ? ` (×${leg.occasions})` : ''
    return `${matchTag} · ${leg.label}${occasionsTag}`
}

export function describeApiLeg(leg: BetDto['legs'][number], t: TFn): string {
    const tag = t('betting.matchNumber', { number: leg.matchNumber })
    const kind =
        leg.betType === 'TeamDraw'
            ? t('betting.drawLabel')
            : leg.betType === 'TeamWin' || leg.betType === 'TeamWinOrDraw'
                ? leg.targetName ?? t('betting.unknownTeam')
                : leg.betType === 'UserGoal'
                    ? `${t('betting.goals')}: ${leg.targetName ?? t('betting.unknownUser')}`
                    : leg.betType === 'UserPenalty'
                        ? `${t('betting.penalties')}: ${leg.targetName ?? t('betting.unknownUser')}`
                        : leg.betType === 'UserPlusPoint'
                            ? `${t('betting.plusPoints')}: ${leg.targetName ?? t('betting.unknownUser')}`
                            : leg.betType === 'UserMinusPoint'
                                ? `${t('betting.minusPoints')}: ${leg.targetName ?? t('betting.unknownUser')}`
                                : leg.betType === 'MatchTotalGoals'
                                    ? `${t('betting.totalGoals')}: ${leg.occasions}+`
                                    : leg.targetName ?? (leg.betType === 'HostedShutoutWin'
                                        ? t('betting.hostedShutoutWin')
                                        : t('betting.opponentShutoutWin'))
    return `${tag} · ${kind} @${leg.odds.toFixed(2)}`
}
