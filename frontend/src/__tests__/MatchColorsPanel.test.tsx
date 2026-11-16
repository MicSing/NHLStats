import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from './testUtils'
import MatchColorsPanel from '../components/MatchColorsPanel'

const getMock = vi.fn()
const putMock = vi.fn()
vi.mock('../services/apiClient', () => ({
    default: {
        get: (...args: unknown[]) => getMock(...args),
        put: (...args: unknown[]) => putMock(...args),
    },
}))

const row = { userId: 7, name: 'Michal', position: 'C', color: 'yellow', source: 'position', seasonColor: 'yellow' }

describe('MatchColorsPanel', () => {
    beforeEach(() => { getMock.mockReset(); putMock.mockReset() })

    test('shows the season colour and overrides it for this match', async () => {
        getMock.mockResolvedValue([row])
        putMock.mockResolvedValue([{ ...row, color: 'red', source: 'match' }])
        renderWithProviders(<MatchColorsPanel matchId={3} />)

        await userEvent.click(await screen.findByRole('button', { name: /player colours/i }))
        const select = screen.getByLabelText('Colour for Michal')
        expect(select).toHaveValue('')
        expect(screen.getByRole('option', { name: 'from season (yellow)' })).toBeInTheDocument()

        await userEvent.selectOptions(select, 'red')
        await waitFor(() => expect(putMock).toHaveBeenCalledWith('/api/matches/3/users/7/color', { color: 'red' }))
        expect(screen.getByLabelText('Colour for Michal')).toHaveValue('red')
    })

    test('renders nothing without users', async () => {
        getMock.mockResolvedValue([])
        renderWithProviders(<MatchColorsPanel matchId={3} />)
        await waitFor(() => expect(getMock).toHaveBeenCalled())
        expect(screen.queryByText(/player colours/i)).toBeNull()
    })
})
