import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import {
    getSeasonEventsConnection,
    type SeasonEvent,
} from '../services/seasonEventsHub'

type NotificationStatus = NotificationPermission | 'unsupported'

function getInitialPermission(): NotificationStatus {
    if (typeof window === 'undefined' || typeof Notification === 'undefined') {
        return 'unsupported'
    }
    return Notification.permission
}

export interface SeasonEventNotificationsApi {
    permission: NotificationStatus
    requestPermission: () => Promise<NotificationStatus>
}

export function useSeasonEventNotifications(
    seasonId: number | null | undefined,
): SeasonEventNotificationsApi {
    const { user } = useAuth()
    const { t } = useTranslation()
    const [permission, setPermission] = useState<NotificationStatus>(getInitialPermission)
    const permissionRef = useRef<NotificationStatus>(permission)
    const userIdRef = useRef<string | null>(user?.id ?? null)
    const tRef = useRef(t)

    useEffect(() => { permissionRef.current = permission }, [permission])
    useEffect(() => { userIdRef.current = user?.id ?? null }, [user?.id])
    useEffect(() => { tRef.current = t }, [t])

    const requestPermission = useCallback(async (): Promise<NotificationStatus> => {
        if (typeof Notification === 'undefined') return 'unsupported'
        const result = await Notification.requestPermission()
        setPermission(result)
        return result
    }, [])

    useEffect(() => {
        if (!seasonId) return
        let cancelled = false
        let joined = false

        const handler = (evt: SeasonEvent) => {
            if (evt.seasonId !== seasonId) return
            if (evt.actorUserId && userIdRef.current && evt.actorUserId === userIdRef.current) return
            if (permissionRef.current !== 'granted') return
            if (typeof Notification === 'undefined') return

            const translate = tRef.current
            let title = translate('notifications.pointNeutral')
            if (evt.eventType === 'Goal') {
                title = translate('notifications.goal')
            } else if (evt.eventType === 'Penalty') {
                title = translate('notifications.penalty')
            } else if (evt.eventType === 'Point') {
                if (evt.eventSubType === 'Positive') title = translate('notifications.pointPositive')
                else if (evt.eventSubType === 'Negative') title = translate('notifications.pointNegative')
                else title = translate('notifications.pointNeutral')
            } else if (evt.eventType === 'MatchCompleted') {
                title = translate('notifications.matchCompleted')
            }

            let body: string
            if (evt.eventType === 'MatchCompleted') {
                const sub = evt.eventSubType === 'Overtime' ? ' (OT)'
                          : evt.eventSubType === 'Shootout' ? ' (SO)' : ''
                body = `${evt.homeTeamName ?? '?'} ${evt.homeScore}:${evt.awayScore} ${evt.awayTeamName ?? '?'}${sub}`
            } else {
                const parts: string[] = []
                if (evt.targetUserName) parts.push(evt.targetUserName)
                if (evt.playerName) parts.push(evt.playerName)
                if (evt.count > 1) parts.push(`×${evt.count}`)
                body = parts.join(' — ')
            }

            try {
                const tag = `season-event-${evt.userMatchId}-${Date.now()}`
                new Notification(title, { body, tag })
            } catch {
                // best-effort; some browsers/contexts disallow constructor on insecure origins
            }
        }

        void (async () => {
            try {
                const conn = await getSeasonEventsConnection()
                if (cancelled) return
                conn.on('SeasonEvent', handler)
                await conn.invoke('JoinSeason', seasonId)
                joined = true
            } catch (err) {
                console.warn('Failed to subscribe to season events hub', err)
            }
        })()

        return () => {
            cancelled = true
            void (async () => {
                try {
                    const conn = await getSeasonEventsConnection()
                    conn.off('SeasonEvent', handler)
                    if (joined) {
                        await conn.invoke('LeaveSeason', seasonId).catch(() => { /* ignore */ })
                    }
                } catch {
                    // ignore — connection may already be torn down
                }
            })()
        }
    }, [seasonId])

    return { permission, requestPermission }
}
