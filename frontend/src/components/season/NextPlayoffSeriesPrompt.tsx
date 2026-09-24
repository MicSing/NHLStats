import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { TrophyIcon } from '@phosphor-icons/react'
import apiClient from '../../services/apiClient'
import type { PlayoffStatus } from '../../types/match'
import type { LeagueTypeValue, Team } from '../../types/team'
import PlayoffSeriesCreator from './PlayoffSeriesCreator'
import { getPlayoffRoundName } from './seasonUtils'

interface Props {
    seasonId: number
    hostedTeamId: number
    leagueType: LeagueTypeValue
    /** Bump to re-check the playoff status after matches changed. */
    refreshKey?: number
    onCreated: () => void
}

/**
 * Admin-only card shown once the hosted team has won its latest playoff round and another round
 * exists: asks for the next opponent and generates that series' matches.
 */
export default function NextPlayoffSeriesPrompt({ seasonId, hostedTeamId, leagueType, refreshKey = 0, onCreated }: Props) {
    const { t } = useTranslation()
    const [status, setStatus] = useState<PlayoffStatus | null>(null)
    const [teams, setTeams] = useState<Team[]>([])

    useEffect(() => {
        let cancelled = false
        apiClient
            .get<PlayoffStatus>(`/api/seasons/${seasonId}/matches/playoff-status`)
            .then((data) => { if (!cancelled) setStatus(data) })
            .catch(() => { if (!cancelled) setStatus(null) })
        return () => { cancelled = true }
    }, [seasonId, refreshKey])

    const canCreate = status?.canCreateNextSeries === true
    useEffect(() => {
        if (!canCreate || teams.length > 0) return
        apiClient.get<Team[]>('/api/teams').then(setTeams).catch(() => {})
    }, [canCreate, teams.length])

    if (!status || !canCreate || status.nextRound == null) return null

    const leagueTeams = teams.filter((tm) => tm.leagueType === leagueType)
    const selectableTeams = leagueTeams.length > 0 ? leagueTeams : teams
    const hostedTeam = teams.find((tm) => tm.id === hostedTeamId)

    return (
        <section
            aria-label={t('season.nextSeriesGenerate')}
            className="bg-surface border border-primary/50 rounded-xl p-4 sm:p-5 shadow-card space-y-3"
        >
            <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <TrophyIcon size={18} className="text-primary" />
                </div>
                <div className="min-w-0">
                    <h3 className="text-base font-bold text-text">
                        {t('season.nextSeriesTitle', {
                            team: hostedTeam?.name ?? '',
                            hostedWins: status.hostedWins,
                            opponentWins: status.opponentWins,
                        })}
                    </h3>
                    <p className="text-sm text-text-muted">
                        {t('season.nextSeriesDescription', {
                            round: getPlayoffRoundName(status.nextRound, leagueType, t),
                        })}
                    </p>
                </div>
            </div>
            <PlayoffSeriesCreator
                seasonId={seasonId}
                teams={selectableTeams}
                hostedTeamId={hostedTeamId}
                leagueType={leagueType}
                submitLabel={t('season.nextSeriesGenerate')}
                onSuccess={() => {
                    setStatus(null)
                    onCreated()
                }}
            />
        </section>
    )
}
