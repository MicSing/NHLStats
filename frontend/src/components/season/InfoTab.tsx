import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Season, CreateSeasonDto, UpdateSeasonDto } from '../../types/season'
import type { Team } from '../../types/team'
import apiClient from '../../services/apiClient'
import { cacheService } from '../../services/cacheService'
import { useToast } from '../../context/ToastContext'
import SeasonForm from './SeasonForm'

export interface InfoTabProps {
    season: Season
    teams: Team[]
    onSeasonUpdated: (season: Season) => void
    onSeasonDeleted: (id: number) => void
}

export default function InfoTab({ season, teams, onSeasonUpdated, onSeasonDeleted }: InfoTabProps) {
    const { t } = useTranslation()
    const toast = useToast()
    const [form, setForm] = useState<CreateSeasonDto>({
        name: season.name,
        startedOn: season.startedOn.split('T')[0],
        status: season.status,
        hostedTeamId: season.hostedTeamId,
        leagueType: season.leagueType,
    })
    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            const dto: UpdateSeasonDto = { ...form }
            await apiClient.put<Season>(`/api/seasons/${season.id}`, dto)
            cacheService.invalidateSeasons()
            toast.success(t('toast.saveSuccess'))
            onSeasonUpdated({
                ...season,
                name: form.name,
                startedOn: form.startedOn,
                status: form.status ?? 'Active',
                hostedTeamId: form.hostedTeamId ?? null,
                leagueType: form.leagueType,
            })
        } catch {
            toast.error(t('toast.operationFailed'))
        }
    }

    const handleDelete = async () => {
        if (!window.confirm(t('admin.seasons.deleteSeason'))) return
        try {
            await apiClient.delete(`/api/seasons/${season.id}`)
            cacheService.invalidateSeasons()
            toast.success(t('toast.deleteSuccess'))
            onSeasonDeleted(season.id)
        } catch {
            toast.error(t('toast.operationFailed'))
        }
    }

    return (
        <div className="max-w-2xl space-y-6">
            <div className="bg-surface border border-border rounded-lg p-6">
                <h2 className="text-base font-semibold mb-4">{t('admin.seasons.basicInformation')}</h2>
                <SeasonForm
                    form={form}
                    teams={teams}
                    onChange={setForm}
                    onSubmit={(e) => void handleSave(e)}
                    submitLabel={t('common.save')}
                    inlineMode
                />
            </div>

            <div className="bg-red-950/20 border border-red-900/30 rounded-lg p-6 flex items-start justify-between gap-4">
                <div>
                    <h3 className="text-red-400 font-medium mb-1">Danger Zone</h3>
                    <p className="text-sm text-text-muted">
                        Deleting this season will permanently remove all linked matches and stats.
                    </p>
                </div>
                <button
                    onClick={() => void handleDelete()}
                    className="shrink-0 px-4 py-2 bg-transparent border border-red-700/50 hover:bg-red-600 text-red-400 hover:text-white rounded text-sm font-medium transition-colors"
                >
                    {t('common.delete')}
                </button>
            </div>
        </div>
    )
}
