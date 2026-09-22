import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { CreatePlayoffSeriesDto } from '../../types/match'
import type { Team } from '../../types/team'
import apiClient from '../../services/apiClient'
import SearchableSelect from '../SearchableSelect'

// Standard 2-2-1-1-1 playoff format, expressed as whether the hosted team is home in each game.
const BASE_HOSTED_IS_HOME_PATTERN = [true, true, false, false, true, false, true]

export interface PlayoffSeriesCreatorProps {
    seasonId: number
    teams: Team[]
    hostedTeamId: number | null
    onSuccess: () => void
    onClose: () => void
}

export default function PlayoffSeriesCreator({
    seasonId,
    teams,
    hostedTeamId,
    onSuccess,
    onClose,
}: PlayoffSeriesCreatorProps) {
    const { t } = useTranslation()
    const [opponentTeamId, setOpponentTeamId] = useState<number | ''>('')
    const [startsHome, setStartsHome] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [submitting, setSubmitting] = useState(false)

    const hostedTeam = teams.find((tm) => tm.id === hostedTeamId) ?? null
    const opponentTeam = opponentTeamId !== '' ? (teams.find((tm) => tm.id === opponentTeamId) ?? null) : null
    const teamOptions = teams
        .filter((tm) => tm.id !== hostedTeamId)
        .map((tm) => ({ value: tm.id, label: tm.name }))

    const pattern = BASE_HOSTED_IS_HOME_PATTERN.map((baseHostedIsHome) =>
        startsHome ? baseHostedIsHome : !baseHostedIsHome,
    )

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!hostedTeamId || opponentTeamId === '') return
        setSubmitting(true)
        setError(null)
        try {
            const dto: CreatePlayoffSeriesDto = {
                opponentTeamId: opponentTeamId as number,
                startsHome,
            }
            await apiClient.post(`/api/seasons/${seasonId}/matches/playoff-series`, dto)
            onSuccess()
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : t('errors.batchCreateFailed')
            setError(msg)
        } finally {
            setSubmitting(false)
        }
    }

    if (!hostedTeamId) {
        return (
            <div className="space-y-4 min-w-[420px]">
                <p className="text-danger text-sm">{t('admin.matches.playoffSeriesNoHostedTeam')}</p>
                <button
                    type="button"
                    onClick={onClose}
                    className="bg-border hover:bg-border/80 px-4 py-2 rounded text-sm"
                >
                    {t('common.cancel')}
                </button>
            </div>
        )
    }

    return (
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 min-w-[420px]">
            <p className="text-xs text-text-muted">{t('admin.matches.playoffSeriesDescription')}</p>

            <div>
                <label className="label">{t('admin.matches.opponentTeam')}</label>
                <SearchableSelect
                    options={teamOptions}
                    value={opponentTeamId}
                    onChange={(v) => setOpponentTeamId(v as number | '')}
                    placeholder={t('common.select')}
                />
            </div>

            <div className="flex items-center gap-2">
                <input
                    id="playoff-starts-home"
                    type="checkbox"
                    checked={startsHome}
                    onChange={(e) => setStartsHome(e.target.checked)}
                    className="h-4 w-4"
                />
                <label htmlFor="playoff-starts-home" className="text-sm text-text">
                    {t('admin.matches.playoffStartsHome', { team: hostedTeam?.name ?? '' })}
                </label>
            </div>

            {opponentTeam && (
                <div>
                    <p className="text-xs text-text-muted mb-1 uppercase tracking-wider">
                        {t('admin.matches.playoffSeriesPreview')}
                    </p>
                    <ol className="text-sm space-y-0.5 font-mono">
                        {pattern.map((hostedIsHome, i) => (
                            <li key={i} className="text-text">
                                <span className="text-text-muted">{i + 1}.</span>{' '}
                                {hostedIsHome
                                    ? `${hostedTeam?.shortName} vs ${opponentTeam.shortName}`
                                    : `${hostedTeam?.shortName} @ ${opponentTeam.shortName}`}
                            </li>
                        ))}
                    </ol>
                </div>
            )}

            {error && <p className="text-danger text-sm">{error}</p>}

            <div className="flex gap-3 pt-1">
                <button
                    type="submit"
                    disabled={submitting || opponentTeamId === ''}
                    className="bg-primary hover:bg-primary-hover px-4 py-2 rounded text-sm disabled:opacity-50"
                >
                    {t('admin.matches.createPlayoffSeries')}
                </button>
                <button
                    type="button"
                    onClick={onClose}
                    className="bg-border hover:bg-border/80 px-4 py-2 rounded text-sm"
                >
                    {t('common.cancel')}
                </button>
            </div>
        </form>
    )
}
