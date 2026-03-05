import { useTranslation } from 'react-i18next'
import type { Season } from '../types/season'

interface SeasonSelectorProps {
    seasons: Season[]
    selectedId: number | null
    onChange: (id: number | null) => void
}

export default function SeasonSelector({ seasons, selectedId, onChange }: SeasonSelectorProps) {
    const { t } = useTranslation()

    return (
        <select
            aria-label={t('seasonSelector.selectSeason')}
            value={selectedId ?? ''}
            onChange={(e) => {
                const val = e.target.value
                onChange(val === '' ? null : Number(val))
            }}
            className="bg-surface text-text rounded-lg px-3 py-1.5 text-sm border border-border focus:outline-none focus:border-primary transition-colors"
        >
            <option value="">{t('seasonSelector.allSeasons')}</option>
            {seasons.map((s) => (
                <option key={s.id} value={s.id}>
                    {s.name}
                </option>
            ))}
        </select>
    )
}
