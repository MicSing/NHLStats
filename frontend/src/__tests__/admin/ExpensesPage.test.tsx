import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../testUtils'
import ExpensesPage from '../../pages/admin/ExpensesPage'

describe('ExpensesPage', () => {
    beforeEach(() => {
        localStorage.clear()
    })

    test('renders expenses list from API', async () => {
        renderWithProviders(<ExpensesPage />)
        expect(await screen.findByText('Pizza party')).toBeInTheDocument()
        expect(screen.getByText('Trophy')).toBeInTheDocument()
    })

    test('renders amounts for each expense', async () => {
        renderWithProviders(<ExpensesPage />)
        await screen.findByText('Pizza party')
        expect(screen.getByText('50.00 zł')).toBeInTheDocument()
        expect(screen.getByText('30.00 zł')).toBeInTheDocument()
    })

    test('renders total row', async () => {
        renderWithProviders(<ExpensesPage />)
        await screen.findByText('Pizza party')
        expect(screen.getByText('80.00 zł')).toBeInTheDocument()
        expect(screen.getByText('Total')).toBeInTheDocument()
    })

    test('shows Add Expense button', async () => {
        renderWithProviders(<ExpensesPage />)
        expect(await screen.findByRole('button', { name: /add expense/i })).toBeInTheDocument()
    })

    test('opens add modal with all fields', async () => {
        const user = userEvent.setup()
        renderWithProviders(<ExpensesPage />)
        await user.click(await screen.findByRole('button', { name: /add expense/i }))
        expect(screen.getByRole('dialog')).toBeInTheDocument()
        expect(screen.getByLabelText(/description/i)).toBeInTheDocument()
        expect(screen.getByLabelText(/amount/i)).toBeInTheDocument()
        expect(screen.getByLabelText(/^date$/i)).toBeInTheDocument()
    })

    test('add form submits and closes modal', async () => {
        const user = userEvent.setup()
        renderWithProviders(<ExpensesPage />)
        await user.click(await screen.findByRole('button', { name: /add expense/i }))
        await user.type(screen.getByLabelText(/description/i), 'New expense')
        await user.clear(screen.getByLabelText(/amount/i))
        await user.type(screen.getByLabelText(/amount/i), '25')
        await user.click(screen.getByRole('button', { name: /^save$/i }))
        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        })
    })

    test('edit button opens modal pre-populated with expense data', async () => {
        const user = userEvent.setup()
        renderWithProviders(<ExpensesPage />)
        const editButtons = await screen.findAllByRole('button', { name: /^edit$/i })
        await user.click(editButtons[0])
        expect(screen.getByRole('dialog')).toBeInTheDocument()
        expect(screen.getByDisplayValue('Pizza party')).toBeInTheDocument()
    })

    test('edit form saves and closes modal', async () => {
        const user = userEvent.setup()
        renderWithProviders(<ExpensesPage />)
        const editButtons = await screen.findAllByRole('button', { name: /^edit$/i })
        await user.click(editButtons[0])
        const descInput = screen.getByDisplayValue('Pizza party')
        await user.clear(descInput)
        await user.type(descInput, 'Updated expense')
        await user.click(screen.getByRole('button', { name: /^save$/i }))
        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        })
    })

    test('each expense row has Edit and Delete buttons', async () => {
        renderWithProviders(<ExpensesPage />)
        await screen.findByText('Pizza party')
        const editBtns = screen.getAllByRole('button', { name: /^edit$/i })
        const deleteBtns = screen.getAllByRole('button', { name: /^delete$/i })
        expect(editBtns).toHaveLength(2)
        expect(deleteBtns).toHaveLength(2)
    })
})
