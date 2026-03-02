import { useState } from 'react'
import type { Match, UpdateMatchDto } from '../types/match'
import { CompletionType } from '../types/match'
import apiClient from '../services/apiClient'

interface Props {
    seasonId: string
    match: Match
    isAuth: boolean
    onSaved: (updated: Match) => void
}

function CompletionBadge({ type }: { type: CompletionType }) {
    const map: Record<CompletionType, { label: string; className: string }> = {
        [CompletionType.None]: { label: 'Not Played', className: 'bg-gray-600 text-gray-300' },
        [CompletionType.RegularTime]: { label: 'REG', className: 'bg-green-800 text-green-300' },
        [CompletionType.Overtime]: { label: 'OT', className: 'bg-yellow-800 text-yellow-300' },
        [CompletionType.Shootout]: { label: 'SO', className: 'bg-orange-800 text-orange-300' },
    }
    const { label, className } = map[type] ?? map[CompletionType.None]
    return (
        <span className={`text-xs px-2 py-0.5 rounded font-medium ${className}`}>{label}</span>
    )
}

export default function MatchHeaderEditor({ seasonId, match, isAuth, onSaved }: Props) {
    const [homeScore, setHomeScore] = useState(match.homeScore)
    const [awayScore, setAwayScore] = useState(match.awayScore)
    const [completionType, setCompletionType] = useState<CompletionType>(match.completionType)
    const [matchDate, setMatchDate] = useState<string>(
        match.matchDate ? match.matchDate.split('T')[0] : '',
    )
    const [saving, setSaving] = useState(false)

    const handleSave = async () => {
        setSaving(true)
        try {
            const dto: UpdateMatchDto = {
                homeTeamId: match.homeTeamId,
                awayTeamId: match.awayTeamId,
                homeScore,
                awayScore,
                completionType,
                matchDate: matchDate || null,
            }
            const updated = await apiClient.put<Match>(
                `/api/seasons/${seasonId}/matches/${match.id}`,
                dto,
            )
            onSaved(updated)
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="bg-gray-800 rounded-xl p-6 mb-6">
            <div className="flex items-center justify-between">
                <div className="text-center flex-1">
                    <p className="text-xl font-bold">{match.homeTeamName}</p>
                </div>
                <div className="text-center px-6">
                    <p className="text-xs text-gray-400 mb-1">Match #{match.matchNumber}</p>
                    {isAuth ? (
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 justify-center">
                                <input
                                    type="number"
                                    aria-label="home score"
                                    min={0}
                                    value={homeScore}
                                    onChange={(e) => setHomeScore(Number(e.target.value))}
                                    className="bg-gray-700 rounded px-2 py-1 text-center text-2xl font-mono font-bold w-16"
                                />
                                <span className="text-2xl font-mono text-gray-400">–</span>
                                <input
                                    type="number"
                                    aria-label="away score"
                                    min={0}
                                    value={awayScore}
                                    onChange={(e) => setAwayScore(Number(e.target.value))}
                                    className="bg-gray-700 rounded px-2 py-1 text-center text-2xl font-mono font-bold w-16"
                                />
                            </div>
                            <div className="flex items-center gap-2 justify-center">
                                <select
                                    aria-label="completion type"
                                    value={completionType}
                                    onChange={(e) => setCompletionType(Number(e.target.value) as CompletionType)}
                                    className="bg-gray-700 rounded px-2 py-1 text-sm"
                                >
                                    <option value={CompletionType.None}>Not Played</option>
                                    <option value={CompletionType.RegularTime}>REG</option>
                                    <option value={CompletionType.Overtime}>OT</option>
                                    <option value={CompletionType.Shootout}>SO</option>
                                </select>
                                <input
                                    type="date"
                                    aria-label="match date"
                                    value={matchDate}
                                    onChange={(e) => setMatchDate(e.target.value)}
                                    className="bg-gray-700 rounded px-2 py-1 text-sm"
                                />
                            </div>
                            <button
                                onClick={() => void handleSave()}
                                disabled={saving}
                                className="bg-cyan-700 hover:bg-cyan-600 disabled:opacity-50 px-4 py-1 rounded text-sm"
                            >
                                {saving ? 'Saving…' : 'Save'}
                            </button>
                        </div>
                    ) : (
                        <>
                            <p className="text-4xl font-mono font-bold">
                                {match.homeScore} – {match.awayScore}
                            </p>
                            <p className="text-sm text-gray-400 mt-1">
                                {match.matchDate
                                    ? new Date(match.matchDate).toLocaleDateString()
                                    : 'Not played yet'}
                            </p>
                            <div className="mt-2">
                                <CompletionBadge type={match.completionType} />
                            </div>
                        </>
                    )}
                </div>
                <div className="text-center flex-1">
                    <p className="text-xl font-bold">{match.awayTeamName}</p>
                </div>
            </div>
        </div>
    )
}
