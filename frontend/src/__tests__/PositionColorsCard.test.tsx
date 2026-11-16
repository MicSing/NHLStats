import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from './testUtils'
import PositionColorsCard from '../components/PositionColorsCard'

const getMock = vi.fn()
const putMock = vi.fn()
vi.mock('../services/apiClient', () => ({
    default: {
        get: (...args: unknown[]) => getMock(...args),
        put: (...args: unknown[]) => putMock(...args),
    },
}))

const colors = [
    { position: 'LW', color: null }, { position: 'C', color: 'green' }, { position: 'RW', color: null },
    { position: 'LD', color: null }, { position: 'RD', color: null },
]

describe('PositionColorsCard', () => {
    beforeEach(() => { getMock.mockReset(); putMock.mockReset() })

    test('shows the stored colour per position and saves a change', async () => {
        getMock.mockResolvedValue(colors)
        putMock.mockResolvedValue(colors.map((c) => (c.position === 'LD' ? { ...c, color: 'yellow' } : c)))
        renderWithProviders(<PositionColorsCard />)

        expect(await screen.findByLabelText('Colour for C')).toHaveValue('green')
        await userEvent.selectOptions(screen.getByLabelText('Colour for LD'), 'yellow')

        await waitFor(() => expect(putMock).toHaveBeenCalledWith('/api/admin/position-colors', { colors: { LD: 'yellow' } }))
        expect(screen.getByLabelText('Colour for LD')).toHaveValue('yellow')
    })

    test('clearing sends null', async () => {
        getMock.mockResolvedValue(colors)
        putMock.mockResolvedValue(colors)
        renderWithProviders(<PositionColorsCard />)
        await userEvent.selectOptions(await screen.findByLabelText('Colour for C'), '')
        await waitFor(() => expect(putMock).toHaveBeenCalledWith('/api/admin/position-colors', { colors: { C: null } }))
    })
})
