import { HubConnection, HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr'

export type SeasonEventType = 'Goal' | 'Penalty' | 'Point'

export interface SeasonEvent {
    seasonId: number
    matchId: number
    userMatchId: number
    actorUserId: string | null
    actorUserName: string | null
    eventType: SeasonEventType
    eventSubType: string
    playerName: string | null
    count: number
}

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ''
const HUB_PATH = '/hubs/season-events'

let connection: HubConnection | null = null
let startPromise: Promise<void> | null = null

function buildConnection(): HubConnection {
    return new HubConnectionBuilder()
        .withUrl(`${BASE_URL}${HUB_PATH}`, {
            accessTokenFactory: () => localStorage.getItem('token') ?? '',
        })
        .withAutomaticReconnect()
        .configureLogging(LogLevel.Warning)
        .build()
}

export async function getSeasonEventsConnection(): Promise<HubConnection> {
    if (!connection) {
        connection = buildConnection()
    }
    if (connection.state === HubConnectionState.Disconnected) {
        if (!startPromise) {
            startPromise = connection.start().finally(() => { startPromise = null })
        }
        await startPromise
    } else if (connection.state === HubConnectionState.Connecting && startPromise) {
        await startPromise
    }
    return connection
}

export function resetSeasonEventsConnection(): void {
    if (connection) {
        connection.stop().catch(() => { /* ignore */ })
    }
    connection = null
    startPromise = null
}
