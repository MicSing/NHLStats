import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import SeasonForm from '../components/season/SeasonForm'
import { LeagueType } from '../types/team'
import type { CreateSeasonDto } from '../types/season'

const baseForm: CreateSeasonDto = {
    name: 'Season',
    startedOn: '2026-10-01',
    status: 'Active',
    hostedTeamId: null,
    leagueType: LeagueType.NHL,
}

describe('SeasonForm', () => {
    test('plus/minus points switch is on by default', () => {
        render(<SeasonForm form={baseForm} teams={[]} onChange={() => {}} onSubmit={() => {}} />)
        expect(screen.getByRole('switch', { name: /plus\/minus points/i })).toHaveAttribute('aria-checked', 'true')
    })

    test('toggling the switch turns plus/minus points off', async () => {
        const user = userEvent.setup()
        const onChange = vi.fn()
        render(
            <SeasonForm form={{ ...baseForm, pointsEnabled: true }} teams={[]} onChange={onChange} onSubmit={() => {}} />,
        )

        await user.click(screen.getByRole('switch', { name: /plus\/minus points/i }))

        expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ pointsEnabled: false }))
    })

    test('switch reflects a season without points', () => {
        render(
            <SeasonForm form={{ ...baseForm, pointsEnabled: false }} teams={[]} onChange={() => {}} onSubmit={() => {}} />,
        )
        expect(screen.getByRole('switch', { name: /plus\/minus points/i })).toHaveAttribute('aria-checked', 'false')
    })
})
