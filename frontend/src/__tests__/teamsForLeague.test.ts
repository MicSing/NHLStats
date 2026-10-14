import { describe, it, expect } from 'vitest'
import { teamsForLeague } from '../components/season/seasonUtils'
import type { Team } from '../types/team'

const teams: Team[] = [
    { id: 1, name: 'Boston Bruins', shortName: 'BOS', leagueType: 'NHL' },
    { id: 2, name: 'Slovakia', shortName: 'SVK', leagueType: 'IIHF' },
    { id: 3, name: 'Czechia', shortName: 'CZE', leagueType: 'IIHF' },
]

describe('teamsForLeague', () => {
    it('keeps only teams of the given league', () => {
        expect(teamsForLeague(teams, 'IIHF').map((t) => t.id)).toEqual([2, 3])
        expect(teamsForLeague(teams, 'NHL').map((t) => t.id)).toEqual([1])
    })

    it('falls back to all teams when the league has none', () => {
        expect(teamsForLeague(teams, 'Olympic')).toEqual(teams)
    })
})
