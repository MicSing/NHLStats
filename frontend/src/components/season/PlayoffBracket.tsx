import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CaretLeftIcon, CaretRightIcon, TrophyIcon } from '@phosphor-icons/react'
import type { Match } from '../../types/match'
import { MatchPhase, CompletionType } from '../../types/match'
import { teamLogoUrl } from '../../utils/teamLogoUrl'
import CompletionBadge from '../CompletionBadge'
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
    isDesktop: boolean
}

function isDecisive(match: Match): boolean {
    const ct = normalizeCompletionType(match.completionType)
    return ct === CompletionType.RegularTime || ct === CompletionType.Overtime || ct === CompletionType.Shootout
}

function buildRounds(matches: Match[]): DuelRound[] {
    const playoffMatches = matches.filter((m) => m.phase === MatchPhase.Playoff && m.playoffRound != null)

    const byRound = new Map<number, Match[]>()
    for (const m of playoffMatches) {
        const round = m.playoffRound as number
        const list = byRound.get(round)
        if (list) list.push(m)
        else byRound.set(round, [m])
    }

    const rounds: DuelRound[] = []
    for (const [round, roundMatches] of byRound) {
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
        const winner = teamAWins >= 4 ? teamA : teamBWins >= 4 ? teamB : null

        rounds.push({
            round,
            matches: [...roundMatches].sort((a, b) => a.matchNumber - b.matchNumber),
            teamA,
            teamB,
            winner,
        })
    }

    return rounds.sort((a, b) => a.round - b.round)
}

function TeamRow({ team, isWinner, align }: { team: TeamSide; isWinner: boolean; align: 'left' | 'right' }) {
    const logo = teamLogoUrl(team.shortName)
    const content = (
        <>
            <img
                src={logo}
                alt={team.shortName}
                className="w-6 h-6 sm:w-7 sm:h-7 object-contain flex-shrink-0"
                onError={(e) => { ; (e.target as HTMLImageElement).style.display = 'none' }}
            />
            <span className={`font-bold text-sm truncate ${isWinner ? 'text-text' : 'text-text-muted'}`}>
                {team.shortName || team.name}
            </span>
            {isWinner && <TrophyIcon size={14} className="text-warning flex-shrink-0" />}
        </>
    )
    return (
        <div className={`flex items-center gap-2 min-w-0 ${align === 'right' ? 'flex-row-reverse text-right' : ''}`}>
            {content}
        </div>
    )
}

function DuelCard({ duel }: { duel: DuelRound }) {
    const { t } = useTranslation()
    const [expanded, setExpanded] = useState(false)

    return (
        <div className="bg-surface border border-border rounded-lg shadow-card overflow-hidden w-full sm:w-64 flex-shrink-0">
            <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="w-full text-left p-3 hover:bg-bg/40 transition-colors"
            >
                <div className="text-[10px] uppercase tracking-wider text-text-muted font-bold mb-2 text-center">
                    {t('season.playoffRound', { number: duel.round })}
                </div>
                <div className="flex items-center justify-between gap-2">
                    <TeamRow team={duel.teamA} isWinner={duel.winner?.teamId === duel.teamA.teamId} align="left" />
                    <span className="text-sm font-bold tabular-nums text-text-muted flex-shrink-0">
                        {duel.teamA.wins}&ndash;{duel.teamB.wins}
                    </span>
                    <TeamRow team={duel.teamB} isWinner={duel.winner?.teamId === duel.teamB.teamId} align="right" />
                </div>
            </button>

            {expanded && (
                <div className="border-t border-border/50 divide-y divide-border/50">
                    {duel.matches.map((m) => {
                        const completionType = normalizeCompletionType(m.completionType)
                        return (
                            <div key={m.id} className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
                                <span className="text-text-muted flex-shrink-0 w-16">
                                    {m.matchDate ? new Date(m.matchDate).toLocaleDateString() : t('season.notPlayed')}
                                </span>
                                <span className="flex-1 text-right font-medium truncate">{m.homeTeamShortName}</span>
                                <span className="font-bold tabular-nums px-1">
                                    {m.homeScore}&ndash;{m.awayScore}
                                </span>
                                <span className="flex-1 font-medium truncate">{m.awayTeamShortName}</span>
                                {completionType !== CompletionType.None && <CompletionBadge type={completionType} />}
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

export default function PlayoffBracket({ matches, isDesktop }: Props) {
    const { t } = useTranslation()
    const rounds = buildRounds(matches)
    const [activeIndex, setActiveIndex] = useState(rounds.length > 0 ? rounds.length - 1 : 0)

    useEffect(() => {
        setActiveIndex(rounds.length > 0 ? rounds.length - 1 : 0)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [matches])

    if (rounds.length === 0) {
        return <p className="text-text-muted text-sm py-6 text-center">{t('season.playoffNoRounds')}</p>
    }

    if (isDesktop) {
        return (
            <div className="flex flex-wrap items-start gap-4 py-2" aria-label="Playoff bracket">
                {rounds.map((duel, i) => (
                    <div key={duel.round} className="flex items-center gap-4">
                        <DuelCard duel={duel} />
                        {i < rounds.length - 1 && <div className="w-6 h-0.5 bg-border flex-shrink-0" aria-hidden="true" />}
                    </div>
                ))}
            </div>
        )
    }

    const activeDuel = rounds[Math.min(activeIndex, rounds.length - 1)]

    return (
        <div className="flex items-center justify-center gap-2 py-2" aria-label="Playoff bracket">
            <button
                type="button"
                onClick={() => setActiveIndex((i) => Math.max(0, i - 1))}
                disabled={activeIndex === 0}
                aria-label="Previous round"
                className="p-2 text-text-muted disabled:opacity-30 disabled:cursor-not-allowed hover:text-text transition-colors flex-shrink-0"
            >
                <CaretLeftIcon size={20} />
            </button>
            <DuelCard duel={activeDuel} />
            <button
                type="button"
                onClick={() => setActiveIndex((i) => Math.min(rounds.length - 1, i + 1))}
                disabled={activeIndex === rounds.length - 1}
                aria-label="Next round"
                className="p-2 text-text-muted disabled:opacity-30 disabled:cursor-not-allowed hover:text-text transition-colors flex-shrink-0"
            >
                <CaretRightIcon size={20} />
            </button>
        </div>
    )
}
