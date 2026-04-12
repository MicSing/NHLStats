import apiClient from './apiClient'
import type { User } from '../types/user'
import type { Season } from '../types/season'
import type { DashboardData, SeasonMatchHistory, UserPointReasonBreakdown } from '../types/stats'

const CACHE_DURATION_MS = 24 * 60 * 60 * 1000 // 1 day
const USER_STATS_CACHE_DURATION_MS = 5 * 60 * 1000 // 5 minutes

interface CacheEntry<T> {
    data: T
    timestamp: number
}

const CACHE_KEYS = {
    USERS: 'nhl-stats-users-cache',
    SEASONS: 'nhl-stats-seasons-cache',
    DASHBOARD: 'nhl-stats-dashboard-cache',
} as const

function userMatchHistoryKey(userId: number): string {
    return `nhl-stats-user-match-history-${userId}`
}

function userBreakdownKey(userId: number, seasonId?: number): string {
    return `nhl-stats-user-breakdown-${userId}-${seasonId ?? 'all'}`
}

function isCacheValid<T>(entry: CacheEntry<T> | null, duration = CACHE_DURATION_MS): entry is CacheEntry<T> {
    if (!entry) return false
    const now = Date.now()
    return now - entry.timestamp < duration
}

function getFromCache<T>(key: string, duration = CACHE_DURATION_MS): T | null {
    try {
        const cached = sessionStorage.getItem(key)
        if (!cached) return null

        const entry = JSON.parse(cached) as CacheEntry<T>
        if (isCacheValid(entry, duration)) {
            return entry.data
        }

        // Cache expired, remove it
        sessionStorage.removeItem(key)
        return null
    } catch {
        return null
    }
}

function setInCache<T>(key: string, data: T): void {
    try {
        const entry: CacheEntry<T> = {
            data,
            timestamp: Date.now(),
        }
        sessionStorage.setItem(key, JSON.stringify(entry))
    } catch {
        // Ignore storage errors
    }
}

export const cacheService = {
    /**
     * Get all users from cache or fetch from API if cache is invalid/empty.
     * Cache is valid for 1 day.
     */
    async getUsers(force = false): Promise<User[]> {
        if (!force) {
            const cached = getFromCache<User[]>(CACHE_KEYS.USERS)
            if (cached) return cached
        }

        const users = await apiClient.get<User[]>('/api/users')
        setInCache(CACHE_KEYS.USERS, users)
        return users
    },

    /**
     * Get all seasons from cache or fetch from API if cache is invalid/empty.
     * Cache is valid for 1 day.
     */
    async getSeasons(force = false): Promise<Season[]> {
        if (!force) {
            const cached = getFromCache<Season[]>(CACHE_KEYS.SEASONS)
            if (cached) return cached
        }

        const seasons = await apiClient.get<Season[]>('/api/seasons')
        setInCache(CACHE_KEYS.SEASONS, seasons)
        return seasons
    },

    /**
     * Get users for a specific season from cached users.
     * If you need fresh data, call getUsers(true) first.
     * Note: Currently returns all users. Season filtering would require additional API support.
     */
    async getSeasonUsers(): Promise<User[]> {
        return this.getUsers()
    },

    /**
     * Invalidate (clear) the users cache.
     * Next getUsers() call will fetch fresh data from API.
     */
    invalidateUsers(): void {
        sessionStorage.removeItem(CACHE_KEYS.USERS)
    },

    /**
     * Invalidate (clear) the seasons cache.
     * Next getSeasons() call will fetch fresh data from API.
     */
    invalidateSeasons(): void {
        sessionStorage.removeItem(CACHE_KEYS.SEASONS)
    },

    /**
     * Get all-seasons match history for a user from cache or fetch from API.
     * Cache is valid for 5 minutes. Season filtering is done client-side from the cached data.
     */
    async getUserMatchHistory(userId: number, force = false): Promise<SeasonMatchHistory[]> {
        const key = userMatchHistoryKey(userId)
        if (!force) {
            const cached = getFromCache<SeasonMatchHistory[]>(key, USER_STATS_CACHE_DURATION_MS)
            if (cached) return cached
        }

        const matchHistory = await apiClient.get<SeasonMatchHistory[]>(
            `/api/stats/users/${userId}/match-history`,
        )
        setInCache(key, matchHistory)
        return matchHistory
    },

    /**
     * Get point-reason breakdown for a user and optional season from cache or fetch from API.
     * Cached separately per (userId, seasonId) for 5 minutes.
     */
    async getUserBreakdown(userId: number, seasonId?: number, force = false): Promise<UserPointReasonBreakdown> {
        const key = userBreakdownKey(userId, seasonId)
        if (!force) {
            const cached = getFromCache<UserPointReasonBreakdown>(key, USER_STATS_CACHE_DURATION_MS)
            if (cached) return cached
        }

        const query = seasonId != null ? `?seasonId=${seasonId}` : ''
        const breakdown = await apiClient.get<UserPointReasonBreakdown>(
            `/api/stats/users/${userId}/point-reasons${query}`,
        )
        setInCache(key, breakdown)
        return breakdown
    },

    /**
     * Get dashboard data from cache or fetch from API if cache is invalid/empty.
     * Cache is valid for 5 minutes.
     */
    async getDashboardData(force = false): Promise<DashboardData> {
        const key = CACHE_KEYS.DASHBOARD
        if (!force) {
            const cached = getFromCache<DashboardData>(key, USER_STATS_CACHE_DURATION_MS)
            if (cached) return cached
        }
        const data = await apiClient.get<DashboardData>('/api/stats/dashboard')
        setInCache(key, data)
        return data
    },

    /**
     * Invalidate (clear) the dashboard cache.
     */
    invalidateDashboard(): void {
        sessionStorage.removeItem(CACHE_KEYS.DASHBOARD)
    },

    /**
     * Invalidate match history cache for a specific user.
     */
    invalidateUserMatchHistory(userId: number): void {
        sessionStorage.removeItem(userMatchHistoryKey(userId))
    },

    /**
     * Invalidate breakdown cache for a specific user and optional season.
     */
    invalidateUserBreakdown(userId: number, seasonId?: number): void {
        sessionStorage.removeItem(userBreakdownKey(userId, seasonId))
    },

    /**
     * Clear all caches.
     */
    clearAll(): void {
        this.invalidateUsers()
        this.invalidateSeasons()
        this.invalidateDashboard()
    },
}
