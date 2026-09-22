// Keep in sync with backend/src/NHLStats.Domain/PlayerPositions.cs (CanonicalOrder).
export const POSITIONS = ['C', 'LW', 'RW', 'D', 'G'] as const
export type PositionCode = (typeof POSITIONS)[number]

function isPositionCode(value: string): value is PositionCode {
    return (POSITIONS as readonly string[]).includes(value)
}

export function parsePositions(value: string | null | undefined): PositionCode[] {
    if (!value) return []
    const selected = new Set(
        value
            .split(',')
            .map((v) => v.trim().toUpperCase())
            .filter(isPositionCode),
    )
    return POSITIONS.filter((p) => selected.has(p))
}

export function formatPositions(codes: PositionCode[]): string | null {
    const selected = new Set(codes)
    const ordered = POSITIONS.filter((p) => selected.has(p))
    return ordered.length === 0 ? null : ordered.join(', ')
}
