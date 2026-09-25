import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useHighlightedUsers } from '../components/charts/useHighlightedUsers'

describe('useHighlightedUsers', () => {
    it('highlights nobody by default (all lines drawn normally)', () => {
        const { result } = renderHook(() => useHighlightedUsers(3))
        expect(result.current.highlighted).toBeNull()
        expect(result.current.lineProps('Alice').strokeOpacity).toBe(1)
        expect(result.current.lineProps('Alice').strokeWidth).toBe(2)
    })

    it('clicking a user highlights them and dims the others', () => {
        const { result } = renderHook(() => useHighlightedUsers(3))
        act(() => result.current.lineProps('Alice').onClick())
        expect(result.current.lineProps('Alice').strokeOpacity).toBe(1)
        expect(result.current.lineProps('Alice').strokeWidth).toBeGreaterThan(2)
        expect(result.current.lineProps('Bob').strokeOpacity).toBeLessThan(1)
    })

    it('clicking the same user again clears the highlight', () => {
        const { result } = renderHook(() => useHighlightedUsers(3))
        act(() => result.current.toggleUser('Alice'))
        act(() => result.current.toggleUser('Alice'))
        expect(result.current.highlighted).toBeNull()
    })

    it('legend click toggles highlight and resets when all users are selected', () => {
        const { result } = renderHook(() => useHighlightedUsers(2))
        act(() => result.current.legendProps.onClick({ value: 'Alice' }))
        expect(result.current.isHighlighted('Bob')).toBe(false)
        act(() => result.current.legendProps.onClick({ value: 'Bob' }))
        expect(result.current.highlighted).toBeNull()
    })
})
