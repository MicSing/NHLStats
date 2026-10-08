import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { rest } from 'msw'
import { vi } from 'vitest'
import { renderWithProviders } from './testUtils'
import PositionWheel from '../components/season/PositionWheel'
import { server } from '../mocks/server'
import type { PositionWheelState } from '../types/season'

const BASE = 'http://localhost:5000'

const state: PositionWheelState = {
    previousSeasonId: 7,
    previousSeasonName: '2024-25',
    order: [
        { userId: 2, name: 'Unlucky Ulrich', position: null, hasPreviousStats: true, minusPoints: 9, plusPoints: 3, penalties: 4, goals: 1 },
        { userId: 3, name: 'Rookie Rita', position: null, hasPreviousStats: false, minusPoints: 0, plusPoints: 0, penalties: 0, goals: 0 },
    ],
    currentSpinnerUserId: 2,
    availablePositions: ['LW', 'C', 'RW', 'LD', 'RD'],
}

const afterSpin: PositionWheelState = {
    ...state,
    order: [{ ...state.order[0], position: 'RW' }, state.order[1]],
    currentSpinnerUserId: 3,
    availablePositions: ['LW', 'C', 'LD', 'RD'],
}

beforeEach(() => {
    server.use(
        rest.get(`${BASE}/api/seasons/1/position-wheel`, (_req, res, ctx) => res(ctx.json(state))),
    )
})

describe('PositionWheel', () => {
    test('shows who spins and the spin order', async () => {
        renderWithProviders(<PositionWheel seasonId={1} onPositionsChanged={() => {}} />)

        expect(await screen.findByTestId('wheel-spinner')).toHaveTextContent('Unlucky Ulrich')
        expect(screen.getByText('Rookie Rita')).toBeInTheDocument()
        expect(screen.getByRole('img', { name: /LW, C, RW, LD, RD/ })).toBeInTheDocument()
    })

    test('spinning assigns the server result once the wheel stops and moves to the next player', async () => {
        let spinCalls = 0
        server.use(
            rest.post(`${BASE}/api/seasons/1/position-wheel/spin`, (_req, res, ctx) => {
                spinCalls++
                return res(ctx.json({ userId: 2, position: 'RW', state: afterSpin }))
            }),
        )
        const onChanged = vi.fn()
        renderWithProviders(<PositionWheel seasonId={1} onPositionsChanged={onChanged} />)
        await screen.findByTestId('wheel-spinner')

        await userEvent.click(screen.getByRole('button', { name: /spin|zatočiť/i }))

        await waitFor(() => expect(spinCalls).toBe(1))
        expect(onChanged).not.toHaveBeenCalled()
        fireEvent.transitionEnd(screen.getByTestId('position-wheel-disc'))

        expect(await screen.findByTestId('wheel-result')).toHaveTextContent(/Unlucky Ulrich.*RW/)
        // The landed segment is held for a moment before the wheel moves on.
        expect(screen.getByTestId('wheel-spinner')).toHaveTextContent('Unlucky Ulrich')
        await waitFor(() => expect(screen.getByTestId('wheel-spinner')).toHaveTextContent('Rookie Rita'), {
            timeout: 3000,
        })
        expect(screen.getByRole('img', { name: /LW, C, LD, RD/ })).toBeInTheDocument()
        expect(onChanged).toHaveBeenCalledTimes(1)
    })

    test('reset asks for confirmation and clears positions', async () => {
        let resetCalls = 0
        server.use(
            rest.post(`${BASE}/api/seasons/1/position-wheel/reset`, (_req, res, ctx) => {
                resetCalls++
                return res(ctx.json(state))
            }),
        )
        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
        const onChanged = vi.fn()
        renderWithProviders(<PositionWheel seasonId={1} onPositionsChanged={onChanged} />)
        await screen.findByTestId('wheel-spinner')

        await userEvent.click(screen.getByRole('button', { name: /reset/i }))

        await waitFor(() => expect(onChanged).toHaveBeenCalled())
        expect(confirmSpy).toHaveBeenCalled()
        expect(resetCalls).toBe(1)
        confirmSpy.mockRestore()
    })
})
