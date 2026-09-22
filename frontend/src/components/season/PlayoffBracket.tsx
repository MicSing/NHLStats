import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { TrophyIcon, CaretRightIcon, ArrowRightIcon } from '@phosphor-icons/react'
import type { Match } from '../../types/match'
import { MatchPhase, CompletionType } from '../../types/match'
import type { LeagueTypeValue } from '../../types/team'
import { teamLogoUrl } from '../../utils/teamLogoUrl'
import CompletionBadge from '../CompletionBadge'
import PlayoffMatchModal from './PlayoffMatchModal'
import { normalizeCompletionType } from './seasonUtils'

interface TeamSide {
    teamId: number
    name: string
    shortName: string
    wins: number
}

interface DuelRound {
    round: number
    matches: Match[]
    teamA: TeamSide
    teamB: TeamSide
    winner: TeamSide | null
}

interface Props {
    matches: Match[]
    seasonId?: number
    leagueType?: LeagueTypeValue
    isDesktop?: boolean
}

function isDecisive(match: Match): boolean {
    const ct = normalizeCompletionType(match.completionType)
    return ct === CompletionType.RegularTime || ct === CompletionType.Overtime || ct === CompletionType.Shootout
}

function getRoundName(round: number, leagueType: LeagueTypeValue, t: (key: string, options?: Record<string, unknown>) => string): string {
    if (leagueType === 'IIHF') {
        switch (round) {
            case 1: return t('season.playoffRoundIihf1')
            case 2: return t('season.playoffRoundIihf2')
            case 3: return t('season.playoffRoundIihf3')
            default: return t('season.playoffRound', { number: round })
        }
    } else {
        switch (round) {
            case 1: return t('season.playoffRoundNhl1')
            case 2: return t('season.playoffRoundNhl2')
            case 3: return t('season.playoffRoundNhl3')
            case 4: return t('season.playoffRoundNhl4')
            default: return t('season.playoffRound', { number: round })
        }
    }
}

function buildRoundData(round: number, matches: Match[], leagueType: LeagueTypeValue): DuelRound | null {
    const roundMatches = matches
        .filter((m) => m.phase === MatchPhase.Playoff && m.playoffRound === round)
        .sort((a, b) => a.matchNumber - b.matchNumber)

    if (roundMatches.length === 0) return null

    const first = roundMatches[0]
    const teamAId = first.homeTeamId
    const teamBId = first.awayTeamId

    let teamAWins = 0
    let teamBWins = 0
    let teamAName = first.homeTeamName ?? ''
    let teamAShort = first.homeTeamShortName ?? ''
    let teamBName = first.awayTeamName ?? ''
    let teamBShort = first.awayTeamShortName ?? ''

    for (const m of roundMatches) {
        const isTeamAHome = m.homeTeamId === teamAId
        if (isTeamAHome) {
            teamAName = m.homeTeamName ?? teamAName
            teamAShort = m.homeTeamShortName ?? teamAShort
            teamBName = m.awayTeamName ?? teamBName
            teamBShort = m.awayTeamShortName ?? teamBShort
        } else {
            teamAName = m.awayTeamName ?? teamAName
            teamAShort = m.awayTeamShortName ?? teamAShort
            teamBName = m.homeTeamName ?? teamBName
            teamBShort = m.homeTeamShortName ?? teamBShort
        }

        if (!isDecisive(m)) continue
        const homeWon = m.homeScore > m.awayScore
        const homeIsTeamA = m.homeTeamId === teamAId
        if (homeWon === homeIsTeamA) teamAWins++
        else teamBWins++
    }

    const teamA: TeamSide = { teamId: teamAId, name: teamAName, shortName: teamAShort, wins: teamAWins }
    const teamB: TeamSide = { teamId: teamBId, name: teamBName, shortName: teamBShort, wins: teamBWins }

    const isBestOf1 = leagueType === 'IIHF'
    const winnerThreshold = isBestOf1 ? 1 : 4
    const winner = teamAWins >= winnerThreshold ? teamA : teamBWins >= winnerThreshold ? teamB : null

    return {
        round,
        matches: roundMatches,
        teamA,
        teamB,
        winner,
    }
}

export default function PlayoffBracket({
    matches,
    seasonId,
    leagueType = 'NHL',
}: Props) {
    const { t } = useTranslation()

    const playoffMatches = useMemo(
        () => matches.filter((m) => m.phase === MatchPhase.Playoff && m.playoffRound != null),
        [matches]
    )

    const totalRounds = leagueType === 'IIHF' ? 3 : 4
    const roundSlots = useMemo(() => {
        const slots: { round: number; name: string; duel: DuelRound | null }[] = []
        for (let r = 1; r <= totalRounds; r++) {
            slots.push({
                round: r,
                name: getRoundName(r, leagueType, t),
                duel: buildRoundData(r, playoffMatches, leagueType),
            })
        }
        return slots
    }, [totalRounds, leagueType, t, playoffMatches])

    // Find first round with matches, or default to 1
    const initialRound = useMemo(() => {
        const found = roundSlots.find((s) => s.duel != null)
        return found ? found.round : 1
    }, [roundSlots])

    const [selectedRound, setSelectedRound] = useState<number>(initialRound)
    const [modalMatch, setModalMatch] = useState<Match | null>(null)
    const [modalGameLabel, setModalGameLabel] = useState<string | undefined>(undefined)

    if (playoffMatches.length === 0) {
        return <p className="text-text-muted text-sm py-8 text-center">{t('season.playoffNoRounds')}</p>
    }

    const currentSeasonId = seasonId ?? (matches[0]?.seasonId ?? 0)
    const activeSlot = roundSlots.find((s) => s.round === selectedRound) ?? roundSlots[0]
    const isIIHF = leagueType === 'IIHF'

    const handleRoundClick = (slot: { round: number; name: string; duel: DuelRound | null }) => {
        if (isIIHF) {
            // In IIHF, single match playoffs (best of 1), clicking the round directly opens the match modal
            if (slot.duel && slot.duel.matches.length > 0) {
                setModalMatch(slot.duel.matches[0])
                setModalGameLabel(slot.name)
            }
        } else {
            // In NHL, select round to display its matches below
            setSelectedRound(slot.round)
        }
    }

    const openMatchModal = (match: Match, gameIndex?: number) => {
        setModalMatch(match)
        setModalGameLabel(
            gameIndex !== undefined
                ? t('season.playoffGameNumber', { number: gameIndex + 1 })
                : undefined
        )
    }

    return (
        <div className="space-y-6 py-2" aria-label="Playoff bracket">
            {/* Top Row: All rounds in ONE row */}
            <div className="w-full overflow-x-auto pb-3 pt-1 no-scrollbar">
                <div className="flex items-stretch gap-3 sm:gap-4 min-w-[720px] lg:min-w-0">
                    {roundSlots.map((slot, index) => {
                        const { round, name, duel } = slot
                        const isSelected = !isIIHF && selectedRound === round
                        const hasMatches = duel != null && duel.matches.length > 0

                        return (
                            <div key={round} className="flex-1 flex items-center min-w-[200px]">
                                <div
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => handleRoundClick(slot)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault()
                                            handleRoundClick(slot)
                                        }
                                    }}
                                    className={`w-full rounded-xl border p-4 transition-all text-left flex flex-col justify-between cursor-pointer select-none ${
                                        isSelected
                                            ? 'bg-surface border-primary ring-2 ring-primary/40 shadow-lg'
                                            : hasMatches
                                            ? 'bg-surface/90 hover:bg-surface border-border hover:border-border-hover shadow-card'
                                            : 'bg-surface/40 border-border/40 text-text-muted'
                                    }`}
                                >
                                    {/* Round Header */}
                                    <div className="flex items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-border/60">
                                        <span className={`text-xs font-bold uppercase tracking-wider truncate ${isSelected ? 'text-primary' : 'text-text'}`}>
                                            {name}
                                        </span>
                                        {hasMatches && duel.winner && (
                                            <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-warning bg-warning/10 border border-warning/30 px-1.5 py-0.5 rounded flex-shrink-0">
                                                <TrophyIcon size={11} weight="fill" />
                                                <span className="hidden sm:inline">{t('season.playoffWinner')}</span>
                                            </span>
                                        )}
                                        {!hasMatches && (
                                            <span className="text-[10px] uppercase tracking-wider font-semibold text-text-muted/70 bg-bg px-1.5 py-0.5 rounded border border-border/40">
                                                {t('season.playoffUpcoming')}
                                            </span>
                                        )}
                                    </div>

                                    {/* Matchup Duel Body */}
                                    {hasMatches && duel ? (
                                        <div className="space-y-2.5">
                                            {/* Team A Row */}
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <img
                                                        src={teamLogoUrl(duel.teamA.shortName)}
                                                        alt={duel.teamA.shortName}
                                                        className="w-6 h-6 object-contain flex-shrink-0"
                                                        onError={(e) => { ;(e.target as HTMLImageElement).style.display = 'none' }}
                                                    />
                                                    <span className={`text-sm truncate ${
                                                        duel.winner?.teamId === duel.teamA.teamId
                                                            ? 'font-bold text-text'
                                                            : duel.winner
                                                            ? 'text-text-muted opacity-70 font-medium'
                                                            : 'font-semibold text-text'
                                                    }`}>
                                                        {duel.teamA.shortName || duel.teamA.name}
                                                    </span>
                                                    {duel.winner?.teamId === duel.teamA.teamId && (
                                                        <TrophyIcon size={13} weight="fill" className="text-warning flex-shrink-0" />
                                                    )}
                                                </div>
                                                <span className={`text-sm font-bold tabular-nums px-1.5 py-0.5 rounded ${
                                                    duel.winner?.teamId === duel.teamA.teamId
                                                        ? 'bg-primary/10 text-primary font-black'
                                                        : 'text-text-muted'
                                                }`}>
                                                    {isIIHF && duel.matches[0]
                                                        ? (duel.matches[0].homeTeamId === duel.teamA.teamId ? duel.matches[0].homeScore : duel.matches[0].awayScore)
                                                        : duel.teamA.wins}
                                                </span>
                                            </div>

                                            {/* Team B Row */}
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <img
                                                        src={teamLogoUrl(duel.teamB.shortName)}
                                                        alt={duel.teamB.shortName}
                                                        className="w-6 h-6 object-contain flex-shrink-0"
                                                        onError={(e) => { ;(e.target as HTMLImageElement).style.display = 'none' }}
                                                    />
                                                    <span className={`text-sm truncate ${
                                                        duel.winner?.teamId === duel.teamB.teamId
                                                            ? 'font-bold text-text'
                                                            : duel.winner
                                                            ? 'text-text-muted opacity-70 font-medium'
                                                            : 'font-semibold text-text'
                                                    }`}>
                                                        {duel.teamB.shortName || duel.teamB.name}
                                                    </span>
                                                    {duel.winner?.teamId === duel.teamB.teamId && (
                                                        <TrophyIcon size={13} weight="fill" className="text-warning flex-shrink-0" />
                                                    )}
                                                </div>
                                                <span className={`text-sm font-bold tabular-nums px-1.5 py-0.5 rounded ${
                                                    duel.winner?.teamId === duel.teamB.teamId
                                                        ? 'bg-primary/10 text-primary font-black'
                                                        : 'text-text-muted'
                                                }`}>
                                                    {isIIHF && duel.matches[0]
                                                        ? (duel.matches[0].homeTeamId === duel.teamB.teamId ? duel.matches[0].homeScore : duel.matches[0].awayScore)
                                                        : duel.teamB.wins}
                                                </span>
                                            </div>

                                            {/* Series/Match status line */}
                                            <div className="pt-2 mt-1 border-t border-border/40 flex items-center justify-between text-[11px] text-text-muted">
                                                <span>
                                                    {isIIHF
                                                        ? t('season.playoffBestOf1')
                                                        : `${duel.teamA.wins}–${duel.teamB.wins}`}
                                                </span>
                                                <span className="text-primary font-medium flex items-center gap-0.5">
                                                    {isIIHF ? t('season.playoffMatchDetails') : t('common.showMore')}
                                                    <CaretRightIcon size={12} />
                                                </span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="py-4 text-center">
                                            <p className="text-xs text-text-muted/60 font-medium">
                                                {t('season.playoffAwaiting')}
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Step Connector Arrow between rounds */}
                                {index < roundSlots.length - 1 && (
                                    <div className="px-2 text-border flex-shrink-0 hidden lg:block" aria-hidden="true">
                                        <ArrowRightIcon size={16} />
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Below Playoffs Section: For NHL, displays individual matches of the selected round */}
            {!isIIHF && (
                <div className="bg-surface border border-border rounded-xl p-5 sm:p-6 shadow-card space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-border gap-2">
                        <div className="flex items-center gap-3">
                            <h3 className="text-base sm:text-lg font-bold text-text">
                                {t('season.playoffRoundMatches', { round: activeSlot.name })}
                            </h3>
                            <span className="text-xs font-semibold uppercase tracking-wider text-text-muted bg-bg px-2.5 py-0.5 rounded-full border border-border">
                                {t('season.playoffBestOf7')}
                            </span>
                        </div>
                        {activeSlot.duel && (
                            <span className="text-xs font-semibold tabular-nums text-text-muted">
                                {activeSlot.duel.teamA.shortName} {activeSlot.duel.teamA.wins} &ndash; {activeSlot.duel.teamB.wins} {activeSlot.duel.teamB.shortName}
                            </span>
                        )}
                    </div>

                    {activeSlot.duel && activeSlot.duel.matches.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                            {activeSlot.duel.matches.map((m, idx) => {
                                const decisive = isDecisive(m)
                                const homeWon = decisive && m.homeScore > m.awayScore
                                const awayWon = decisive && m.awayScore > m.homeScore
                                const completionType = normalizeCompletionType(m.completionType)

                                return (
                                    <div
                                        key={m.id}
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => openMatchModal(m, idx)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault()
                                                openMatchModal(m, idx)
                                            }
                                        }}
                                        className="group bg-bg/50 hover:bg-bg border border-border/80 hover:border-primary/50 rounded-lg p-3 sm:p-4 transition-all cursor-pointer flex flex-col justify-between gap-3 shadow-sm hover:shadow-md"
                                    >
                                        <div className="flex items-center justify-between text-xs text-text-muted">
                                            <span className="font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                                                {t('season.playoffGameNumber', { number: idx + 1 })}
                                            </span>
                                            <div className="flex items-center gap-2">
                                                {m.matchDate ? (
                                                    <span>{new Date(m.matchDate).toLocaleDateString()}</span>
                                                ) : (
                                                    <span className="italic">{t('season.notPlayed')}</span>
                                                )}
                                                {completionType !== CompletionType.None && (
                                                    <CompletionBadge type={completionType} />
                                                )}
                                            </div>
                                        </div>

                                        {/* Match Teams & Scores with Prominent Winner Visibility */}
                                        <div className="grid grid-cols-7 items-center gap-2 py-1">
                                            {/* Home Team */}
                                            <div className={`col-span-3 flex items-center gap-2 min-w-0 ${homeWon ? '' : awayWon ? 'opacity-60' : ''}`}>
                                                <img
                                                    src={teamLogoUrl(m.homeTeamShortName)}
                                                    alt={m.homeTeamShortName ?? ''}
                                                    className="w-7 h-7 object-contain flex-shrink-0"
                                                    onError={(e) => { ;(e.target as HTMLImageElement).style.display = 'none' }}
                                                />
                                                <div className="min-w-0">
                                                    <span className={`text-sm truncate block ${homeWon ? 'font-bold text-text' : 'font-medium text-text-muted'}`}>
                                                        {m.homeTeamShortName || m.homeTeamName}
                                                    </span>
                                                    {homeWon && (
                                                        <span className="text-[10px] font-bold uppercase tracking-wider text-warning flex items-center gap-0.5">
                                                            <TrophyIcon size={10} weight="fill" /> {t('season.playoffWinner')}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Score */}
                                            <div className="col-span-1 text-center font-bold tabular-nums text-base">
                                                <span className={homeWon ? 'text-primary font-black' : 'text-text'}>{m.homeScore}</span>
                                                <span className="text-text-muted mx-1">:</span>
                                                <span className={awayWon ? 'text-primary font-black' : 'text-text'}>{m.awayScore}</span>
                                            </div>

                                            {/* Away Team */}
                                            <div className={`col-span-3 flex items-center justify-end gap-2 text-right min-w-0 ${awayWon ? '' : homeWon ? 'opacity-60' : ''}`}>
                                                <div className="min-w-0">
                                                    <span className={`text-sm truncate block ${awayWon ? 'font-bold text-text' : 'font-medium text-text-muted'}`}>
                                                        {m.awayTeamShortName || m.awayTeamName}
                                                    </span>
                                                    {awayWon && (
                                                        <span className="text-[10px] font-bold uppercase tracking-wider text-warning flex items-center justify-end gap-0.5">
                                                            <TrophyIcon size={10} weight="fill" /> {t('season.playoffWinner')}
                                                        </span>
                                                    )}
                                                </div>
                                                <img
                                                    src={teamLogoUrl(m.awayTeamShortName)}
                                                    alt={m.awayTeamShortName ?? ''}
                                                    className="w-7 h-7 object-contain flex-shrink-0"
                                                    onError={(e) => { ;(e.target as HTMLImageElement).style.display = 'none' }}
                                                />
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-end text-[11px] text-text-muted group-hover:text-primary transition-colors">
                                            <span className="flex items-center gap-1 font-medium">
                                                {t('season.playoffMatchDetails')}
                                                <CaretRightIcon size={12} />
                                            </span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    ) : (
                        <p className="text-sm text-text-muted italic py-6 text-center">
                            {t('season.playoffAwaiting')}
                        </p>
                    )}
                </div>
            )}

            {/* Match Modal */}
            {modalMatch && (
                <PlayoffMatchModal
                    match={modalMatch}
                    seasonId={currentSeasonId}
                    roundName={activeSlot.name}
                    gameLabel={modalGameLabel}
                    onClose={() => setModalMatch(null)}
                />
            )}
        </div>
    )
}
