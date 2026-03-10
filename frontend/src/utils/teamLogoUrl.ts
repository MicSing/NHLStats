// ESPN CDN uses different codes for some NHL teams
const ESPN_NHL_CODES: Record<string, string> = {
    LAK: 'la',
    NJD: 'nj',
    SJS: 'sj',
    TBL: 'tb',
}

export function teamLogoUrl(shortName: string): string {
    const code = ESPN_NHL_CODES[shortName.toUpperCase()] ?? shortName.toLowerCase()
    return `https://a.espncdn.com/i/teamlogos/nhl/500/${code}.png`
}
