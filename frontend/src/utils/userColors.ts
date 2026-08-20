export const USER_COLORS = [
    '#3B82F6', // blue
    '#8B5CF6', // violet
    '#F59E0B', // amber
    '#EC4899', // pink
    '#06B6D4', // cyan
    '#10B981', // emerald
    '#F97316', // orange
    '#6366F1', // indigo
    '#14B8A6', // teal
    '#A855F7', // purple
    '#84CC16', // lime
    '#E11D48', // rose
    '#64748B', // slate
]

type UserIdentifier =
    | number
    | string
    | {
          userId?: number | null
          id?: number | null
          userName?: string | null
          name?: string | null
      }
    | null
    | undefined

/**
 * Returns a consistent, deterministic color for a user across all charts and views.
 * Prioritizes userId/id if available, and falls back to deterministic string hashing for names.
 */
export function getUserColor(user: UserIdentifier): string {
    if (user == null) {
        return USER_COLORS[0]
    }

    if (typeof user === 'number') {
        if (user > 0) {
            return USER_COLORS[(user - 1) % USER_COLORS.length]
        }
        return USER_COLORS[0]
    }

    if (typeof user === 'string') {
        if (!user.trim()) return USER_COLORS[0]
        let sum = 0
        for (let i = 0; i < user.length; i++) {
            sum = (sum << 5) - sum + user.charCodeAt(i)
            sum |= 0
        }
        const index = Math.abs(sum) % USER_COLORS.length
        return USER_COLORS[index]
    }

    if (typeof user === 'object') {
        if (typeof user.userId === 'number' && user.userId > 0) {
            return USER_COLORS[(user.userId - 1) % USER_COLORS.length]
        }
        if (typeof user.id === 'number' && user.id > 0) {
            return USER_COLORS[(user.id - 1) % USER_COLORS.length]
        }
        const name = user.userName || user.name
        if (typeof name === 'string' && name.trim()) {
            return getUserColor(name)
        }
    }

    return USER_COLORS[0]
}
