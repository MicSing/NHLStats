import { render, screen } from '@testing-library/react'
import PlayerMarketRow from '../components/betting/PlayerMarketRow'

describe('PlayerMarketRow', () => {
    it('is enabled and untitled when odds are bettable', () => {
        render(<PlayerMarketRow name="Alice" odds={1.52} onAdd={() => {}} />)

        const button = screen.getByRole('button', { name: /Alice/ })
        expect(button).not.toBeDisabled()
        expect(button).not.toHaveAttribute('title')
        expect(button).toHaveTextContent('×1.52')
    })

    it('shows the disabled reason as a tooltip when no market is available', () => {
        render(<PlayerMarketRow name="Bob" odds={null} disabledReason="No bettable market for this user." onAdd={() => {}} />)

        const button = screen.getByRole('button', { name: /Bob/ })
        expect(button).toBeDisabled()
        expect(button).toHaveAttribute('title', 'No bettable market for this user.')
        expect(button).toHaveTextContent('—')
    })

    it('does not show the "no market" tooltip when disabled for an unrelated reason', () => {
        render(
            <PlayerMarketRow
                name="Carol"
                odds={1.52}
                forceDisabled
                disabledReason="No bettable market for this user."
                onAdd={() => {}}
            />,
        )

        const button = screen.getByRole('button', { name: /Carol/ })
        expect(button).toBeDisabled()
        expect(button).not.toHaveAttribute('title')
    })

    it('shows the occasions badge when provided', () => {
        render(<PlayerMarketRow name="Dana" odds={2.4} occasionsBadge={2} onAdd={() => {}} />)

        expect(screen.getByText('×2')).toBeInTheDocument()
    })
})
