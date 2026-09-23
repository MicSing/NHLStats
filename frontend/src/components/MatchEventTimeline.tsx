import React, { useState } from 'react'
import {
    ClockCountdownIcon,
    FlagCheckeredIcon,
    PlusCircleIcon,
    WarningCircleIcon,
    TargetIcon,
    DotsSixVerticalIcon,
    CaretUpIcon,
    CaretDownIcon,
    TrashIcon,
    ListBulletsIcon,
} from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { useToast } from '../context/ToastContext'
import apiClient from '../services/apiClient'
import type { MatchEvent } from '../types/match'

interface Props {
    matchId: number
    events: MatchEvent[]
    isAuth: boolean
    homeTeamName: string | null
    awayTeamName: string | null
    isHomeHosted: boolean
    onEventsChanged: () => Promise<void>
}

export default function MatchEventTimeline({
    matchId,
    events,
    isAuth,
    homeTeamName,
    awayTeamName,
    isHomeHosted,
    onEventsChanged,
}: Props) {
    const { t } = useTranslation()
    const toast = useToast()
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
    const [busy, setBusy] = useState(false)

    const opponentName = isHomeHosted ? awayTeamName : homeTeamName

    const handleReorder = async (newEvents: MatchEvent[]) => {
        if (busy) return
        setBusy(true)
        try {
            const eventIds = newEvents.map((e) => e.id)
            await apiClient.put(`/api/matches/${matchId}/events/reorder`, { eventIds })
            await onEventsChanged()
        } catch {
            toast.error(t('toast.operationFailed'))
        } finally {
            setBusy(false)
        }
    }

    const handleMove = async (index: number, direction: 'up' | 'down') => {
        const targetIndex = direction === 'up' ? index - 1 : index + 1
        if (targetIndex < 0 || targetIndex >= events.length) return
        const nextList = [...events]
        const temp = nextList[index]
        nextList[index] = nextList[targetIndex]
        nextList[targetIndex] = temp
        await handleReorder(nextList)
    }

    const handleDragStart = (e: React.DragEvent, index: number) => {
        if (!isAuth || busy) return
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', `${index}`)
        setDraggedIndex(index)
    }

    const handleDragOver = (e: React.DragEvent, index: number) => {
        if (!isAuth || busy) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        if (dragOverIndex !== index) {
            setDragOverIndex(index)
        }
    }

    const handleDrop = async (e: React.DragEvent, dropIndex: number) => {
        e.preventDefault()
        if (draggedIndex === null || draggedIndex === dropIndex) {
            setDraggedIndex(null)
            setDragOverIndex(null)
            return
        }
        const nextList = [...events]
        const [removed] = nextList.splice(draggedIndex, 1)
        nextList.splice(dropIndex, 0, removed)
        setDraggedIndex(null)
        setDragOverIndex(null)
        await handleReorder(nextList)
    }

    const handleDragEnd = () => {
        setDraggedIndex(null)
        setDragOverIndex(null)
    }

    const handleDelete = async (eventId: number) => {
        if (busy) return
        if (!window.confirm(t('match.deleteEventConfirm', 'Naozaj chcete zmazať túto udalosť?'))) return
        setBusy(true)
        try {
            await apiClient.delete(`/api/matches/${matchId}/events/${eventId}`)
            await onEventsChanged()
        } catch {
            toast.error(t('toast.operationFailed'))
        } finally {
            setBusy(false)
        }
    }

    const getPeriodLabel = (subtype?: string | null) => {
        switch (subtype) {
            case 'P1': return t('match.period1Title')
            case 'P2': return t('match.period2Title')
            case 'P3': return t('match.period3Title')
            case 'OT': return t('match.overtimeTitle')
            case 'SO': return t('match.shootoutTitle')
            default: return subtype ?? t('match.period1Title')
        }
    }

    return (
        <div className="card p-4 sm:p-6 mt-6 border border-border">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-border">
                <div className="flex items-center gap-2">
                    <ListBulletsIcon size={20} className="text-primary" />
                    <h3 className="font-bold text-base sm:text-lg">
                        {t('match.timelineTitle')}
                    </h3>
                    <span className="text-xs font-mono bg-bg text-text-muted px-2 py-0.5 rounded border border-border">
                        {events.length}
                    </span>
                </div>
                {busy && (
                    <span className="text-xs text-text-muted animate-pulse">
                        {t('common.saving')}
                    </span>
                )}
            </div>

            {/* Empty state */}
            {events.length === 0 && (
                <div className="text-center py-8 text-text-muted text-sm">
                    <p>{t('match.noEvents')}</p>
                </div>
            )}

            {/* Events list */}
            <div className="space-y-2">
                {events.map((evt, idx) => {
                    const isDivider = evt.eventType === 'PeriodChange' || evt.eventType === 'MatchEnd'
                    const isDraggingThis = draggedIndex === idx
                    const isDragOverThis = dragOverIndex === idx

                    return (
                        <div
                            key={evt.id}
                            draggable={isAuth && !busy}
                            onDragStart={(e) => handleDragStart(e, idx)}
                            onDragOver={(e) => handleDragOver(e, idx)}
                            onDrop={(e) => void handleDrop(e, idx)}
                            onDragEnd={handleDragEnd}
                            className={`transition-all rounded-lg ${
                                isDraggingThis ? 'opacity-40 scale-[0.98]' : 'opacity-100'
                            } ${
                                isDragOverThis ? 'ring-2 ring-primary ring-offset-2 ring-offset-bg' : ''
                            } ${
                                isDivider
                                    ? evt.eventType === 'MatchEnd'
                                        ? 'bg-emerald-950/30 border border-emerald-800/40 py-2 px-3'
                                        : 'bg-surface/50 border border-border py-2 px-3'
                                    : 'bg-surface/80 hover:bg-surface border border-border p-2.5 sm:px-4'
                            }`}
                        >
                            <div className="flex items-center justify-between gap-2">
                                {/* Left: Drag handle + Index + Icon + Title */}
                                <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                                    {isAuth && (
                                        <div
                                            className="text-text-muted hover:text-text cursor-grab active:cursor-grabbing p-0.5 shrink-0"
                                            title={t('common.dragToReorder', 'Presunúť')}
                                        >
                                            <DotsSixVerticalIcon size={18} weight="bold" />
                                        </div>
                                    )}

                                    {/* Order index pill */}
                                    <span className="text-[10px] font-mono font-bold text-text-muted bg-bg px-1.5 py-0.5 rounded border border-border shrink-0">
                                        #{evt.orderIndex}
                                    </span>

                                    {/* Event Body */}
                                    {evt.eventType === 'PeriodChange' && (
                                        <div className="flex items-center gap-2 flex-1 min-w-0 font-bold text-xs sm:text-sm text-primary uppercase tracking-wider">
                                            <ClockCountdownIcon size={16} weight="bold" className="shrink-0" />
                                            <span className="truncate">─── {getPeriodLabel(evt.eventSubtype)} ───</span>
                                        </div>
                                    )}

                                    {evt.eventType === 'MatchEnd' && (
                                        <div className="flex items-center gap-2 flex-1 min-w-0 font-bold text-xs sm:text-sm text-emerald-400 uppercase tracking-wider">
                                            <FlagCheckeredIcon size={16} weight="bold" className="shrink-0" />
                                            <span className="truncate">
                                                ─── {t('match.matchEndTitle')} ({evt.eventSubtype ?? 'REG'}) ───
                                            </span>
                                        </div>
                                    )}

                                    {evt.eventType === 'Goal' && (
                                        <div className="flex items-center gap-2 flex-1 min-w-0 text-xs sm:text-sm">
                                            <div
                                                className={`p-1 rounded-md shrink-0 ${
                                                    evt.isOpponent
                                                        ? 'bg-red-950/50 text-red-400 border border-red-800/40'
                                                        : 'bg-blue-950/50 text-blue-400 border border-blue-800/40'
                                                }`}
                                            >
                                                <PlusCircleIcon size={15} weight="bold" />
                                            </div>
                                            <div className="flex flex-col min-w-0">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span className="font-semibold text-text truncate">
                                                        {evt.isOpponent
                                                            ? `${t('match.opponentGoal')} (${opponentName})`
                                                            : evt.playerName
                                                              ? evt.playerName
                                                              : t('match.teamAiGoal')}
                                                    </span>
                                                    {evt.goalType && evt.goalType !== 'Regular' && (
                                                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-primary/20 text-primary border border-primary/30">
                                                            {evt.goalType === 'PowerPlay'
                                                                ? 'PP'
                                                                : evt.goalType === 'ShortHanded'
                                                                  ? 'SH'
                                                                  : 'SO'}
                                                        </span>
                                                    )}
                                                </div>
                                                {evt.userName && (
                                                    <span className="text-[11px] text-text-muted">
                                                        {evt.userName}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {evt.eventType === 'Penalty' && (
                                        <div className="flex items-center gap-2 flex-1 min-w-0 text-xs sm:text-sm">
                                            <div className="p-1 rounded-md bg-amber-950/50 text-amber-400 border border-amber-800/40 shrink-0">
                                                <WarningCircleIcon size={15} weight="bold" />
                                            </div>
                                            <div className="flex flex-col min-w-0">
                                                <span className="font-semibold text-text truncate">
                                                    {evt.isOpponent
                                                        ? `${t('match.opponentPenalty')} (${opponentName})`
                                                        : evt.playerName
                                                          ? `${t('userMatchCard.penalty')} - ${evt.playerName}`
                                                          : t('match.teamPenalty')}
                                                </span>
                                                {evt.userName && (
                                                    <span className="text-[11px] text-text-muted">
                                                        {evt.userName}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {evt.eventType === 'ShootoutGoal' && (
                                        <div className="flex items-center gap-2 flex-1 min-w-0 text-xs sm:text-sm">
                                            <div className="p-1 rounded-md bg-purple-950/50 text-purple-400 border border-purple-800/40 shrink-0">
                                                <TargetIcon size={15} weight="bold" />
                                            </div>
                                            <div className="flex flex-col min-w-0">
                                                <span className="font-semibold text-text truncate">
                                                    {evt.isOpponent
                                                        ? `${t('match.opponentSoGoal')} (${opponentName})`
                                                        : t('match.teamSoGoal')}
                                                </span>
                                            </div>
                                        </div>
                                    )}

                                    {evt.eventType === 'Point' && (
                                        <div className="flex items-center gap-2 flex-1 min-w-0 text-xs sm:text-sm">
                                            <div
                                                className={`p-1 rounded-md shrink-0 ${
                                                    evt.pointType === 'Positive'
                                                        ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-800/40'
                                                        : evt.pointType === 'Negative'
                                                          ? 'bg-red-950/50 text-red-400 border border-red-800/40'
                                                          : 'bg-surface text-text-muted border border-border'
                                                }`}
                                            >
                                                <span className="font-bold text-xs">
                                                    {evt.pointType === 'Positive' ? '+1' : evt.pointType === 'Negative' ? '−1' : '•'}
                                                </span>
                                            </div>
                                            <div className="flex flex-col min-w-0">
                                                <span className="font-semibold text-text truncate">
                                                    {evt.pointReasonName ?? t('userMatchCard.points')}
                                                </span>
                                                {evt.userName && (
                                                    <span className="text-[11px] text-text-muted">
                                                        {evt.userName}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Right: Up/Down Buttons + Delete */}
                                {isAuth && (
                                    <div className="flex items-center gap-1 shrink-0 ml-2">
                                        <button
                                            type="button"
                                            disabled={busy || idx === 0}
                                            onClick={() => void handleMove(idx, 'up')}
                                            title={t('match.moveUp')}
                                            className="p-1 text-text-muted hover:text-text hover:bg-bg rounded disabled:opacity-20 transition-colors"
                                        >
                                            <CaretUpIcon size={14} weight="bold" />
                                        </button>
                                        <button
                                            type="button"
                                            disabled={busy || idx === events.length - 1}
                                            onClick={() => void handleMove(idx, 'down')}
                                            title={t('match.moveDown')}
                                            className="p-1 text-text-muted hover:text-text hover:bg-bg rounded disabled:opacity-20 transition-colors"
                                        >
                                            <CaretDownIcon size={14} weight="bold" />
                                        </button>
                                        <button
                                            type="button"
                                            disabled={busy}
                                            onClick={() => void handleDelete(evt.id)}
                                            title={t('match.deleteEvent')}
                                            className="p-1 text-text-muted hover:text-danger hover:bg-danger/10 rounded transition-colors"
                                        >
                                            <TrashIcon size={14} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
