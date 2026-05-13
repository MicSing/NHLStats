import { useEffect, useRef, useState } from 'react'
import type { Match, UpdateMatchDto } from '../types/match'
import { CompletionType } from '../types/match'
import apiClient from '../services/apiClient'
import { useTranslation } from 'react-i18next'

function isFinishedType(t: CompletionType): boolean {
    return t === CompletionType.RegularTime || t === CompletionType.Overtime || t === CompletionType.Shootout
}

interface Props {
    seasonId: string
    match: Match
    isAuth: boolean
    onSaved: (updated: Match) => void
    onMatchFinished?: (homeScore: number, awayScore: number) => void
}

function CompletionBadge({ type }: { type: CompletionType }) {
    const map: Record<CompletionType, { label: string; className: string }> = {
        [CompletionType.None]: { label: 'N/A', className: 'bg-border text-text-muted' },
        [CompletionType.RegularTime]: { label: 'REG', className: 'bg-success/20 text-success' },
        [CompletionType.Overtime]: { label: 'OT', className: 'bg-warning/20 text-warning' },
        [CompletionType.Shootout]: { label: 'SO', className: 'bg-secondary/20 text-secondary' },
        [CompletionType.InProgress]: { label: 'LIVE', className: 'bg-danger/20 text-danger animate-pulse' },
    }
    const { label, className } = map[type] ?? map[CompletionType.None]
    return (
        <span className={`text-xs px-2 py-0.5 rounded font-medium ${className}`}>{label}</span>
    )
}

function normalizeCompletionType(value: CompletionType | string | null | undefined): CompletionType {
    if (value === null || value === undefined) return CompletionType.None
    if (typeof value === 'number') {
        return Object.values(CompletionType).includes(value) ? value : CompletionType.None
    }

    switch (value.toLowerCase()) {
        case 'reg':
        case 'regular':
        case 'regulartime':
            return CompletionType.RegularTime
        case 'ot':
        case 'overtime':
            return CompletionType.Overtime
        case 'so':
        case 'shootout':
            return CompletionType.Shootout
        case 'none':
            return CompletionType.None
        case 'inprogress':
        case 'live':
            return CompletionType.InProgress
        default:
            return CompletionType.None
    }
}

export default function MatchHeaderEditor({ seasonId, match, isAuth, onSaved, onMatchFinished }: Props) {
    const { t } = useTranslation()
    const [homeScore, setHomeScore] = useState(match.homeScore)
    const [awayScore, setAwayScore] = useState(match.awayScore)
    const [completionType, setCompletionType] = useState<CompletionType>(
        normalizeCompletionType(match.completionType),
    )
    const [matchDate, setMatchDate] = useState<string>(
        match.matchDate ? match.matchDate.split('T')[0] : '',
    )
    const [saving, setSaving] = useState(false)
    const lastSavedCompletionTypeRef = useRef(normalizeCompletionType(match.completionType))
    const isFirstRender = useRef(true)

    const handleSave = async (scores: { home: number; away: number }, ct: CompletionType, date: string) => {
        setSaving(true)
        try {
            const normalizedMatchDate = ct === CompletionType.None ? null : date || null
            const dto: UpdateMatchDto = {
                homeTeamId: match.homeTeamId,
                awayTeamId: match.awayTeamId,
                homeScore: scores.home,
                awayScore: scores.away,
                completionType: ct,
                matchDate: normalizedMatchDate,
            }
            const updated = await apiClient.put<Match>(
                `/api/seasons/${seasonId}/matches/${match.id}`,
                dto,
            )
            const wasFinished = isFinishedType(lastSavedCompletionTypeRef.current)
            const nowFinished = isFinishedType(ct)
            lastSavedCompletionTypeRef.current = ct
            onSaved(updated)
            if (!wasFinished && nowFinished) {
                onMatchFinished?.(scores.home, scores.away)
            }
        } finally {
            setSaving(false)
        }
    }

    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false
            return
        }
        if (!isAuth) return
        const timer = setTimeout(() => {
            void handleSave({ home: homeScore, away: awayScore }, completionType, matchDate)
        }, 600)
        return () => clearTimeout(timer)
    }, [homeScore, awayScore, completionType, matchDate]) // eslint-disable-line react-hooks/exhaustive-deps

    const handleCompletionTypeChange = (newType: CompletionType) => {
        setCompletionType(newType)
        if (newType === CompletionType.InProgress) {
            setMatchDate(new Date().toISOString().split('T')[0])
        }
    }

    return (
        <div className="card p-6 mb-6">
            <div className="flex items-center justify-between">
                <div className="text-center flex-1">
                    <p className="text-xl font-bold">{match.homeTeamName}</p>
                </div>
                <div className="text-center px-6">
                    <p className="text-xs text-text-muted mb-1">{t('match.matchNumber', { number: match.matchNumber })}</p>
                    {isAuth ? (
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 justify-center">
                                <input
                                    type="number"
                                    aria-label="home score"
                                    min={0}
                                    value={homeScore}
                                    onChange={(e) => setHomeScore(Number(e.target.value))}
                                    className="input w-16 text-center text-2xl font-mono font-bold py-1"
                                />
                                <span className="text-2xl font-mono text-text-muted">–</span>
                                <input
                                    type="number"
                                    aria-label="away score"
                                    min={0}
                                    value={awayScore}
                                    onChange={(e) => setAwayScore(Number(e.target.value))}
                                    className="input w-16 text-center text-2xl font-mono font-bold py-1"
                                />
                            </div>
                            <div className="flex items-center gap-2 justify-center">
                                <select
                                    aria-label="completion type"
                                    value={completionType}
                                    onChange={(e) => handleCompletionTypeChange(Number(e.target.value) as CompletionType)}
                                    className="input text-sm py-1"
                                >
                                    <option value={CompletionType.None}>{t('match.notPlayed')}</option>
                                    <option value={CompletionType.RegularTime}>{t('match.reg')}</option>
                                    <option value={CompletionType.Overtime}>{t('match.ot')}</option>
                                    <option value={CompletionType.Shootout}>{t('match.so')}</option>
                                    <option value={CompletionType.InProgress}>{t('match.inProgress')}</option>
                                </select>
                                <input
                                    type="date"
                                    aria-label="match date"
                                    value={matchDate}
                                    onChange={(e) => setMatchDate(e.target.value)}
                                    className="input text-sm py-1"
                                />
                            </div>
                            {saving && (
                                <span className="text-xs text-text-muted animate-pulse">
                                    {t('common.saving')}
                                </span>
                            )}
                        </div>
                    ) : (
                        <>
                            <p className="text-4xl font-mono font-bold">
                                {match.homeScore} – {match.awayScore}
                            </p>
                            <p className="text-sm text-text-muted mt-1">
                                {match.matchDate
                                    ? new Date(match.matchDate).toLocaleDateString()
                                    : t('match.notPlayedYet')}
                            </p>
                            <div className="mt-2">
                                <CompletionBadge type={normalizeCompletionType(match.completionType)} />
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
