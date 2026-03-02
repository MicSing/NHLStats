import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import SeasonSelector from '../components/SeasonSelector'
import type { Season } from '../types/season'

const mockSeasons: Season[] = [
    {
        id: 1,
        name: '2023-24',
        hostedTeamId: 1,
        hostedTeamName: 'Boston Bruins',
        startedOn: '2023-10-01T00:00:00',
        status: 'Active',
        parentSeasonId: null,
    },
    {
        id: 2,
        name: '2024-25',
        hostedTeamId: 2,
        hostedTeamName: 'Edmonton Oilers',
        startedOn: '2024-10-01T00:00:00',
        status: 'Upcoming',
        parentSeasonId: null,
    },
]

function renderSelector(
    selectedId: number | null = null,
    onChange: (id: number | null) => void = () => undefined,
) {
    return render(
        <MemoryRouter>
            <SeasonSelector seasons={mockSeasons} selectedId={selectedId} onChange={onChange} />
        </MemoryRouter>,
    )
}

describe('SeasonSelector', () => {
    test('renders all seasons as options', () => {
        renderSelector()
        expect(screen.getByText('2023-24')).toBeInTheDocument()
        expect(screen.getByText('2024-25')).toBeInTheDocument()
    })

    test('renders "All seasons" default option', () => {
        renderSelector()
        expect(screen.getByText('All seasons')).toBeInTheDocument()
    })

    test('reflects selected id in dropdown value', () => {
        renderSelector(2)
        const select = screen.getByRole('combobox') as HTMLSelectElement
        expect(select.value).toBe('2')
    })

    test('calls onChange with numeric id when a season is selected', async () => {
        const user = userEvent.setup()
        const onChange = vi.fn()
        renderSelector(1, onChange)
        await user.selectOptions(screen.getByRole('combobox'), '2')
        expect(onChange).toHaveBeenCalledWith(2)
    })

    test('calls onChange with null when "All seasons" is selected', async () => {
        const user = userEvent.setup()
        const onChange = vi.fn()
        renderSelector(1, onChange)
        await user.selectOptions(screen.getByRole('combobox'), '')
        expect(onChange).toHaveBeenCalledWith(null)
    })
})
