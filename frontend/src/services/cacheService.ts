import apiClient from './apiClient'
import type { User } from '../types/user'
import type { Season } from '../types/season'

const CACHE_DURATION_MS = 24 * 60 * 60 * 1000 // 1 day

interface CacheEntry<T> {
    data: T
    timestamp: number
}

const CACHE_KEYS = {
    USERS: 'nhl-stats-users-cache',
    SEASONS: 'nhl-stats-seasons-cache',
} as const

function isCacheValid<T>(entry: CacheEntry<T> | null): entry is CacheEntry<T> {
    if (!entry) return false
    const now = Date.now()
    return now - entry.timestamp < CACHE_DURATION_MS
}

function getFromCache<T>(key: string): T | null {
    try {
        const cached = sessionStorage.getItem(key)
        if (!cached) return null

        const entry = JSON.parse(cached) as CacheEntry<T>
        if (isCacheValid(entry)) {
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
     * Clear all caches.
     */
    clearAll(): void {
        this.invalidateUsers()
        this.invalidateSeasons()
    },
}
