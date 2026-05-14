import type { UserMatchPoint, UserMatchGoal, UserMatchPenalty } from '../../types/userMatch'

export function PointsTooltip({ points }: { points: UserMatchPoint[] }) {
    if (points.length === 0) return null
    return (
        <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            <div className="bg-surface border border-border rounded shadow-card px-3 py-2 text-xs max-w-[200px] whitespace-normal">
                {points.map((p) => (
                    <div key={p.id} className="flex gap-2 justify-between">
                        <span>{p.pointReasonName}</span>
                        <span className="font-mono">×{p.count}</span>
                    </div>
                ))}
            </div>
        </div>
    )
}

export function GoalsTooltip({ goals }: { goals: UserMatchGoal[] }) {
    if (goals.length === 0) return null
    const aggregated = Array.from(
        goals.reduce((map, g) => {
            const key = g.rosterPlayerId
            const existing = map.get(key)
            if (existing) {
                existing.count += g.count
            } else {
                map.set(key, { name: `${g.playerFirstName ?? ''} ${g.playerSurname ?? ''}`.trim(), count: g.count })
            }
            return map
        }, new Map<number, { name: string; count: number }>()).values()
    )
    return (
        <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            <div className="bg-surface border border-border rounded shadow-card px-3 py-2 text-xs max-w-[200px] whitespace-normal">
                {aggregated.map((g) => (
                    <div key={g.name}>{g.name} ×{g.count}</div>
                ))}
            </div>
        </div>
    )
}

export function PenaltiesTooltip({ penalties }: { penalties: UserMatchPenalty[] }) {
    if (penalties.length === 0) return null
    const aggregated = Array.from(
        penalties.reduce((map, p) => {
            const key = p.rosterPlayerId
            const existing = map.get(key)
            if (existing) {
                existing.count += p.count
            } else {
                map.set(key, { name: `${p.playerFirstName ?? ''} ${p.playerSurname ?? ''}`.trim(), count: p.count })
            }
            return map
        }, new Map<number, { name: string; count: number }>()).values()
    )
    return (
        <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            <div className="bg-surface border border-border rounded shadow-card px-3 py-2 text-xs max-w-[200px] whitespace-normal">
                {aggregated.map((p) => (
                    <div key={p.name}>{p.name} ×{p.count}</div>
                ))}
            </div>
        </div>
    )
}
