import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, test, expect } from 'vitest'
import type { Match } from '../types/match'
import { CompletionType, MatchPhase } from '../types/match'
import UpNextPanel from '../components/season/UpNextPanel'

const makeMatch = (id: number, matchNumber: number): Match => ({
    id,
    seasonId: 1,
    matchNumber,
    homeTeamId: 1,
    homeTeamName: 'Slovakia',
    homeTeamShortName: 'SVK',
    awayTeamId: 2,
    awayTeamName: 'Czechia',
    awayTeamShortName: 'CZE',
    homeScore: 0,
    awayScore: 0,
    matchDate: null,
    completionType: CompletionType.None,
    phase: MatchPhase.RegularSeason,
    playoffRound: null,
})

const matches = [makeMatch(10, 1), makeMatch(11, 2)]

describe('UpNextPanel', () => {
    test('does not link to the admin match page for regular users', () => {
        render(
            <MemoryRouter>
                <UpNextPanel allMatches={matches} seasonId={1} seasons={[]} />
            </MemoryRouter>
        )
        expect(screen.getByText('Slovakia')).toBeInTheDocument()
        expect(screen.queryAllByRole('link')).toHaveLength(0)
    })

    test('links upcoming matches to the match page for admins', () => {
        render(
            <MemoryRouter>
                <UpNextPanel allMatches={matches} seasonId={1} seasons={[]} isAdmin />
            </MemoryRouter>
        )
        const hrefs = screen.getAllByRole('link').map((l) => l.getAttribute('href'))
        expect(hrefs).toEqual(['/seasons/1/matches/10', '/seasons/1/matches/11'])
    })
})
