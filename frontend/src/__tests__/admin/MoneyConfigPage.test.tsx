import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../testUtils'
import MoneyConfigPage from '../../pages/admin/MoneyConfigPage'

describe('MoneyConfigPage', () => {
    beforeEach(() => {
        localStorage.clear()
    })

    test('renders current config values', async () => {
        renderWithProviders(<MoneyConfigPage />)
        // Current: negativePointValue 0.50, positivePointValue 0.25
        expect(await screen.findByText(/−0\.50 €/)).toBeInTheDocument()
        expect(screen.getByText(/\+0\.25 €/)).toBeInTheDocument()
    })

    test('renders history table with both entries', async () => {
        renderWithProviders(<MoneyConfigPage />)
        await screen.findByText(/−0\.50 €/)
        // history has two entries — check the second one's negative value
        const cells = screen.getAllByText(/0\.40 €/)
        expect(cells.length).toBeGreaterThan(0)
    })

    test('shows Rate History heading', async () => {
        renderWithProviders(<MoneyConfigPage />)
        expect(await screen.findByText(/rate history/i)).toBeInTheDocument()
    })

    test('shows Add Config button', async () => {
        renderWithProviders(<MoneyConfigPage />)
        expect(await screen.findByRole('button', { name: /add config/i })).toBeInTheDocument()
    })

    test('opens add modal with all form fields', async () => {
        const user = userEvent.setup()
        renderWithProviders(<MoneyConfigPage />)
        await user.click(await screen.findByRole('button', { name: /add config/i }))
        expect(screen.getByRole('dialog')).toBeInTheDocument()
        expect(screen.getByLabelText(/negative point value/i)).toBeInTheDocument()
        expect(screen.getByLabelText(/positive point value/i)).toBeInTheDocument()
        expect(screen.getByLabelText(/effective from/i)).toBeInTheDocument()
    })

    test('add form submits and closes modal', async () => {
        const user = userEvent.setup()
        renderWithProviders(<MoneyConfigPage />)
        await user.click(await screen.findByRole('button', { name: /add config/i }))
        await user.clear(screen.getByLabelText(/negative point value/i))
        await user.type(screen.getByLabelText(/negative point value/i), '0.6')
        await user.clear(screen.getByLabelText(/positive point value/i))
        await user.type(screen.getByLabelText(/positive point value/i), '0.3')
        await user.click(screen.getByRole('button', { name: /^save$/i }))
        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        })
    })
})
