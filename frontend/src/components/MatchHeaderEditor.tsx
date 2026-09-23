import { useEffect, useRef, useState } from 'react'
import {
    CalendarBlankIcon,
    PlayIcon,
    CaretRightIcon,
    CheckCircleIcon,
    ArrowCounterClockwiseIcon,
} from '@phosphor-icons/react'
import type { Match, UpdateMatchDto } from '../types/match'
import { CompletionType } from '../types/match'
import apiClient from '../services/apiClient'
import { useTranslation } from 'react-i18next'

function isFinishedType(t: CompletionType | string): boolean {
    if (typeof t === 'string') {
        const s = t.toLowerCase()
        return s === 'regulartime' || s === 'reg' || s === 'overtime' || s === 'ot' || s === 'shootout' || s === 'so'
    }
    return t === CompletionType.RegularTime || t === CompletionType.Overtime || t === CompletionType.Shootout
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

function completionTypeLabel(ct: CompletionType | string, t: (key: string) => string): string {
    const norm = normalizeCompletionType(ct)
    switch (norm) {
        case CompletionType.None: return t('match.notPlayed')
        case CompletionType.RegularTime: return t('match.reg')
        case CompletionType.Overtime: return t('match.ot')
        case CompletionType.Shootout: return t('match.so')
        case CompletionType.InProgress: return t('match.inProgress')
        default: return t('match.notPlayed')
    }
}

interface Props {
    seasonId: string
    match: Match
    isAuth: boolean
    currentPeriod: string // 'None' | 'P1' | 'P2' | 'P3' | 'OT' | 'SO' | 'Finished'
    onSaved: (updated: Match) => void
    onTransitionPeriod: (periodSubtype: string) => Promise<void>
    onEndMatch: (endSubtype: 'REG' | 'OT') => Promise<void>
    onEndShootout: () => Promise<void>
    onReopenMatch?: () => Promise<void>
}

export default function MatchHeaderEditor({
    seasonId,
    match,
    isAuth,
    currentPeriod,
    onSaved,
    onTransitionPeriod,
    onEndMatch,
    onEndShootout,
    onReopenMatch,
}: Props) {
    const { t } = useTranslation()
    const [matchDate, setMatchDate] = useState<string>(
        match.matchDate ? match.matchDate.split('T')[0] : '',
    )
    const [busy, setBusy] = useState(false)
    const [saved, setSaved] = useState(false)
    const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
        setMatchDate(match.matchDate ? match.matchDate.split('T')[0] : '')
    }, [match.matchDate])

    useEffect(() => () => {
        if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
    }, [])

    const handleDateChange = async (newDate: string) => {
        setMatchDate(newDate)
        if (!isAuth) return
        setBusy(true)
        try {
            const dto: UpdateMatchDto = {
                homeTeamId: match.homeTeamId,
                awayTeamId: match.awayTeamId,
                homeScore: match.homeScore,
                awayScore: match.awayScore,
                completionType: match.completionType,
                matchDate: newDate ? newDate : null,
                phase: match.phase,
                playoffRound: match.playoffRound,
            }
            const updated = await apiClient.put<Match>(
                `/api/seasons/${seasonId}/matches/${match.id}`,
                dto,
            )
            onSaved(updated)
            if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
            setSaved(true)
            savedTimerRef.current = setTimeout(() => setSaved(false), 2000)
        } finally {
            setBusy(false)
        }
    }

    const handleTransition = async (targetPeriod: string) => {
        if (busy) return
        setBusy(true)
        try {
            await onTransitionPeriod(targetPeriod)
        } finally {
            setBusy(false)
        }
    }

    const handleEnd = async (subtype: 'REG' | 'OT') => {
        if (busy) return
        setBusy(true)
        try {
            await onEndMatch(subtype)
        } finally {
            setBusy(false)
        }
    }

    const handleEndShootoutClick = async () => {
        if (busy) return
        setBusy(true)
        try {
            await onEndShootout()
        } finally {
            setBusy(false)
        }
    }

    const handleReopen = async () => {
        if (busy || !onReopenMatch) return
        setBusy(true)
        try {
            await onReopenMatch()
        } finally {
            setBusy(false)
        }
    }

    const normCt = normalizeCompletionType(match.completionType)
    const isFinished = isFinishedType(normCt)

    const periodDisplayLabel = () => {
        switch (currentPeriod) {
            case 'P1': return t('match.period1Title')
            case 'P2': return t('match.period2Title')
            case 'P3': return t('match.period3Title')
            case 'OT': return t('match.overtimeTitle')
            case 'SO': return t('match.shootoutTitle')
            default: return t('match.inProgress')
        }
    }

    return (
        <div className="card p-4 sm:p-6 md:p-8 mb-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 md:gap-6">
                {/* Home team */}
                <div className="w-full md:flex-1 flex justify-center md:justify-end text-center md:text-right">
                    <h1 className="text-lg sm:text-xl md:text-2xl font-bold">{match.homeTeamName}</h1>
                </div>

                {/* Central score / controls */}
                <div className="flex flex-col items-center flex-shrink-0 min-w-[220px] gap-2.5 sm:gap-3 w-full sm:w-auto">
                    <span className="text-[10px] sm:text-xs text-text-muted font-bold uppercase tracking-wider bg-bg px-2.5 py-0.5 rounded border border-border">
                        {t('match.matchNumber', { number: match.matchNumber })}
                    </span>

                    {/* Score display (read-only, strictly driven by events) */}
                    <div className="flex items-center gap-3 sm:gap-4 my-0.5">
                        <span className="w-12 sm:w-16 text-center text-3xl sm:text-4xl md:text-5xl font-mono font-bold tabular-nums">
                            {match.homeScore}
                        </span>
                        <span className="text-2xl sm:text-3xl text-text-muted font-light select-none">—</span>
                        <span className="w-12 sm:w-16 text-center text-3xl sm:text-4xl md:text-5xl font-mono font-bold tabular-nums">
                            {match.awayScore}
                        </span>
                    </div>

                    {isAuth ? (
                        <>
                            {/* Workflow action buttons */}
                            <div className="flex flex-wrap items-center justify-center gap-2">
                                {isFinished ? (
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs px-2.5 py-1 rounded font-semibold uppercase bg-emerald-950/60 border border-emerald-800/60 text-emerald-400">
                                            {completionTypeLabel(normCt, t)} · {t('match.finished')}
                                        </span>
                                        {onReopenMatch && (
                                            <button
                                                type="button"
                                                onClick={() => void handleReopen()}
                                                disabled={busy}
                                                className="flex items-center gap-1 text-xs text-text-muted hover:text-text underline transition-colors disabled:opacity-50"
                                            >
                                                <ArrowCounterClockwiseIcon size={12} />
                                                <span>{t('match.reopenMatch')}</span>
                                            </button>
                                        )}
                                    </div>
                                ) : normCt === CompletionType.None ? (
                                    <button
                                        type="button"
                                        onClick={() => void handleTransition('P1')}
                                        disabled={busy}
                                        className="btn-primary text-xs sm:text-sm py-1.5 px-3.5 flex items-center gap-1.5 font-bold shadow-md shadow-primary/20 disabled:opacity-50"
                                    >
                                        <PlayIcon size={14} weight="fill" />
                                        <span>{t('match.startMatch')}</span>
                                    </button>
                                ) : (
                                    /* InProgress transitions */
                                    <div className="flex flex-wrap items-center justify-center gap-2">
                                        {(currentPeriod === 'None' || currentPeriod === 'P1') && (
                                            <button
                                                type="button"
                                                onClick={() => void handleTransition('P2')}
                                                disabled={busy}
                                                className="btn-primary text-xs sm:text-sm py-1.5 px-3 flex items-center gap-1.5 font-bold disabled:opacity-50"
                                            >
                                                <span>{t('match.period2')}</span>
                                                <CaretRightIcon size={14} weight="bold" />
                                            </button>
                                        )}

                                        {currentPeriod === 'P2' && (
                                            <button
                                                type="button"
                                                onClick={() => void handleTransition('P3')}
                                                disabled={busy}
                                                className="btn-primary text-xs sm:text-sm py-1.5 px-3 flex items-center gap-1.5 font-bold disabled:opacity-50"
                                            >
                                                <span>{t('match.period3')}</span>
                                                <CaretRightIcon size={14} weight="bold" />
                                            </button>
                                        )}

                                        {currentPeriod === 'P3' && (
                                            <>
                                                <button
                                                    type="button"
                                                    onClick={() => void handleEnd('REG')}
                                                    disabled={busy}
                                                    className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm py-1.5 px-3 rounded-lg flex items-center gap-1.5 font-bold shadow-md shadow-emerald-900/30 disabled:opacity-50 transition-colors"
                                                >
                                                    <CheckCircleIcon size={15} weight="bold" />
                                                    <span>{t('match.endMatchReg')}</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => void handleTransition('OT')}
                                                    disabled={busy}
                                                    className="border border-amber-500/70 text-amber-400 hover:bg-amber-500/10 text-xs sm:text-sm py-1.5 px-3 rounded-lg flex items-center gap-1.5 font-bold disabled:opacity-50 transition-colors"
                                                >
                                                    <span>{t('match.overtime')}</span>
                                                    <CaretRightIcon size={14} weight="bold" />
                                                </button>
                                            </>
                                        )}

                                        {currentPeriod === 'OT' && (
                                            <>
                                                <button
                                                    type="button"
                                                    onClick={() => void handleEnd('OT')}
                                                    disabled={busy}
                                                    className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm py-1.5 px-3 rounded-lg flex items-center gap-1.5 font-bold shadow-md shadow-emerald-900/30 disabled:opacity-50 transition-colors"
                                                >
                                                    <CheckCircleIcon size={15} weight="bold" />
                                                    <span>{t('match.endMatchOt')}</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => void handleTransition('SO')}
                                                    disabled={busy}
                                                    className="border border-purple-500/70 text-purple-400 hover:bg-purple-500/10 text-xs sm:text-sm py-1.5 px-3 rounded-lg flex items-center gap-1.5 font-bold disabled:opacity-50 transition-colors"
                                                >
                                                    <span>{t('match.shootout')}</span>
                                                    <CaretRightIcon size={14} weight="bold" />
                                                </button>
                                            </>
                                        )}

                                        {currentPeriod === 'SO' && (
                                            <button
                                                type="button"
                                                onClick={() => void handleEndShootoutClick()}
                                                disabled={busy}
                                                className="bg-purple-600 hover:bg-purple-500 text-white text-xs sm:text-sm py-1.5 px-3 rounded-lg flex items-center gap-1.5 font-bold shadow-md shadow-purple-900/30 disabled:opacity-50 transition-colors"
                                            >
                                                <CheckCircleIcon size={15} weight="bold" />
                                                <span>{t('match.endMatchSo')}</span>
                                            </button>
                                        )}
                                    </div>
                                )}

                                {/* Date picker */}
                                <div className="relative flex items-center">
                                    <CalendarBlankIcon
                                        size={16}
                                        className="absolute left-3 text-text-muted pointer-events-none"
                                    />
                                    <input
                                        type="date"
                                        aria-label={t('match.matchDate')}
                                        value={matchDate}
                                        onChange={(e) => void handleDateChange(e.target.value)}
                                        className="input !py-1 !pl-9 !pr-3 text-xs !w-auto"
                                    />
                                </div>
                            </div>

                            {busy ? (
                                <span className="text-xs text-text-muted animate-pulse">
                                    {t('common.saving')}
                                </span>
                            ) : saved ? (
                                <span className="text-xs text-green-500 font-medium">
                                    {t('common.saved')}
                                </span>
                            ) : null}
                        </>
                    ) : (
                        <div className="flex flex-wrap items-center justify-center gap-2">
                            <span className="text-xs px-2.5 py-0.5 rounded font-semibold uppercase bg-border text-text-muted">
                                {isFinished
                                    ? completionTypeLabel(normCt, t)
                                    : normCt === CompletionType.InProgress
                                      ? `LIVE · ${periodDisplayLabel()}`
                                      : t('match.notPlayed')}
                            </span>
                            {match.matchDate && (
                                <span className="text-xs text-text-muted">
                                    {new Date(match.matchDate).toLocaleDateString()}
                                </span>
                            )}
                        </div>
                    )}
                </div>

                {/* Away team */}
                <div className="w-full md:flex-1 flex justify-center md:justify-start text-center md:text-left">
                    <h1 className="text-lg sm:text-xl md:text-2xl font-bold">{match.awayTeamName}</h1>
                </div>
            </div>
        </div>
    )
}
