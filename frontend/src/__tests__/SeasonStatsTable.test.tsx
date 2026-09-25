import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SeasonStatsTable from '../components/season/SeasonStatsTable'
import type { UserSeasonStats, UserSeasonTotals } from '../types/stats'

const stats: UserSeasonStats[] = [
    { userId: 1, userName: 'Alice', totalPlus: 5, totalMinus: 1, earnings: 10, bettingBalance: 0 },
]
const userTotals: UserSeasonTotals[] = [
    { userId: 1, userName: 'Alice', totalGoals: 2, totalPenalties: 1, gamesPlayed: 7 },
]

describe('SeasonStatsTable', () => {
    test('renders a games played column with the player count', () => {
        render(<SeasonStatsTable stats={stats} userTotals={userTotals} />)
        expect(screen.getByRole('columnheader', { name: 'GP' })).toHaveAttribute('title', 'Games played')
        const row = screen.getByRole('row', { name: /alice/i })
        expect(row.querySelectorAll('td')[1]).toHaveTextContent('7')
    })

    test('does not render the phase switch when showPhaseSwitch is false', () => {
        render(<SeasonStatsTable stats={stats} userTotals={userTotals} />)
        expect(screen.queryByRole('button', { name: /playoff/i })).not.toBeInTheDocument()
    })

    test('renders All/Season/Playoff pills and calls onPhaseChange when clicked', async () => {
        const user = userEvent.setup()
        const onPhaseChange = vi.fn()
        render(
            <SeasonStatsTable
                stats={stats}
                userTotals={userTotals}
                showPhaseSwitch={true}
                phase="All"
                onPhaseChange={onPhaseChange}
            />,
        )

        const allButton = screen.getByRole('button', { name: /^all$/i })
        const seasonButton = screen.getByRole('button', { name: /^season$/i })
        const playoffButton = screen.getByRole('button', { name: /^playoff$/i })
        expect(allButton).toBeInTheDocument()
        expect(seasonButton).toBeInTheDocument()

        await user.click(playoffButton)
        expect(onPhaseChange).toHaveBeenCalledWith('Playoff')
    })

    test('renders the table with no player rows when stats is empty but the switch is shown', () => {
        render(<SeasonStatsTable stats={[]} userTotals={[]} showPhaseSwitch={true} phase="Playoff" />)
        expect(screen.getByRole('button', { name: /^playoff$/i })).toBeInTheDocument()
        expect(screen.queryByText('Alice')).not.toBeInTheDocument()
    })
})
