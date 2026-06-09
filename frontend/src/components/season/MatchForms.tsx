import { useTranslation } from 'react-i18next'
import { CompletionType } from '../../types/match'
import type { CreateMatchDto, UpdateMatchDto } from '../../types/match'
import type { Team } from '../../types/team'
import SearchableSelect from '../SearchableSelect'

export interface CreateMatchFormProps {
    teams: Team[]
    form: CreateMatchDto
    onChange: (form: CreateMatchDto) => void
    onSubmit: (e: React.FormEvent) => void
    onCancel: () => void
}

export function CreateMatchForm({ teams, form, onChange, onSubmit, onCancel }: CreateMatchFormProps) {
    const { t } = useTranslation()
    const teamOptions = teams.map((tm) => ({ value: tm.id, label: tm.name }))
    return (
        <form onSubmit={onSubmit} className="space-y-4">
            <div>
                <label className="label">{t('admin.matches.homeTeam')}</label>
                <SearchableSelect
                    options={teamOptions}
                    value={form.homeTeamId || ''}
                    onChange={(v) => onChange({ ...form, homeTeamId: v as number })}
                    placeholder={t('common.select')}
                />
            </div>
            <div>
                <label className="label">{t('admin.matches.awayTeam')}</label>
                <SearchableSelect
                    options={teamOptions}
                    value={form.awayTeamId || ''}
                    onChange={(v) => onChange({ ...form, awayTeamId: v as number })}
                    placeholder={t('common.select')}
                />
            </div>
            <div className="flex gap-3 pt-2">
                <button
                    type="submit"
                    disabled={!form.homeTeamId || !form.awayTeamId}
                    className="bg-primary hover:bg-primary-hover px-4 py-2 rounded text-sm disabled:opacity-50"
                >
                    {t('common.create')}
                </button>
                <button
                    type="button"
                    onClick={onCancel}
                    className="bg-border hover:bg-border/80 px-4 py-2 rounded text-sm"
                >
                    {t('common.cancel')}
                </button>
            </div>
        </form>
    )
}

export interface EditMatchFormProps {
    teams: Team[]
    form: UpdateMatchDto
    onChange: (form: UpdateMatchDto) => void
    onSubmit: (e: React.FormEvent) => void
    onCancel: () => void
}

export function EditMatchForm({ teams, form, onChange, onSubmit, onCancel }: EditMatchFormProps) {
    const { t } = useTranslation()
    const teamOptions = teams.map((tm) => ({ value: tm.id, label: tm.name }))
    return (
        <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="label">{t('admin.matches.homeTeam')}</label>
                    <SearchableSelect
                        options={teamOptions}
                        value={form.homeTeamId || ''}
                        onChange={(v) => onChange({ ...form, homeTeamId: v as number })}
                        placeholder={t('common.select')}
                    />
                </div>
                <div>
                    <label className="label">{t('admin.matches.awayTeam')}</label>
                    <SearchableSelect
                        options={teamOptions}
                        value={form.awayTeamId || ''}
                        onChange={(v) => onChange({ ...form, awayTeamId: v as number })}
                        placeholder={t('common.select')}
                    />
                </div>
            </div>
            <div>
                <label className="label">{t('admin.matches.matchDate')}</label>
                <input
                    type="datetime-local"
                    value={form.matchDate ? form.matchDate.slice(0, 16) : ''}
                    onChange={(e) =>
                        onChange({
                            ...form,
                            matchDate: e.target.value ? e.target.value + ':00' : null,
                        })
                    }
                    className="bg-border border border-border rounded px-3 py-2 text-sm text-white w-full"
                />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="label">{t('admin.matches.homeScore')}</label>
                    <input
                        type="number"
                        min={0}
                        value={form.homeScore}
                        onChange={(e) => onChange({ ...form, homeScore: Number(e.target.value) })}
                        className="bg-border border border-border rounded px-3 py-2 text-sm text-white w-full"
                    />
                </div>
                <div>
                    <label className="label">{t('admin.matches.awayScore')}</label>
                    <input
                        type="number"
                        min={0}
                        value={form.awayScore}
                        onChange={(e) => onChange({ ...form, awayScore: Number(e.target.value) })}
                        className="bg-border border border-border rounded px-3 py-2 text-sm text-white w-full"
                    />
                </div>
            </div>
            <div>
                <label className="label">{t('admin.matches.completion')}</label>
                <select
                    value={form.completionType}
                    onChange={(e) =>
                        onChange({
                            ...form,
                            completionType: Number(e.target.value) as CompletionType,
                        })
                    }
                    className="bg-border border border-border rounded px-3 py-2 text-sm text-white w-full"
                >
                    <option value={CompletionType.None}>{t('match.notPlayed')}</option>
                    <option value={CompletionType.RegularTime}>
                        {t('admin.matches.regularTime')}
                    </option>
                    <option value={CompletionType.Overtime}>{t('admin.matches.overtime')}</option>
                    <option value={CompletionType.Shootout}>{t('admin.matches.shootout')}</option>
                </select>
            </div>
            <div className="flex gap-3 pt-2">
                <button
                    type="submit"
                    disabled={!form.homeTeamId || !form.awayTeamId}
                    className="bg-primary hover:bg-primary-hover px-4 py-2 rounded text-sm disabled:opacity-50"
                >
                    {t('common.save')}
                </button>
                <button
                    type="button"
                    onClick={onCancel}
                    className="bg-border hover:bg-border/80 px-4 py-2 rounded text-sm"
                >
                    {t('common.cancel')}
                </button>
            </div>
        </form>
    )
}
