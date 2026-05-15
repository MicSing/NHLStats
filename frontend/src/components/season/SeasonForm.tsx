import { useTranslation } from 'react-i18next'
import { LeagueType } from '../../types/team'
import type { LeagueTypeValue, Team } from '../../types/team'
import type { CreateSeasonDto } from '../../types/season'

export interface SeasonFormProps {
    form: CreateSeasonDto
    teams: Team[]
    onChange: (f: CreateSeasonDto) => void
    onSubmit: (e: React.FormEvent) => void
    onCancel?: () => void
    submitLabel?: string
    inlineMode?: boolean
}

export default function SeasonForm({
    form,
    teams,
    onChange,
    onSubmit,
    onCancel,
    submitLabel,
    inlineMode,
}: SeasonFormProps) {
    const { t } = useTranslation()
    const set = (patch: Partial<CreateSeasonDto>) => onChange({ ...form, ...patch })

    return (
        <form onSubmit={onSubmit}>
            <div className={inlineMode ? 'grid grid-cols-2 gap-x-4' : ''}>
                <div>
                    <label htmlFor="season-name" className="label">
                        {t('common.name')}
                    </label>
                    <input
                        id="season-name"
                        className="w-full bg-border border border-border rounded px-3 py-2 mb-3 text-white"
                        value={form.name}
                        onChange={(e) => set({ name: e.target.value })}
                        required
                    />
                </div>

                <div>
                    <label htmlFor="season-started-on" className="label">
                        {t('admin.seasons.startedOn')}
                    </label>
                    <input
                        id="season-started-on"
                        type="date"
                        className="w-full bg-border border border-border rounded px-3 py-2 mb-3 text-white [&::-webkit-calendar-picker-indicator]:invert-[0.5]"
                        value={form.startedOn}
                        onChange={(e) => set({ startedOn: e.target.value })}
                        required
                    />
                </div>

                <div>
                    <label htmlFor="season-status" className="label">
                        {t('common.status')}
                    </label>
                    <input
                        id="season-status"
                        className="w-full bg-border border border-border rounded px-3 py-2 mb-3 text-white"
                        value={form.status ?? ''}
                        onChange={(e) => set({ status: e.target.value || null })}
                        placeholder="e.g. Active, Completed"
                    />
                </div>

                <div>
                    <label htmlFor="season-league" className="label">
                        {t('admin.seasons.leagueType')}
                    </label>
                    <select
                        id="season-league"
                        className="w-full bg-border border border-border rounded px-3 py-2 mb-3 text-white"
                        value={form.leagueType}
                        onChange={(e) => set({ leagueType: e.target.value as LeagueTypeValue })}
                    >
                        <option value={LeagueType.NHL}>{t('admin.seasons.leagueTypeNHL')}</option>
                        <option value={LeagueType.IIHF}>{t('admin.seasons.leagueTypeIIHF')}</option>
                        <option value={LeagueType.Olympic}>{t('admin.seasons.leagueTypeOlympic')}</option>
                    </select>
                </div>

                <div className={inlineMode ? 'col-span-2' : ''}>
                    <label htmlFor="season-team" className="label">
                        {t('admin.seasons.hostedBy')}
                    </label>
                    <select
                        id="season-team"
                        className="w-full bg-border border border-border rounded px-3 py-2 mb-4 text-white"
                        value={form.hostedTeamId ?? ''}
                        onChange={(e) =>
                            set({ hostedTeamId: e.target.value ? Number(e.target.value) : null })
                        }
                    >
                        <option value="">{t('common.none')}</option>
                        {teams.map((tm) => (
                            <option key={tm.id} value={tm.id}>
                                {tm.name}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <div className={`flex gap-2 ${inlineMode ? '' : 'justify-end'}`}>
                {!inlineMode && onCancel && (
                    <button type="button" onClick={onCancel} className="btn-ghost text-sm">
                        {t('common.cancel')}
                    </button>
                )}
                <button
                    type="submit"
                    className={`px-4 py-2 text-sm bg-primary hover:bg-primary-hover rounded${inlineMode ? ' w-full' : ''}`}
                >
                    {submitLabel ?? t('common.save')}
                </button>
            </div>
        </form>
    )
}
