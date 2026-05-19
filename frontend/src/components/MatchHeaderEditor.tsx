import { useEffect, useRef, useState } from 'react'
import { CalendarBlankIcon } from '@phosphor-icons/react'
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

function completionTypeLabel(ct: CompletionType, t: (key: string) => string): string {
    switch (ct) {
        case CompletionType.None: return t('match.notPlayed')
        case CompletionType.RegularTime: return t('match.reg')
        case CompletionType.Overtime: return t('match.ot')
        case CompletionType.Shootout: return t('match.so')
        case CompletionType.InProgress: return t('match.inProgress')
        default: return t('match.notPlayed')
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
    const skipNextSave = useRef(false)

    useEffect(() => {
        skipNextSave.current = true
        setHomeScore(match.homeScore)
        setAwayScore(match.awayScore)
    }, [match.homeScore, match.awayScore])

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
            skipNextSave.current = false
            return
        }
        if (skipNextSave.current) {
            skipNextSave.current = false
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

    const scoreInputClass =
        'w-16 bg-transparent text-center text-4xl font-bold focus:outline-none ' +
        'hover:bg-surface/50 focus:bg-surface rounded-lg p-1 transition-colors ' +
        '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'

    return (
        <div className="card p-6 md:p-8 mb-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                {/* Home team */}
                <div className="flex-1 flex justify-end">
                    <h1 className="text-xl md:text-2xl font-semibold text-right">{match.homeTeamName}</h1>
                </div>

                {/* Central score / controls */}
                <div className="flex flex-col items-center flex-shrink-0 min-w-[200px] gap-3">
                    <span className="text-xs text-text-muted font-medium uppercase tracking-wider">
                        {t('match.matchNumber', { number: match.matchNumber })}
                    </span>

                    {isAuth ? (
                        <>
                            <div className="flex items-center gap-4">
                                <input
                                    type="number"
                                    aria-label={t('match.homeScore')}
                                    min={0}
                                    value={homeScore}
                                    onChange={(e) => setHomeScore(Number(e.target.value))}
                                    className={scoreInputClass}
                                />
                                <span className="text-3xl text-text-muted font-light select-none">—</span>
                                <input
                                    type="number"
                                    aria-label={t('match.awayScore')}
                                    min={0}
                                    value={awayScore}
                                    onChange={(e) => setAwayScore(Number(e.target.value))}
                                    className={scoreInputClass}
                                />
                            </div>

                            <div className="flex flex-col sm:flex-row items-center gap-2">
                                <select
                                    aria-label={t('match.completionType')}
                                    value={completionType}
                                    onChange={(e) => handleCompletionTypeChange(Number(e.target.value) as CompletionType)}
                                    className="input !py-1 !px-2 !w-auto text-xs font-semibold uppercase bg-border border-transparent"
                                >
                                    <option value={CompletionType.None}>{t('match.notPlayed')}</option>
                                    <option value={CompletionType.RegularTime}>{t('match.reg')}</option>
                                    <option value={CompletionType.Overtime}>{t('match.ot')}</option>
                                    <option value={CompletionType.Shootout}>{t('match.so')}</option>
                                    <option value={CompletionType.InProgress}>{t('match.inProgress')}</option>
                                </select>

                                <div className="relative flex items-center">
                                    <CalendarBlankIcon
                                        size={16}
                                        className="absolute left-3 text-text-muted pointer-events-none"
                                    />
                                    <input
                                        type="date"
                                        aria-label={t('match.matchDate')}
                                        value={matchDate}
                                        onChange={(e) => setMatchDate(e.target.value)}
                                        className="input !py-1 !pl-9 !pr-3 text-xs !w-auto"
                                    />
                                </div>
                            </div>

                            {saving && (
                                <span className="text-xs text-text-muted animate-pulse">
                                    {t('common.saving')}
                                </span>
                            )}
                        </>
                    ) : (
                        <>
                            <p className="text-4xl font-mono font-bold">
                                {match.homeScore} — {match.awayScore}
                            </p>
                            <div className="flex items-center gap-2">
                                <span className="text-xs px-2 py-0.5 rounded font-semibold uppercase bg-border text-text-muted">
                                    {completionTypeLabel(normalizeCompletionType(match.completionType), t)}
                                </span>
                                {match.matchDate && (
                                    <span className="text-xs text-text-muted">
                                        {new Date(match.matchDate).toLocaleDateString()}
                                    </span>
                                )}
                            </div>
                        </>
                    )}
                </div>

                {/* Away team */}
                <div className="flex-1 flex justify-start">
                    <h1 className="text-xl md:text-2xl font-semibold">{match.awayTeamName}</h1>
                </div>
            </div>
        </div>
    )
}
