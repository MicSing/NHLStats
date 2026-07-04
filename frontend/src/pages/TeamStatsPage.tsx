import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { teamStatsService } from '../services/teamStatsService'
import type { TeamOption, TeamStatsMatch, TeamStatsSummary } from '../types/teamStats'
import TeamStatsSummaryTable from '../components/teamStats/TeamStatsSummaryTable'
import TeamStatsMatchList from '../components/teamStats/TeamStatsMatchList'
import TeamStatsCharts from '../components/teamStats/TeamStatsCharts'
import { deriveMatchResults, tallyRecord } from '../utils/teamStatsRecord'

function parseTeamIdParam(value: string | null): number | null {
    if (!value) return null
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
}

export default function TeamStatsPage() {
    const { t } = useTranslation()
    const [searchParams, setSearchParams] = useSearchParams()

    const [hostedTeams, setHostedTeams] = useState<TeamOption[]>([])
    const [selectedHostedTeamId, setSelectedHostedTeamId] = useState<number | null>(
        () => parseTeamIdParam(searchParams.get('hostedTeamId')),
    )
    const [loadingHostedTeams, setLoadingHostedTeams] = useState(true)

    const [opponents, setOpponents] = useState<TeamOption[]>([])
    const [selectedOpponentTeamId, setSelectedOpponentTeamId] = useState<number | null>(
        () => parseTeamIdParam(searchParams.get('opponentTeamId')),
    )
    const [loadingOpponents, setLoadingOpponents] = useState(false)
    const pendingInitialOpponentId = useRef(selectedOpponentTeamId)

    const [summary, setSummary] = useState<TeamStatsSummary | null>(null)
    const [matches, setMatches] = useState<TeamStatsMatch[]>([])
    const [loadingStats, setLoadingStats] = useState(false)

    const selectClass = 'bg-surface border border-border text-text text-sm rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary transition-colors appearance-none disabled:opacity-60 disabled:cursor-not-allowed'

    function handleHostedTeamChange(id: number | null) {
        setSelectedHostedTeamId(id)
        setSearchParams((p) => {
            if (id != null) p.set('hostedTeamId', String(id)); else p.delete('hostedTeamId')
            p.delete('opponentTeamId')
            return p
        }, { replace: true })
    }

    function handleOpponentTeamChange(id: number | null) {
        setSelectedOpponentTeamId(id)
        setSearchParams((p) => {
            if (id != null) p.set('opponentTeamId', String(id)); else p.delete('opponentTeamId')
            return p
        }, { replace: true })
    }

    useEffect(() => {
        teamStatsService.getHostedTeams()
            .then((teams) => {
                setHostedTeams(teams)
                setSelectedHostedTeamId((current) => {
                    if (current != null && teams.some((t) => t.id === current)) return current
                    return teams.length > 0 ? teams[0].id : null
                })
            })
            .catch(() => setHostedTeams([]))
            .finally(() => setLoadingHostedTeams(false))
    }, [])

    useEffect(() => {
        if (selectedHostedTeamId == null) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setOpponents([])
            setSelectedOpponentTeamId(null)
            return
        }
        setLoadingOpponents(true)
        teamStatsService.getOpponents(selectedHostedTeamId)
            .then((teams) => {
                const sorted = [...teams].sort((a, b) => a.name.localeCompare(b.name))
                setOpponents(sorted)
                const pendingId = pendingInitialOpponentId.current
                pendingInitialOpponentId.current = null
                if (pendingId != null && sorted.some((t) => t.id === pendingId)) {
                    setSelectedOpponentTeamId(pendingId)
                } else {
                    setSelectedOpponentTeamId(sorted.length > 0 ? sorted[0].id : null)
                }
            })
            .catch(() => {
                setOpponents([])
                setSelectedOpponentTeamId(null)
            })
            .finally(() => setLoadingOpponents(false))
    }, [selectedHostedTeamId])

    useEffect(() => {
        if (selectedHostedTeamId == null || selectedOpponentTeamId == null) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setSummary(null)
            setMatches([])
            return
        }
        setLoadingStats(true)
        Promise.all([
            teamStatsService.getSummary(selectedHostedTeamId, selectedOpponentTeamId),
            teamStatsService.getMatches(selectedHostedTeamId, selectedOpponentTeamId),
        ])
            .then(([summaryData, matchesData]) => {
                setSummary(summaryData)
                setMatches(matchesData)
            })
            .catch(() => {
                setSummary(null)
                setMatches([])
            })
            .finally(() => setLoadingStats(false))
    }, [selectedHostedTeamId, selectedOpponentTeamId])

    const hostedTeam = hostedTeams.find((t) => t.id === selectedHostedTeamId) ?? null
    const opponentTeam = opponents.find((t) => t.id === selectedOpponentTeamId) ?? null
    const record = tallyRecord(deriveMatchResults(matches))

    return (
        <div>
            <header className="sticky top-0 z-40 bg-bg/80 backdrop-blur-md border-b border-border px-6 py-3">
                <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <h1 className="text-lg font-semibold tracking-tight text-text">{t('teamStats.title')}</h1>
                    <div className="flex gap-3 flex-wrap">
                        {loadingHostedTeams ? (
                            <span className="text-text-muted text-sm">{t('teamStats.loadingTeams')}</span>
                        ) : (
                            <select
                                aria-label={t('teamStats.selectHostedTeam')}
                                value={selectedHostedTeamId ?? ''}
                                disabled={hostedTeams.length <= 1}
                                onChange={(e) => handleHostedTeamChange(e.target.value ? Number(e.target.value) : null)}
                                className={selectClass}
                            >
                                {hostedTeams.length === 0 && <option value="">{t('teamStats.noHostedTeams')}</option>}
                                {hostedTeams.map((team) => (
                                    <option key={team.id} value={team.id}>{team.name}</option>
                                ))}
                            </select>
                        )}
                        {loadingOpponents ? (
                            <span className="text-text-muted text-sm">{t('teamStats.loadingOpponents')}</span>
                        ) : (
                            <select
                                aria-label={t('teamStats.selectOpponent')}
                                value={selectedOpponentTeamId ?? ''}
                                disabled={opponents.length === 0}
                                onChange={(e) => handleOpponentTeamChange(e.target.value ? Number(e.target.value) : null)}
                                className={selectClass}
                            >
                                {opponents.length === 0 && <option value="">{t('teamStats.noOpponents')}</option>}
                                {opponents.map((team) => (
                                    <option key={team.id} value={team.id}>{team.name}</option>
                                ))}
                            </select>
                        )}
                        {loadingStats && (
                            <span className="text-text-muted text-sm self-center">{t('teamStats.loadingStats')}</span>
                        )}
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
                {!loadingHostedTeams && hostedTeams.length === 0 && (
                    <div className="bg-surface border border-border rounded-lg p-6 text-center text-text-muted text-sm">
                        {t('teamStats.noHostedTeams')}
                    </div>
                )}

                {summary && selectedHostedTeamId != null && selectedOpponentTeamId != null && hostedTeam && opponentTeam && (
                    <>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="bg-surface border border-border rounded-lg p-4 shadow-card flex flex-col items-center justify-center text-center">
                                        <span className="text-xs text-text-muted uppercase tracking-wider mb-1 font-semibold">{t('teamStats.matchesTitle')}</span>
                                        <span className="text-2xl font-bold text-text tabular-nums">{summary.matchesPlayed}</span>
                                    </div>
                                    <div className="bg-surface border border-border rounded-lg p-4 shadow-card flex flex-col items-center justify-center text-center">
                                        <span className="text-xs text-text-muted uppercase tracking-wider mb-1 font-semibold">{t('teamStats.totalPlusPoints')}</span>
                                        <span className="text-2xl font-bold text-success tabular-nums">+{summary.totalPlusPoints}</span>
                                    </div>
                                    <div className="bg-surface border border-border rounded-lg p-4 shadow-card flex flex-col items-center justify-center text-center">
                                        <span className="text-xs text-text-muted uppercase tracking-wider mb-1 font-semibold">{t('teamStats.totalMinusPoints')}</span>
                                        <span className="text-2xl font-bold text-danger tabular-nums">−{summary.totalMinusPoints}</span>
                                    </div>
                                </div>

                                <TeamStatsCharts matches={matches} hostedTeam={hostedTeam} opponentTeam={opponentTeam} />

                                <div className="mb-8">
                                    <TeamStatsSummaryTable summary={summary} />
                                </div>
                                <div className="mt-8">
                                    <TeamStatsMatchList matches={matches} hostedTeam={hostedTeam} opponentTeam={opponentTeam} />
                                </div>
                    </>
                )}
            </main>
        </div>
    )
}
