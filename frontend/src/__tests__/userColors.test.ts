import { getUserColor, USER_COLORS } from '../utils/userColors'

describe('getUserColor', () => {
    test('returns consistent color for a given userId', () => {
        const color1 = getUserColor(1)
        const color2 = getUserColor(2)
        const color1Again = getUserColor(1)

        expect(color1).toBe(USER_COLORS[0])
        expect(color2).toBe(USER_COLORS[1])
        expect(color1).toBe(color1Again)
    })

    test('returns consistent color for objects with userId or id', () => {
        expect(getUserColor({ userId: 1, userName: 'Michal' })).toBe(USER_COLORS[0])
        expect(getUserColor({ id: 2, name: 'Peter' })).toBe(USER_COLORS[1])
    })

    test('returns consistent color for user names when id is not available', () => {
        const colorNameA = getUserColor('Player One')
        const colorNameAAgain = getUserColor('Player One')
        expect(colorNameA).toBe(colorNameAAgain)
        expect(USER_COLORS).toContain(colorNameA)
    })

    test('handles fallback and edge cases gracefully', () => {
        expect(getUserColor(null)).toBe(USER_COLORS[0])
        expect(getUserColor(undefined)).toBe(USER_COLORS[0])
        expect(getUserColor(0)).toBe(USER_COLORS[0])
        expect(getUserColor('')).toBe(USER_COLORS[0])
    })
})
