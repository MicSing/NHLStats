import { RING_COLORS, useColorName } from './ringColors'

export function Swatch({ color }: { color: string | null | undefined }) {
    const css = color ? (RING_COLORS[color] ?? color) : 'transparent'
    return <span className="inline-block w-4 h-4 rounded-full border-2 border-border shrink-0" style={{ borderColor: css }} aria-hidden />
}

interface Props {
    /** The colour set at this level, or null when it is inherited. */
    value: string | null
    /** What null means here, e.g. "by position: yellow". */
    inheritLabel: string
    /** The colour shown when inherited, for the swatch. */
    inherited?: string | null
    onChange: (color: string | null) => void
    ariaLabel: string
}

/** Pick a ring colour, or inherit it from the level above (position → season → match). */
export default function ColorSelect({ value, inheritLabel, inherited, onChange, ariaLabel }: Props) {
    const name = useColorName()
    return (
        <span className="flex items-center gap-2">
            <Swatch color={value ?? inherited} />
            <select
                aria-label={ariaLabel}
                value={value ?? ''}
                onChange={(e) => onChange(e.target.value || null)}
                className="bg-border border border-border rounded px-2 py-1 text-sm"
            >
                <option value="">{inheritLabel}</option>
                {Object.keys(RING_COLORS).map((c) => <option key={c} value={c}>{name(c)}</option>)}
                {value && !(value in RING_COLORS) && <option value={value}>{value}</option>}
            </select>
        </span>
    )
}
