import { useEffect, useState } from 'react'
import type { PointReason } from '../types/pointReason'
import type { MoneyConfig } from '../types/moneyConfig'
import apiClient from '../services/apiClient'

// Descriptions for when the event counts against you (negative point)
const NEGATIVE_DESCRIPTIONS: Record<string, string> = {
    'penalty': "Your roster player took a penalty and the opposing team scored a goal during the ensuing powerplay.",
    'secondary penalty': "Your roster player was the second player sent to the penalty box, creating a 5-on-3 powerplay for the opponent, and they scored during that advantage.",
    'not scoring a goal': "Your roster player's team failed to score a single goal in the entire match.",
    'scoring 10 goals': "The opposing team scored 10 or more goals against your roster player's team in a single match.",
    'last minute action': "Your roster player caused a penalty in the final minute of a period while the score was tied or the opponent was within one goal of equalising — handing the opponent a dangerous last-minute powerplay.",
    'own goal': "Your roster player accidentally scored into their own net.",
    'error in defense': "Your roster player made a defensive mistake that directly led to a goal. The error must be confirmed by the agreement of all other players, and it must be clear the player could have made a different decision.",
    'prediction': "Description coming soon.",
}

// Descriptions for when the same event benefits you (positive point)
const POSITIVE_DESCRIPTIONS: Record<string, string> = {
    'penalty': "Your roster player's team scored a goal on the powerplay while the opposing team was short-handed due to a penalty.",
    'secondary penalty': "Your roster player's team scored a goal during a 5-on-3 powerplay, when the opponent had two players simultaneously in the penalty box.",
    'not scoring a goal': "Your roster player's team kept a clean sheet — the opposing team failed to score a single goal in the entire match.",
    'scoring 10 goals': "Your roster player's team scored 10 or more goals in a single match.",
    'last minute action': "The opposing team had a powerplay in the final minute with the score tied or within reach, but your roster player's team held on and prevented them from scoring.",
    'own goal': "The opposing team scored an own goal, directly benefiting your roster player's team.",
    'error in defense': "The opposing team's player made a defensive mistake that directly led to a goal for your roster player's team. The error must be confirmed by the agreement of all other players.",
    'prediction': "Description coming soon.",
}

function getNegativeDescription(name: string): string {
    return NEGATIVE_DESCRIPTIONS[name.toLowerCase()] ?? ''
}

function getPositiveDescription(name: string): string {
    return POSITIVE_DESCRIPTIONS[name.toLowerCase()] ?? ''
}

export default function RulesPage() {
    const [reasons, setReasons] = useState<PointReason[]>([])
    const [moneyConfig, setMoneyConfig] = useState<MoneyConfig | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        Promise.all([
            apiClient.get<PointReason[]>('/api/pointreasons'),
            apiClient.get<MoneyConfig>('/api/moneyconfig/current'),
        ])
            .then(([r, m]) => {
                setReasons(r)
                setMoneyConfig(m)
            })
            .catch(() => setError('Failed to load rules'))
            .finally(() => setLoading(false))
    }, [])

    if (loading) return <p className="p-6 text-text-muted">Loading…</p>
    if (error) return <p className="p-6 text-warning" role="alert">{error}</p>

    // Active reasons only, deduplicated by name (keep one entry per name)
    const activeReasons = reasons.filter((r) => r.isActive)
    const negativeReasons = activeReasons.filter((r) => !r.isPositive)
    const positiveReasons = activeReasons.filter((r) => r.isPositive)

    // Unique names across all active reasons (preserving negative order first)
    const seenNames = new Set<string>()
    const uniqueReasons: PointReason[] = []
    for (const r of [...negativeReasons, ...positiveReasons]) {
        const key = r.name.toLowerCase()
        if (!seenNames.has(key)) {
            seenNames.add(key)
            uniqueReasons.push(r)
        }
    }

    return (
        <div className="p-6 max-w-3xl mx-auto space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-primary mb-2">📋 Rules</h1>
                <p className="text-text-muted text-sm leading-relaxed">
                    How positive/negative points are earned during the season. Every match event can award
                    points from your score. Points are then converted to money at the current
                    rate.
                </p>
            </div>

            {/* Point value card */}
            {moneyConfig && (
                <div className="bg-surface rounded-xl border border-border p-5">
                    <h2 className="text-lg font-semibold text-text mb-4">💶 Current Point Values</h2>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-bg rounded-lg p-4 text-center">
                            <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Negative Point</p>
                            <p className="text-2xl font-bold text-warning">
                                −{moneyConfig.negativePointValue.toFixed(2)} €
                            </p>
                            <p className="text-xs text-text-muted mt-1">you pay per negative point</p>
                        </div>
                        <div className="bg-bg rounded-lg p-4 text-center">
                            <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Positive Point</p>
                            <p className="text-2xl font-bold text-primary">
                                +{moneyConfig.positivePointValue.toFixed(2)} €
                            </p>
                            <p className="text-xs text-text-muted mt-1">you earn per positive point</p>
                        </div>
                    </div>
                </div>
            )}

            {/* How it works */}
            <div className="bg-surface rounded-xl border border-border p-5">
                <h2 className="text-lg font-semibold text-text mb-3">⚙️ How It Works</h2>
                <ul className="space-y-2 text-sm text-text-muted list-disc list-inside leading-relaxed">
                    <li>Each player is assigned a role (forwards, defensemen) and is responsible for all NHL players belonging to that role on their team's roster.</li>
                    <li>
                        When a point reason occurs during a match, the player whose roster player
                        triggered it receives a <span className="text-warning font-medium">negative point</span>{' '}
                        or a <span className="text-primary font-medium">positive point</span> depending on
                        the event type.
                    </li>
                </ul>
            </div>

            {/* Point reasons table */}
            <div className="bg-surface rounded-xl border border-border overflow-hidden">
                <div className="px-5 py-4 border-b border-border">
                    <h2 className="text-lg font-semibold text-text">🏒 Point Reasons</h2>
                    <p className="text-xs text-text-muted mt-0.5">All events that affect your point total.</p>
                </div>
                <div className="divide-y divide-border">
                    {uniqueReasons.map((reason) => {
                        const hasNegative = negativeReasons.some(
                            (r) => r.name.toLowerCase() === reason.name.toLowerCase(),
                        )
                        const hasPositive = positiveReasons.some(
                            (r) => r.name.toLowerCase() === reason.name.toLowerCase(),
                        )
                        return (
                            <div key={reason.id} className="px-5 py-4">
                                <p className="font-semibold text-text text-sm mb-2">{reason.name}</p>
                                <div className="space-y-2">
                                    {hasNegative && (
                                        <div className="flex items-start gap-2">
                                            <span className="shrink-0 inline-flex items-center rounded-full bg-warning/10 px-2.5 py-0.5 text-xs font-semibold text-warning mt-0.5">
                                                − Negative
                                            </span>
                                            <p className="text-xs text-text-muted leading-relaxed">
                                                {getNegativeDescription(reason.name)}
                                            </p>
                                        </div>
                                    )}
                                    {hasPositive && (
                                        <div className="flex items-start gap-2">
                                            <span className="shrink-0 inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary mt-0.5">
                                                + Positive
                                            </span>
                                            <p className="text-xs text-text-muted leading-relaxed">
                                                {getPositiveDescription(reason.name)}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
