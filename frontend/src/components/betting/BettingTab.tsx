import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useToast } from '../../context/ToastContext'
import { bettingService } from '../../services/bettingService'
import type { BettingBalanceDto, BetDto, CreateBetLegDto, MatchOddsDto } from '../../types/bet'
import type { FutureMatch } from '../../types/match'
import { type DraftLeg, legKey, teamOutcomeTypes } from './bettingTypes'
import LiveTicketsSection from './LiveTicketsSection'
import MarketsSection from './MarketsSection'
import TicketDraftSection from './TicketDraftSection'
import UpcomingMatchesSection from './UpcomingMatchesSection'

interface BettingTabProps {
    userId: number
    onBalanceChanged: (b: BettingBalanceDto) => void
}

export default function BettingTab({ userId, onBalanceChanged }: BettingTabProps) {
    const { t } = useTranslation()
    const { success, error } = useToast()

    const [matches, setMatches] = useState<FutureMatch[]>([])
    const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null)
    const [oddsByMatch, setOddsByMatch] = useState<Record<number, MatchOddsDto | null>>({})
    const [draftLegs, setDraftLegs] = useState<DraftLeg[]>([])
    const [stakeInput, setStakeInput] = useState<string>('')
    const [activeBets, setActiveBets] = useState<BetDto[]>([])
    const [balance, setBalance] = useState<BettingBalanceDto | null>(null)

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

    const selectedMatch = matches.find((m) => m.id === selectedMatchId) ?? null
    const selectedOdds = selectedMatchId != null ? oddsByMatch[selectedMatchId] ?? null : null

    const totalOdds = useMemo(
        () => draftLegs.reduce((p, l) => p * l.odds, 1),
        [draftLegs],
    )

    const stake = parseFloat(stakeInput)
    const stakeValid = Number.isFinite(stake) && stake > 0
    const potentialWin = stakeValid ? stake * totalOdds : 0

    const selectMatch = (id: number) => {
        setSelectedMatchId(id)
        void ensureOdds(id)
    }

    const addLeg = (leg: Omit<DraftLeg, 'key'>) => {
        const key = legKey(leg.matchId, leg.betType, leg.userId ?? leg.teamId ?? null)
        if (draftLegs.some((l) => l.key === key)) return
        if (
            teamOutcomeTypes.includes(leg.betType) &&
            draftLegs.some((l) => l.matchId === leg.matchId && teamOutcomeTypes.includes(l.betType))
        ) {
            error(t('betting.oneMatchResultPerMatch'))
            return
        }
        setDraftLegs((prev) => [...prev, { ...leg, key }])
    }

    const removeLeg = (key: string) => {
        setDraftLegs((prev) => prev.filter((l) => l.key !== key))
    }

    const clearDraft = () => {
        setDraftLegs([])
        setStakeInput('')
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
            />
        </div>
    )
}
