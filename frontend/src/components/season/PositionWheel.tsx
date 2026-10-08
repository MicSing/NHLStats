import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowCounterClockwiseIcon, SpinnerGapIcon } from '@phosphor-icons/react'
import type { PositionWheelSpinResult, PositionWheelState } from '../../types/season'
import type { SeasonUserPositionCode } from '../../types/seasonUserPosition'
import apiClient from '../../services/apiClient'
import { useToast } from '../../context/ToastContext'
import LoadingSpinner from '../LoadingSpinner'

const SPIN_DURATION_MS = 5500
const REDUCED_MOTION_DURATION_MS = 1200
const FULL_TURNS = 6
// How long the landed segment stays highlighted before the wheel moves on to the next player.
const REVEAL_MS = 1800
// Fast start, long gentle slow-down.
const SPIN_EASING = 'cubic-bezier(0.12, 0.75, 0.15, 1)'

const POSITION_COLORS: Record<SeasonUserPositionCode, string> = {
    LW: '#C53030',
    C: '#2E7AC1',
    RW: '#2E935A',
    LD: '#D69E2E',
    RD: '#7C3AED',
}

const SIZE = 280
const CENTER = SIZE / 2
const RADIUS = SIZE / 2 - 10

function polar(angleDeg: number, r: number) {
    const rad = ((angleDeg - 90) * Math.PI) / 180
    return { x: CENTER + r * Math.cos(rad), y: CENTER + r * Math.sin(rad) }
}

function segmentPath(startDeg: number, endDeg: number) {
    const start = polar(startDeg, RADIUS)
    const end = polar(endDeg, RADIUS)
    const largeArc = endDeg - startDeg > 180 ? 1 : 0
    return `M ${CENTER} ${CENTER} L ${start.x} ${start.y} A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${end.x} ${end.y} Z`
}

function prefersReducedMotion() {
    return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

/** Rotation (clockwise, cumulative) that stops the pointer at the top on the given segment. */
function targetRotation(current: number, index: number, count: number) {
    const segment = 360 / count
    // Land somewhere inside the segment, away from its edges.
    const landing = index * segment + segment * (0.2 + Math.random() * 0.6)
    const desired = (360 - landing) % 360
    const delta = (desired - (current % 360) + 360) % 360
    return current + FULL_TURNS * 360 + delta
}

export interface PositionWheelProps {
    seasonId: number
    /** Changes whenever season users change elsewhere, so the wheel reloads its state. */
    refreshKey?: unknown
    onPositionsChanged: () => void
}

export default function PositionWheel({ seasonId, refreshKey, onPositionsChanged }: PositionWheelProps) {
    const { t } = useTranslation()
    // The toast context object changes on every toast; its functions are stable.
    const { success: toastSuccess, error: toastError } = useToast()
    const [state, setState] = useState<PositionWheelState | null>(null)
    const [rotation, setRotation] = useState(0)
    const [duration, setDuration] = useState(SPIN_DURATION_MS)
    const [spinning, setSpinning] = useState(false)
    const [revealing, setRevealing] = useState<SeasonUserPositionCode | null>(null)
    const [lastResult, setLastResult] = useState<{ name: string; position: SeasonUserPositionCode } | null>(null)
    const pendingRef = useRef<{ result: PositionWheelSpinResult; name: string } | null>(null)
    const fallbackTimerRef = useRef<number | null>(null)
    const revealTimerRef = useRef<number | null>(null)
    const spinningRef = useRef(false)

    const fetchState = useCallback(
        () => apiClient.get<PositionWheelState>(`/api/seasons/${seasonId}/position-wheel`),
        [seasonId],
    )

    useEffect(() => {
        let cancelled = false
        fetchState()
            .then((data) => {
                if (!cancelled && !spinningRef.current) setState(data)
            })
            .catch(() => {
                if (!cancelled) toastError(t('toast.operationFailed'))
            })
        return () => {
            cancelled = true
        }
    }, [fetchState, refreshKey, t, toastError])

    useEffect(() => () => {
        if (fallbackTimerRef.current !== null) window.clearTimeout(fallbackTimerRef.current)
        if (revealTimerRef.current !== null) window.clearTimeout(revealTimerRef.current)
    }, [])

    const finishSpin = useCallback(() => {
        const pending = pendingRef.current
        if (!pending) return
        const { result, name } = pending
        pendingRef.current = null
        if (fallbackTimerRef.current !== null) {
            window.clearTimeout(fallbackTimerRef.current)
            fallbackTimerRef.current = null
        }
        setSpinning(false)
        setRevealing(result.position)
        setLastResult({ name, position: result.position })
        toastSuccess(t('admin.seasons.wheel.result', { name, position: result.position }))
        revealTimerRef.current = window.setTimeout(() => {
            revealTimerRef.current = null
            spinningRef.current = false
            setRevealing(null)
            setState(result.state)
            onPositionsChanged()
        }, REVEAL_MS)
    }, [onPositionsChanged, t, toastSuccess])

    const handleSpin = async () => {
        if (!state || spinningRef.current || state.currentSpinnerUserId === null) return
        spinningRef.current = true
        setSpinning(true)
        setLastResult(null)
        try {
            const result = await apiClient.post<PositionWheelSpinResult>(`/api/seasons/${seasonId}/position-wheel/spin`, null)
            const index = state.availablePositions.indexOf(result.position)
            const spinMs = prefersReducedMotion() ? REDUCED_MOTION_DURATION_MS : SPIN_DURATION_MS
            pendingRef.current = {
                result,
                name: state.order.find((e) => e.userId === result.userId)?.name ?? '',
            }
            setDuration(spinMs)
            setRotation((r) => targetRotation(r, Math.max(index, 0), state.availablePositions.length))
            // transitionend can be skipped (e.g. hidden tab), so finish on a timer as well.
            fallbackTimerRef.current = window.setTimeout(finishSpin, spinMs + 400)
        } catch {
            spinningRef.current = false
            setSpinning(false)
            toastError(t('toast.operationFailed'))
            fetchState().then(setState).catch(() => {})
        }
    }

    const handleReset = async () => {
        if (!window.confirm(t('admin.seasons.wheel.resetConfirm'))) return
        try {
            const data = await apiClient.post<PositionWheelState>(`/api/seasons/${seasonId}/position-wheel/reset`, null)
            setState(data)
            setLastResult(null)
            onPositionsChanged()
        } catch {
            toastError(t('toast.operationFailed'))
        }
    }

    if (!state) return <LoadingSpinner size="sm" inline />

    const busy = spinning || revealing !== null
    const spinner = state.order.find((e) => e.userId === state.currentSpinnerUserId) ?? null
    const positions = state.availablePositions
    const segment = 360 / Math.max(positions.length, 1)

    return (
        <section className="rounded-xl border border-border bg-surface p-4 space-y-4">
            <div>
                <h3 className="text-base font-semibold">{t('admin.seasons.wheel.title')}</h3>
                <p className="text-xs text-text-muted mt-1">{t('admin.seasons.wheel.description')}</p>
                <p className="text-xs text-text-muted mt-1">
                    {state.previousSeasonName
                        ? t('admin.seasons.wheel.previousSeason', { name: state.previousSeasonName })
                        : t('admin.seasons.wheel.noPreviousSeason')}
                </p>
            </div>

            <div className="rounded-lg bg-bg border border-border px-4 py-3 text-center" aria-live="polite">
                {state.order.length === 0 ? (
                    <span className="text-sm text-text-muted">{t('admin.seasons.wheel.noPlayers')}</span>
                ) : spinner ? (
                    <>
                        <div className="text-xs uppercase tracking-wider text-text-muted">
                            {t('admin.seasons.wheel.spinner')}
                        </div>
                        <div className="text-xl font-bold text-primary" data-testid="wheel-spinner">
                            {spinner.name}
                        </div>
                    </>
                ) : (
                    <span className="text-sm font-medium text-success">{t('admin.seasons.wheel.allAssigned')}</span>
                )}
                {lastResult && (
                    <div className="mt-2 text-base font-semibold" data-testid="wheel-result">
                        {t('admin.seasons.wheel.result', lastResult)}
                    </div>
                )}
            </div>

            {spinner && positions.length > 0 && (
                <div className="flex flex-col items-center gap-4">
                    <div className="relative" style={{ width: SIZE, height: SIZE, maxWidth: '100%' }}>
                        {/* Pointer */}
                        <div
                            className="absolute left-1/2 -top-1 z-10 -translate-x-1/2 drop-shadow"
                            style={{
                                width: 0,
                                height: 0,
                                borderLeft: '14px solid transparent',
                                borderRight: '14px solid transparent',
                                borderTop: '26px solid var(--color-text)',
                            }}
                            aria-hidden="true"
                        />
                        <svg
                            viewBox={`0 0 ${SIZE} ${SIZE}`}
                            width="100%"
                            height="100%"
                            role="img"
                            aria-label={t('admin.seasons.wheel.wheelLabel', { positions: positions.join(', ') })}
                        >
                            <circle cx={CENTER} cy={CENTER} r={RADIUS + 8} fill="var(--color-border)" />
                            <g
                                data-testid="position-wheel-disc"
                                onTransitionEnd={finishSpin}
                                style={{
                                    transform: `rotate(${rotation}deg)`,
                                    transformOrigin: `${CENTER}px ${CENTER}px`,
                                    transition: spinning ? `transform ${duration}ms ${SPIN_EASING}` : 'none',
                                }}
                            >
                                {positions.map((code, i) => {
                                    const start = i * segment
                                    const mid = start + segment / 2
                                    const label = polar(mid, RADIUS * 0.64)
                                    return (
                                        <g
                                            key={code}
                                            style={{
                                                opacity: revealing && revealing !== code ? 0.3 : 1,
                                                transition: 'opacity 300ms',
                                            }}
                                        >
                                            {positions.length === 1 ? (
                                                <circle cx={CENTER} cy={CENTER} r={RADIUS} fill={POSITION_COLORS[code]} />
                                            ) : (
                                                <path
                                                    d={segmentPath(start, start + segment)}
                                                    fill={POSITION_COLORS[code]}
                                                    stroke="var(--color-surface)"
                                                    strokeWidth={2}
                                                />
                                            )}
                                            <text
                                                x={label.x}
                                                y={label.y}
                                                fill="#fff"
                                                fontSize={26}
                                                fontWeight={800}
                                                textAnchor="middle"
                                                dominantBaseline="central"
                                                transform={`rotate(${mid} ${label.x} ${label.y})`}
                                            >
                                                {code}
                                            </text>
                                        </g>
                                    )
                                })}
                                {Array.from({ length: Math.max(positions.length, 1) * 4 }, (_, i) => {
                                    const peg = polar((i * segment) / 4, RADIUS + 3)
                                    return <circle key={i} cx={peg.x} cy={peg.y} r={3} fill="var(--color-text)" opacity={0.7} />
                                })}
                            </g>
                            <circle cx={CENTER} cy={CENTER} r={26} fill="var(--color-surface)" stroke="var(--color-border)" strokeWidth={4} />
                            <circle cx={CENTER} cy={CENTER} r={8} fill="var(--color-primary)" />
                        </svg>
                    </div>
                    <button
                        type="button"
                        onClick={() => void handleSpin()}
                        disabled={busy}
                        className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-6 py-2.5 rounded-full text-sm font-semibold shadow transition-colors disabled:opacity-60"
                    >
                        {spinning && <SpinnerGapIcon size={16} className="animate-spin" />}
                        {spinning ? t('admin.seasons.wheel.spinning') : t('admin.seasons.wheel.spin')}
                    </button>
                </div>
            )}

            {state.order.length > 0 && (
                <div>
                    <h4 className="text-xs uppercase tracking-wider text-text-muted mb-2">
                        {t('admin.seasons.wheel.order')}
                    </h4>
                    <ol className="space-y-1">
                        {state.order.map((entry, i) => {
                            const isCurrent = entry.userId === state.currentSpinnerUserId
                            return (
                                <li
                                    key={entry.userId}
                                    className={`flex items-center gap-3 rounded px-3 py-1.5 text-sm ${
                                        isCurrent ? 'bg-primary/15 ring-1 ring-primary' : ''
                                    }`}
                                >
                                    <span className="w-5 text-text-muted tabular-nums">{i + 1}.</span>
                                    <span className={`flex-1 ${isCurrent ? 'font-semibold' : ''}`}>{entry.name}</span>
                                    {entry.hasPreviousStats ? (
                                        <span
                                            className="text-xs text-text-muted tabular-nums"
                                            title={t('admin.seasons.wheel.statsSummary', {
                                                minus: entry.minusPoints,
                                                plus: entry.plusPoints,
                                                penalties: entry.penalties,
                                                goals: entry.goals,
                                            })}
                                        >
                                            −{entry.minusPoints} / +{entry.plusPoints} · F{entry.penalties} · G{entry.goals}
                                        </span>
                                    ) : (
                                        <span className="text-xs italic text-text-muted">{t('admin.seasons.wheel.noStats')}</span>
                                    )}
                                    <span
                                        className="min-w-9 text-center rounded px-1.5 py-0.5 text-xs font-bold text-white"
                                        style={{
                                            backgroundColor: entry.position
                                                ? POSITION_COLORS[entry.position]
                                                : 'var(--color-border)',
                                        }}
                                    >
                                        {entry.position ?? '—'}
                                    </span>
                                </li>
                            )
                        })}
                    </ol>
                </div>
            )}

            <div className="flex justify-end">
                <button
                    type="button"
                    onClick={() => void handleReset()}
                    disabled={busy}
                    className="flex items-center gap-1.5 text-xs text-text-muted hover:text-red-400 transition-colors disabled:opacity-50"
                >
                    <ArrowCounterClockwiseIcon size={14} />
                    {t('admin.seasons.wheel.reset')}
                </button>
            </div>
        </section>
    )
}
