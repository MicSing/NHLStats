import { useCallback, useEffect, useState } from 'react'
import { CheckIcon, PencilSimpleIcon, RobotIcon, XIcon } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import apiClient from '../services/apiClient'
import { useToast } from '../context/ToastContext'
import type { ConfirmProposalDto, MatchEventProposal } from '../types/collector'
import type { UserMatch } from '../types/userMatch'
import type { RosterPlayer } from '../types/roster'

const POLL_INTERVAL_MS = 5000

interface Props {
    matchId: number
    userMatches: UserMatch[]
    roster: RosterPlayer[]
    /** Called after a confirm, so the page reloads the score and events. */
    onConfirmed: () => Promise<void> | void
}

interface EditState {
    isOpponent: boolean
    userId: number | ''
    rosterPlayerId: number | ''
    goalType: MatchEventProposal['goalType']
}

const ATTRIBUTABLE = new Set(['Goal', 'Penalty', 'ShootoutGoal'])

/**
 * Review queue for events the Collector app proposed for this match
 * (GET /api/matches/{id}/proposals). Hidden while there is nothing to review.
 */
export default function MatchProposalsPanel({ matchId, userMatches, roster, onConfirmed }: Props) {
    const { t } = useTranslation()
    const toast = useToast()
    const [proposals, setProposals] = useState<MatchEventProposal[]>([])
    const [editing, setEditing] = useState<Record<number, EditState>>({})
    const [busyId, setBusyId] = useState<number | null>(null)

    const load = useCallback(async () => {
        try {
            const data = await apiClient.get<MatchEventProposal[]>(`/api/matches/${matchId}/proposals?status=Proposed`)
            setProposals(data)
        } catch {
            // Keep the last list; a transient failure shouldn't blank the queue.
        }
    }, [matchId])

    useEffect(() => {
        void load()
        const timer = setInterval(() => void load(), POLL_INTERVAL_MS)
        return () => clearInterval(timer)
    }, [load])

    if (proposals.length === 0) return null

    const describe = (p: MatchEventProposal) => {
        const type = t(`collector.type.${p.eventType}`, p.eventType)
        const side = p.isOpponent ? ` ${t('collector.opponent')}` : ''
        const sub = p.eventSubtype && p.eventType !== 'Goal' && p.eventType !== 'Penalty' ? ` (${p.eventSubtype})` : ''
        const gt = p.goalType === 'PowerPlay' || p.goalType === 'ShortHanded' ? `, ${t(`collector.goalType.${p.goalType}`)}` : ''
        return `${type}${side}${sub}${gt}`
    }

    const who = (p: MatchEventProposal) => {
        if (!ATTRIBUTABLE.has(p.eventType) || p.isOpponent) return null
        if (p.userName && p.playerName) return `${p.userName} · ${p.playerName}`
        return t('collector.unknownPlayer')
    }

    const startEdit = (p: MatchEventProposal) =>
        setEditing((e) => ({
            ...e,
            [p.id]: { isOpponent: p.isOpponent, userId: p.userId ?? '', rosterPlayerId: p.rosterPlayerId ?? '', goalType: p.goalType },
        }))

    const act = async (p: MatchEventProposal, action: 'confirm' | 'reject') => {
        if (busyId) return
        setBusyId(p.id)
        try {
            if (action === 'confirm') {
                const edit = editing[p.id]
                const body: ConfirmProposalDto = edit
                    ? {
                        isOpponent: edit.isOpponent,
                        clearUser: !edit.isOpponent && edit.userId === '',
                        userId: edit.userId === '' ? null : edit.userId,
                        rosterPlayerId: edit.rosterPlayerId === '' ? null : edit.rosterPlayerId,
                        goalType: edit.goalType,
                    }
                    : {}
                await apiClient.post(`/api/matches/${matchId}/proposals/${p.id}/confirm`, body)
                toast.success(t('collector.confirmed'))
                await onConfirmed()
            } else {
                await apiClient.post(`/api/matches/${matchId}/proposals/${p.id}/reject`, {})
            }
            setEditing((prev) => {
                const next = { ...prev }
                delete next[p.id]
                return next
            })
            await load()
        } catch (err: unknown) {
            const apiError = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
            toast.error(apiError || t('toast.operationFailed'))
        } finally {
            setBusyId(null)
        }
    }

    const confidenceClass: Record<string, string> = {
        High: 'text-green-500 border-green-500/40',
        Medium: 'text-amber-500 border-amber-500/40',
        Low: 'text-red-500 border-red-500/40',
    }

    return (
        <section className="card p-3 sm:p-4 mb-5 border border-amber-500/40" aria-label={t('collector.title')}>
            <div className="flex items-center gap-2 mb-3">
                <RobotIcon size={18} className="text-amber-500" />
                <h2 className="font-semibold">{t('collector.title')}</h2>
                <span className="text-xs rounded-full bg-amber-500/15 text-amber-500 px-2 py-0.5">{proposals.length}</span>
            </div>
            <p className="text-xs text-text-muted mb-3">{t('collector.hint')}</p>
            <ul className="divide-y divide-border">
                {proposals.map((p) => {
                    const edit = editing[p.id]
                    const meta = [
                        p.period ? t('collector.period', { period: p.period }) : null,
                        p.gameClock,
                        p.occurredAt ? new Date(p.occurredAt).toLocaleTimeString() : null,
                        p.apiKeyName,
                    ].filter(Boolean).join(' · ')
                    const canAttribute = ATTRIBUTABLE.has(p.eventType)
                    return (
                        <li key={p.id} className="py-3 flex flex-col gap-2" data-testid={`proposal-${p.id}`}>
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="font-medium">{describe(p)}</span>
                                {who(p) && <span className="text-sm text-text-muted">{who(p)}</span>}
                                <span className={`text-[11px] border rounded-full px-2 ${confidenceClass[p.confidence] ?? ''}`}>
                                    {t(`collector.confidence.${p.confidence}`)}
                                </span>
                                <div className="ml-auto flex gap-2">
                                    {canAttribute && !edit && (
                                        <button
                                            onClick={() => startEdit(p)}
                                            className="flex items-center gap-1 border border-border hover:border-primary rounded-lg px-3 py-1.5 text-sm"
                                        >
                                            <PencilSimpleIcon size={14} /> {t('collector.edit')}
                                        </button>
                                    )}
                                    <button
                                        onClick={() => void act(p, 'confirm')}
                                        disabled={busyId !== null}
                                        className="flex items-center gap-1 bg-primary hover:bg-primary-hover rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-50"
                                    >
                                        <CheckIcon size={14} /> {t('collector.confirm')}
                                    </button>
                                    <button
                                        onClick={() => void act(p, 'reject')}
                                        disabled={busyId !== null}
                                        className="flex items-center gap-1 border border-red-500 text-red-500 hover:bg-red-500/10 rounded-lg px-3 py-1.5 text-sm disabled:opacity-50"
                                    >
                                        <XIcon size={14} /> {t('collector.reject')}
                                    </button>
                                </div>
                            </div>
                            {meta && <div className="text-xs text-text-muted">{meta}{p.note ? ` · ${p.note}` : ''}</div>}
                            {edit && (
                                <div className="flex flex-wrap gap-2 items-center bg-bg rounded-lg p-2">
                                    <label className="flex items-center gap-1 text-sm">
                                        <input
                                            type="checkbox"
                                            checked={edit.isOpponent}
                                            onChange={(e) => setEditing((s) => ({ ...s, [p.id]: { ...edit, isOpponent: e.target.checked } }))}
                                        />
                                        {t('collector.opponentEvent')}
                                    </label>
                                    {!edit.isOpponent && (
                                        <>
                                            <select
                                                aria-label={t('collector.user')}
                                                value={edit.userId}
                                                onChange={(e) => setEditing((s) => ({ ...s, [p.id]: { ...edit, userId: e.target.value === '' ? '' : Number(e.target.value) } }))}
                                                className="bg-surface border border-border rounded px-2 py-1 text-sm"
                                            >
                                                <option value="">{t('collector.unknownPlayer')}</option>
                                                {userMatches.map((um) => (
                                                    <option key={um.userId} value={um.userId}>{um.userName}</option>
                                                ))}
                                            </select>
                                            {edit.userId !== '' && (
                                                <select
                                                    aria-label={t('collector.player')}
                                                    value={edit.rosterPlayerId}
                                                    onChange={(e) => setEditing((s) => ({ ...s, [p.id]: { ...edit, rosterPlayerId: e.target.value === '' ? '' : Number(e.target.value) } }))}
                                                    className="bg-surface border border-border rounded px-2 py-1 text-sm"
                                                >
                                                    <option value="">{t('collector.choosePlayer')}</option>
                                                    {roster.map((r) => (
                                                        <option key={r.id} value={r.id}>{r.surname} {r.firstName}{r.position ? ` (${r.position})` : ''}</option>
                                                    ))}
                                                </select>
                                            )}
                                        </>
                                    )}
                                    {p.eventType === 'Goal' && (
                                        <select
                                            aria-label={t('collector.goalTypeLabel')}
                                            value={edit.goalType ?? 'Regular'}
                                            onChange={(e) => setEditing((s) => ({ ...s, [p.id]: { ...edit, goalType: e.target.value as MatchEventProposal['goalType'] } }))}
                                            className="bg-surface border border-border rounded px-2 py-1 text-sm"
                                        >
                                            <option value="Regular">{t('collector.goalType.Regular')}</option>
                                            <option value="PowerPlay">{t('collector.goalType.PowerPlay')}</option>
                                            <option value="ShortHanded">{t('collector.goalType.ShortHanded')}</option>
                                        </select>
                                    )}
                                </div>
                            )}
                        </li>
                    )
                })}
            </ul>
        </section>
    )
}
