import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../testUtils'
import ApiKeysPage from '../../pages/admin/ApiKeysPage'

const getMock = vi.fn()
const postMock = vi.fn()
const deleteMock = vi.fn()
vi.mock('../../services/apiClient', () => ({
    default: {
        get: (...args: unknown[]) => getMock(...args),
        post: (...args: unknown[]) => postMock(...args),
        delete: (...args: unknown[]) => deleteMock(...args),
    },
}))

const key = { id: 1, name: 'Collector PC', prefix: 'nhls_abcdefg', createdAt: '2026-11-16T14:00:00Z', lastUsedAt: null, revokedAt: null }

describe('ApiKeysPage', () => {
    beforeEach(() => {
        getMock.mockReset()
        postMock.mockReset()
        deleteMock.mockReset()
    })

    test('lists keys by prefix only', async () => {
        getMock.mockResolvedValue([key])
        renderWithProviders(<ApiKeysPage />)
        expect(await screen.findByText('Collector PC')).toBeInTheDocument()
        expect(screen.getByText('nhls_abcdefg…')).toBeInTheDocument()
    })

    test('creating a key shows the plaintext once', async () => {
        getMock.mockResolvedValueOnce([]).mockResolvedValue([key])
        postMock.mockResolvedValue({ apiKey: key, key: 'nhls_secret-value' })
        renderWithProviders(<ApiKeysPage />)

        await userEvent.type(await screen.findByLabelText('Name'), 'Collector PC')
        await userEvent.click(screen.getByRole('button', { name: /create key/i }))

        await waitFor(() => expect(postMock).toHaveBeenCalledWith('/api/admin/api-keys', { name: 'Collector PC' }))
        expect(await screen.findByTestId('new-api-key')).toHaveTextContent('nhls_secret-value')
        await userEvent.click(screen.getByRole('button', { name: /hide/i }))
        expect(screen.queryByTestId('new-api-key')).toBeNull()
    })

    test('revoke asks for confirmation and calls delete', async () => {
        getMock.mockResolvedValue([key])
        deleteMock.mockResolvedValue({})
        vi.spyOn(window, 'confirm').mockReturnValue(true)
        renderWithProviders(<ApiKeysPage />)

        await userEvent.click(await screen.findByRole('button', { name: /revoke/i }))
        await waitFor(() => expect(deleteMock).toHaveBeenCalledWith('/api/admin/api-keys/1'))
    })
})
