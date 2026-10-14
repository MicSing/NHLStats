import { describe, it, expect } from 'vitest'
import { teamLogoUrl } from '../utils/teamLogoUrl'

describe('teamLogoUrl', () => {
    it('returns an empty string without a short name', () => {
        expect(teamLogoUrl(null)).toBe('')
        expect(teamLogoUrl('')).toBe('')
    })

    it('returns the ESPN logo for NHL teams', () => {
        expect(teamLogoUrl('BOS')).toBe('https://a.espncdn.com/i/teamlogos/nhl/500/bos.png')
        expect(teamLogoUrl('LAK')).toBe('https://a.espncdn.com/i/teamlogos/nhl/500/la.png')
        expect(teamLogoUrl('CHI')).toBe('https://a.espncdn.com/i/teamlogos/nhl/500/chi.png')
    })

    it('returns a flag for IIHF national teams', () => {
        expect(teamLogoUrl('SVK')).toBe('https://flagcdn.com/w160/sk.png')
        expect(teamLogoUrl('sui')).toBe('https://flagcdn.com/w160/ch.png')
        expect(teamLogoUrl('GER')).toBe('https://flagcdn.com/w160/de.png')
    })
})
