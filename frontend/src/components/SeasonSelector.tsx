import type { Season } from '../types/season'

interface SeasonSelectorProps {
    seasons: Season[]
    selectedId: number | null
    onChange: (id: number | null) => void
}

export default function SeasonSelector({ seasons, selectedId, onChange }: SeasonSelectorProps) {
    return (
        <select
            aria-label="Select season"
            value={selectedId ?? ''}
            onChange={(e) => {
                const val = e.target.value
                onChange(val === '' ? null : Number(val))
            }}
            className="bg-surface text-text rounded-lg px-3 py-1.5 text-sm border border-border focus:outline-none focus:border-primary transition-colors"
        >
            <option value="">All seasons</option>
            {seasons.map((s) => (
                <option key={s.id} value={s.id}>
                    {s.name}
                </option>
            ))}
        </select>
    )
}
