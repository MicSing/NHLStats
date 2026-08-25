import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useToast } from '../../context/ToastContext'
import { bettingService } from '../../services/bettingService'
import type { BettingBalanceDto, BetDto, CreateBetLegDto, MatchOddsDto } from '../../types/bet'
import type { FutureMatch } from '../../types/match'
import { type DraftLeg, legKey, matchHasLegOfType, shutoutWinTypes, teamOutcomeTypes } from './bettingTypes'
import LiveTicketsSection from './LiveTicketsSection'
import MarketsSection from './MarketsSection'
import TicketDraftSection from './TicketDraftSection'
import UpcomingMatchesSection from './UpcomingMatchesSection'

interface BettingTabProps {
    userId: number
    onBalanceChanged: (b: BettingBalanceDto) => void
    refreshKey?: number
}

async function resolveUpdatedLeg(
    leg: DraftLeg,
    match: FutureMatch | undefined,
    odds: MatchOddsDto | null,
): Promise<{ valid: boolean; updatedLeg?: DraftLeg }> {
    if (!match || !odds) {
        return { valid: false }
    }

    let newOdds: number | null = null
    let maxOccasions = leg.maxOccasions
    let minOccasions = leg.minOccasions

    if (leg.betType === 'TeamWin') {
        if (leg.teamId === match.homeTeamId) newOdds = odds.teamWin?.homeOdds ?? null
        else if (leg.teamId === match.awayTeamId) newOdds = odds.teamWin?.awayOdds ?? null
    } else if (leg.betType === 'TeamWinOrDraw') {
        if (leg.teamId === match.homeTeamId) newOdds = odds.teamWin?.home1XOdds ?? null
        else if (leg.teamId === match.awayTeamId) newOdds = odds.teamWin?.away1XOdds ?? null
    } else if (leg.betType === 'TeamDraw') {
        newOdds = odds.teamWin?.drawOdds ?? null
    } else if (leg.betType === 'HostedShutoutWin') {
        newOdds = odds.hostedShutoutWinOdds
    } else if (leg.betType === 'OpponentShutoutWin') {
        newOdds = odds.opponentShutoutWinOdds
    } else if (leg.betType === 'MatchTotalGoals') {
        const row = odds.matchTotalGoals.find((g) => g.threshold === leg.occasions)
        newOdds = row?.odds ?? null
    } else if (
        leg.betType === 'UserGoal' ||
        leg.betType === 'UserPenalty' ||
        leg.betType === 'UserPlusPoint' ||
        leg.betType === 'UserMinusPoint'
    ) {
        const pool =
            leg.betType === 'UserGoal'
                ? odds.userGoal
                : leg.betType === 'UserPenalty'
                  ? odds.userPenalty
                  : leg.betType === 'UserPlusPoint'
                    ? odds.userPlusPoint
                    : odds.userMinusPoint
        const userOddsItem = pool.find((u) => u.userId === leg.userId)
        if (userOddsItem) {
            maxOccasions = userOddsItem.maxOccasions
            minOccasions = userOddsItem.minOccasions
            if (leg.occasions <= 1) {
                newOdds = userOddsItem.effectiveOdds
            } else {
                try {
                    const occ = await bettingService.getUserEventOddsForOccasions(
                        leg.matchId,
                        leg.betType,
                        leg.userId!,
                        leg.occasions,
                    )
                    newOdds = occ?.odds ?? null
                } catch {
                    newOdds = null
                }
            }
        }
    }

    if (newOdds == null || newOdds < 1) {
        return { valid: false }
    }

    return {
        valid: true,
        updatedLeg: {
            ...leg,
            odds: newOdds,
            minOccasions,
            maxOccasions,
        },
    }
}

export default function BettingTab({ userId, onBalanceChanged, refreshKey }: BettingTabProps) {
    const { t } = useTranslation()
    const { success, error, warning, info } = useToast()

    const [matches, setMatches] = useState<FutureMatch[]>([])
    const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null)
    const [oddsByMatch, setOddsByMatch] = useState<Record<number, MatchOddsDto | null>>({})
    const [draftLegs, setDraftLegs] = useState<DraftLeg[]>([])
    const [stakeInput, setStakeInput] = useState<string>('0')
    const [activeBets, setActiveBets] = useState<BetDto[]>([])
    const [balance, setBalance] = useState<BettingBalanceDto | null>(null)

    const draftLegsRef = useRef(draftLegs)
    const selectedMatchIdRef = useRef(selectedMatchId)
    useEffect(() => { draftLegsRef.current = draftLegs }, [draftLegs])
    useEffect(() => { selectedMatchIdRef.current = selectedMatchId }, [selectedMatchId])

    const ensureOdds = useCallback(async (matchId: number) => {
        setOddsByMatch((prev) => {
            if (matchId in prev) return prev
            return { ...prev, [matchId]: null }
        })
        const odds = await bettingService.getMatchOdds(matchId)
        setOddsByMatch((prev) => ({ ...prev, [matchId]: odds }))
    }, [])

    useEffect(() => {
        const load = async () => {
            try {
                const [upcoming, active, bal] = await Promise.all([
                    bettingService.getUpcoming(7),
                    bettingService.listActive(),
                    bettingService.getBalance(),
                ])
                setMatches(upcoming)
                setActiveBets(active)
                setBalance(bal)
                onBalanceChanged(bal)
                if (upcoming.length > 0) {
                    setSelectedMatchId((prev) => prev ?? upcoming[0].id)
                    void ensureOdds(upcoming[0].id)
                }
            } catch {
                error(t('betting.loadError'))
            }
        }
        void load()
    }, [userId, ensureOdds, error, t, onBalanceChanged])

    useEffect(() => {
        if (!refreshKey) return
        const refresh = async () => {
            try {
                const [upcoming, active, bal] = await Promise.all([
                    bettingService.getUpcoming(7),
                    bettingService.listActive(),
                    bettingService.getBalance(),
                ])
                setMatches(upcoming)
                setActiveBets(active)
                setBalance(bal)
                onBalanceChanged(bal)

                let currentSelectedId = selectedMatchIdRef.current
                if (currentSelectedId == null || !upcoming.some((m) => m.id === currentSelectedId)) {
                    currentSelectedId = upcoming.length > 0 ? upcoming[0].id : null
                    setSelectedMatchId(currentSelectedId)
                }

                const currentDraft = draftLegsRef.current
                const relevantMatchIds = new Set<number>()
                if (currentSelectedId != null) relevantMatchIds.add(currentSelectedId)
                currentDraft.forEach((l) => relevantMatchIds.add(l.matchId))
                upcoming.forEach((m) => relevantMatchIds.add(m.id))

                const freshOddsEntries = await Promise.all(
                    Array.from(relevantMatchIds).map(async (mId) => {
                        try {
                            const o = await bettingService.getMatchOdds(mId)
                            return [mId, o] as const
                        } catch {
                            return [mId, null] as const
                        }
                    }),
                )
                const freshOddsMap: Record<number, MatchOddsDto | null> = Object.fromEntries(freshOddsEntries)
                setOddsByMatch((prev) => ({ ...prev, ...freshOddsMap }))

                if (currentDraft.length > 0) {
                    let legsRemoved = false
                    let oddsChanged = false
                    const nextDraftLegs: DraftLeg[] = []

                    for (const leg of currentDraft) {
                        const match = upcoming.find((m) => m.id === leg.matchId)
                        const odds = freshOddsMap[leg.matchId] ?? null
                        const evaluated = await resolveUpdatedLeg(leg, match, odds)

                        if (!evaluated.valid || !evaluated.updatedLeg) {
                            legsRemoved = true
                        } else {
                            if (evaluated.updatedLeg.odds !== leg.odds) {
                                oddsChanged = true
                            }
                            nextDraftLegs.push(evaluated.updatedLeg)
                        }
                    }

                    setDraftLegs(nextDraftLegs)

                    if (legsRemoved) {
                        warning(t('betting.draftMatchClosed'))
                    } else if (oddsChanged) {
                        info(t('betting.draftOddsUpdated'))
                    } else {
                        info(t('betting.oddsAutoRefreshed'))
                    }
                } else {
                    info(t('betting.oddsAutoRefreshed'))
                }
            } catch {
                /* silent */
            }
        }
        void refresh()
    }, [refreshKey, onBalanceChanged, t, warning, info])

    const selectedMatch = matches.find((m) => m.id === selectedMatchId) ?? null
    const selectedOdds = selectedMatchId != null ? oddsByMatch[selectedMatchId] ?? null : null

    const totalOdds = useMemo(
        () => draftLegs.reduce((p, l) => Math.floor(p * l.odds * 100) / 100, 1),
        [draftLegs],
    )

    const stake = parseFloat(stakeInput)
    const stakeValid = Number.isFinite(stake) && stake > 0
    const potentialWin = stakeValid ? stake * totalOdds : 0

    const selectMatch = (id: number) => {
        setSelectedMatchId(id)
        void ensureOdds(id)
    }

    const addLeg = (leg: Omit<DraftLeg, 'key' | 'maxOccasions'> & { maxOccasions?: number }) => {
        const occasions = leg.occasions ?? 1
        const maxOccasions = leg.maxOccasions ?? occasions
        const key = legKey(leg.matchId, leg.betType, leg.userId ?? leg.teamId ?? null, occasions)
        if (draftLegs.some((l) => l.key === key)) return
        if (teamOutcomeTypes.includes(leg.betType)) {
            if (draftLegs.some((l) => l.matchId === leg.matchId && teamOutcomeTypes.includes(l.betType))) {
                error(t('betting.oneMatchResultPerMatch'))
                return
            }
            if (draftLegs.some((l) => l.matchId === leg.matchId && shutoutWinTypes.includes(l.betType))) {
                error(t('betting.cannotCombineTeamWinAndShutout'))
                return
            }
        }
        if (leg.betType === 'MatchTotalGoals' && matchHasLegOfType(draftLegs, leg.matchId, 'MatchTotalGoals')) {
            error(t('betting.oneGoalTotalPerMatch'))
            return
        }
        if (shutoutWinTypes.includes(leg.betType)) {
            if (draftLegs.some((l) => l.matchId === leg.matchId && shutoutWinTypes.includes(l.betType))) {
                error(t('betting.oneShutoutPerMatch'))
                return
            }
            if (draftLegs.some((l) => l.matchId === leg.matchId && teamOutcomeTypes.includes(l.betType))) {
                error(t('betting.cannotCombineTeamWinAndShutout'))
                return
            }
        }
        if (leg.betType === 'UserPlusPoint' && matchHasLegOfType(draftLegs, leg.matchId, 'UserPlusPoint')) {
            error(t('betting.onePlusPointPerMatch'))
            return
        }
        if (leg.betType === 'UserMinusPoint' && matchHasLegOfType(draftLegs, leg.matchId, 'UserMinusPoint')) {
            error(t('betting.oneMinusPointPerMatch'))
            return
        }
        setDraftLegs((prev) => [...prev, { ...leg, occasions, maxOccasions, key }])
    }

    const updateLegOccasions = (key: string, occasions: number, newOdds: number, maxOccasions: number) => {
        setDraftLegs((prev) =>
            prev.map((l) => {
                if (l.key !== key) return l
                const newKey = legKey(l.matchId, l.betType, l.userId ?? l.teamId ?? null, occasions)
                return { ...l, occasions, odds: newOdds, maxOccasions, key: newKey }
            }),
        )
    }

    const removeLeg = (key: string) => {
        setDraftLegs((prev) => prev.filter((l) => l.key !== key))
    }

    const clearDraft = () => {
        setDraftLegs([])
        setStakeInput('0')
    }

    const refreshAfterMutation = async () => {
        const [newActive, newBal] = await Promise.all([
            bettingService.listActive(),
            bettingService.getBalance(),
        ])
        setActiveBets(newActive)
        setBalance(newBal)
        onBalanceChanged(newBal)
    }

    const placeBet = async () => {
        if (draftLegs.length === 0 || !stakeValid) return
        const payload = {
            stake,
            legs: draftLegs.map<CreateBetLegDto>((l) => ({
                matchId: l.matchId,
                betType: l.betType,
                userId: l.userId ?? undefined,
                teamId: l.teamId ?? undefined,
                occasions: l.occasions,
            })),
        }
        try {
            await bettingService.placeBet(payload)
            success(t('betting.betPlaced'))
            clearDraft()
            await refreshAfterMutation()
        } catch {
            error(t('betting.betError'))
        }
    }

    const cancelActive = async (id: string) => {
        try {
            await bettingService.cancelBet(id)
            success(t('betting.betCancelled'))
            await refreshAfterMutation()
        } catch {
            error(t('betting.betError'))
        }
    }

    const canCreate =
        draftLegs.length > 0 &&
        stakeValid &&
        (balance == null || stake <= balance.availableBalance) &&
        (balance == null || balance.maxWinCap <= 0 || potentialWin <= balance.maxWinCap)

    return (
        <div className="space-y-6">
            <LiveTicketsSection tickets={activeBets} onCancel={cancelActive} />

            <UpcomingMatchesSection
                matches={matches}
                selectedMatchId={selectedMatchId}
                onSelect={selectMatch}
            />

            <MarketsSection
                match={selectedMatch}
                odds={selectedOdds}
                currentUserId={userId}
                matchHasTeamOutcome={
                    selectedMatchId != null &&
                    draftLegs.some(
                        (l) =>
                            l.matchId === selectedMatchId &&
                            teamOutcomeTypes.includes(l.betType),
                    )
                }
                matchHasGoalTotalLeg={selectedMatchId != null && matchHasLegOfType(draftLegs, selectedMatchId, 'MatchTotalGoals')}
                matchHasPlusPointLeg={selectedMatchId != null && matchHasLegOfType(draftLegs, selectedMatchId, 'UserPlusPoint')}
                matchHasMinusPointLeg={selectedMatchId != null && matchHasLegOfType(draftLegs, selectedMatchId, 'UserMinusPoint')}
                matchHasShutoutLeg={
                    selectedMatchId != null &&
                    draftLegs.some((l) => l.matchId === selectedMatchId && shutoutWinTypes.includes(l.betType))
                }
                onAddLeg={addLeg}
            />

            <TicketDraftSection
                legs={draftLegs}
                totalOdds={totalOdds}
                stakeInput={stakeInput}
                onStakeChange={setStakeInput}
                onRemove={removeLeg}
                onClear={clearDraft}
                onCreate={placeBet}
                canCreate={canCreate}
                potentialWin={potentialWin}
                maxStake={balance?.availableBalance}
                onUpdateOccasions={updateLegOccasions}
            />
        </div>
    )
}
