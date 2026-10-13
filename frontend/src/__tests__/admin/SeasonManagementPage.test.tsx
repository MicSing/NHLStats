import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { rest } from 'msw'
import { renderWithProviders } from '../testUtils'
import { server } from '../../mocks/server'
import SeasonManagementPage from '../../pages/admin/SeasonManagementPage'

const BASE = 'http://localhost:5000'

describe('SeasonManagementPage', () => {
    beforeEach(() => {
        localStorage.clear()
    })

    test('creating a season without touching the status sends Active, not an empty string', async () => {
        let postedBody: Record<string, unknown> | null = null
        server.use(
            rest.post(`${BASE}/api/seasons`, async (req, res, ctx) => {
                postedBody = await req.json()
                return res(ctx.status(201), ctx.json({ id: 99, name: 'IIHF 1', startedOn: '2026-10-13', status: 'Active', leagueType: 'IIHF' }))
            }),
        )
        const user = userEvent.setup()
        renderWithProviders(<SeasonManagementPage />)

        await user.click((await screen.findAllByTitle('Add Season'))[0])
        const nameInput = screen.getByLabelText('Name')
        await user.type(nameInput, 'IIHF 1')
        const form = nameInput.closest('form') as HTMLFormElement
        await user.click(within(form).getByRole('button', { name: /^(create|save|add)/i }))

        await waitFor(() => expect(postedBody).not.toBeNull())
        expect(postedBody!.status).toBe('Active')
    })
})
