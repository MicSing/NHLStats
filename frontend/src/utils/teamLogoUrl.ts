// ESPN CDN uses different codes for some NHL teams
const ESPN_NHL_CODES: Record<string, string> = {
    LAK: 'la',
    NJD: 'nj',
    SJS: 'sj',
    TBL: 'tb',
}

// IIHF/IOC national team codes → ISO 3166-1 alpha-2 codes used by the flag CDN.
// CHI (Chile) and COL (Colombia) are left out on purpose: they clash with NHL short names.
const NATIONAL_TEAM_CODES: Record<string, string> = {
    AUT: 'at', BLR: 'by', CAN: 'ca', CHN: 'cn', CRO: 'hr', CZE: 'cz', DEN: 'dk',
    DNK: 'dk', DEU: 'de', EST: 'ee', FIN: 'fi', FRA: 'fr', GBR: 'gb', GER: 'de',
    HUN: 'hu', ITA: 'it', JPN: 'jp', KAZ: 'kz', KOR: 'kr', LAT: 'lv', LTU: 'lt',
    LVA: 'lv', NED: 'nl', NLD: 'nl', NOR: 'no', POL: 'pl', ROC: 'ru', ROU: 'ro',
    RUS: 'ru', SLO: 'si', SVN: 'si', SRB: 'rs', SUI: 'ch', CHE: 'ch', SVK: 'sk',
    SWE: 'se', UKR: 'ua', USA: 'us',
}

export function teamLogoUrl(shortName: string | null | undefined): string {
    if (!shortName) return ''
    const upper = shortName.trim().toUpperCase()
    const flag = NATIONAL_TEAM_CODES[upper]
    if (flag) return `https://flagcdn.com/w160/${flag}.png`
    const code = ESPN_NHL_CODES[upper] ?? upper.toLowerCase()
    return `https://a.espncdn.com/i/teamlogos/nhl/500/${code}.png`
}
