import { useState } from 'react'
import {
    PlusCircleIcon,
    WarningCircleIcon,
    ShieldCheckIcon,
    ShieldWarningIcon,
    TargetIcon,
} from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { useToast } from '../context/ToastContext'
import apiClient from '../services/apiClient'
import type { CreateTeamMatchEventDto } from '../types/match'

interface Props {
    matchId: number
    isHomeHosted: boolean
    homeTeamName: string | null
    awayTeamName: string | null
    isShootout: boolean
    isMatchFinished: boolean
    isAuth: boolean
    onEventAdded: () => Promise<void>
}

export default function MatchQuickActionsBar({
    matchId,
    isHomeHosted,
    homeTeamName,
    awayTeamName,
    isShootout,
    isMatchFinished,
    isAuth,
    onEventAdded,
}: Props) {
    const { t } = useTranslation()
    const toast = useToast()
    const [busyAction, setBusyAction] = useState<string | null>(null)

    if (!isAuth || isMatchFinished) return null

    const hostedName = isHomeHosted ? homeTeamName : awayTeamName
    const opponentName = isHomeHosted ? awayTeamName : homeTeamName

    const handleAction = async (actionKey: string, dto: CreateTeamMatchEventDto) => {
        if (busyAction) return
        setBusyAction(actionKey)
        try {
            await apiClient.post(`/api/matches/${matchId}/events`, dto)
            await onEventAdded()
        } catch {
            toast.error(t('toast.operationFailed'))
        } finally {
            setBusyAction(null)
        }
    }

    return (
        <div className="card p-3 sm:p-4 mb-5 shadow-md">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 divide-y md:divide-y-0 md:divide-x divide-border">
                {/* Hosted Team Actions */}
                <div className="flex flex-col gap-2 pt-1 md:pt-0 md:pr-4">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-primary uppercase tracking-wider">
                        <ShieldCheckIcon size={16} weight="bold" />
                        <span className="truncate">{hostedName} ({t('match.ourTeam')})</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            disabled={busyAction !== null}
                            onClick={() =>
                                void handleAction('team-goal', {
                                    eventType: 'Goal',
                                    isOpponent: false,
                                })
                            }
                            className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5 font-semibold disabled:opacity-50"
                        >
                            <PlusCircleIcon size={14} weight="bold" />
                            <span>{t('match.teamAiGoal')}</span>
                        </button>

                        <button
                            type="button"
                            disabled={busyAction !== null}
                            onClick={() =>
                                void handleAction('team-penalty', {
                                    eventType: 'Penalty',
                                    isOpponent: false,
                                })
                            }
                            className="bg-border hover:bg-border/70 text-amber-400 border border-amber-500/30 text-xs py-1.5 px-3 rounded-lg flex items-center gap-1.5 font-semibold transition-colors disabled:opacity-50"
                        >
                            <WarningCircleIcon size={14} weight="bold" />
                            <span>{t('match.teamPenalty')}</span>
                        </button>

                        {isShootout && (
                            <button
                                type="button"
                                disabled={busyAction !== null}
                                onClick={() =>
                                    void handleAction('team-so-goal', {
                                        eventType: 'ShootoutGoal',
                                        isOpponent: false,
                                    })
                                }
                                className="bg-purple-950/40 hover:bg-purple-900/60 text-purple-300 border border-purple-800/60 text-xs py-1.5 px-3 rounded-lg flex items-center gap-1.5 font-semibold transition-colors disabled:opacity-50"
                            >
                                <TargetIcon size={14} weight="bold" />
                                <span>{t('match.teamSoGoal')}</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Opponent Actions */}
                <div className="flex flex-col gap-2 pt-3 md:pt-0 md:pl-4">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-red-400 uppercase tracking-wider">
                        <ShieldWarningIcon size={16} weight="bold" />
                        <span className="truncate">{opponentName} ({t('match.opponent')})</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            disabled={busyAction !== null}
                            onClick={() =>
                                void handleAction('opp-goal', {
                                    eventType: 'Goal',
                                    isOpponent: true,
                                })
                            }
                            className="bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-800/60 text-xs py-1.5 px-3 rounded-lg flex items-center gap-1.5 font-semibold transition-colors disabled:opacity-50"
                        >
                            <PlusCircleIcon size={14} weight="bold" />
                            <span>{t('match.opponentGoal')}</span>
                        </button>

                        <button
                            type="button"
                            disabled={busyAction !== null}
                            onClick={() =>
                                void handleAction('opp-penalty', {
                                    eventType: 'Penalty',
                                    isOpponent: true,
                                })
                            }
                            className="bg-border hover:bg-border/70 text-amber-400 border border-amber-500/30 text-xs py-1.5 px-3 rounded-lg flex items-center gap-1.5 font-semibold transition-colors disabled:opacity-50"
                        >
                            <WarningCircleIcon size={14} weight="bold" />
                            <span>{t('match.opponentPenalty')}</span>
                        </button>

                        {isShootout && (
                            <button
                                type="button"
                                disabled={busyAction !== null}
                                onClick={() =>
                                    void handleAction('opp-so-goal', {
                                        eventType: 'ShootoutGoal',
                                        isOpponent: true,
                                    })
                                }
                                className="bg-purple-950/40 hover:bg-purple-900/60 text-purple-300 border border-purple-800/60 text-xs py-1.5 px-3 rounded-lg flex items-center gap-1.5 font-semibold transition-colors disabled:opacity-50"
                            >
                                <TargetIcon size={14} weight="bold" />
                                <span>{t('match.opponentSoGoal')}</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
