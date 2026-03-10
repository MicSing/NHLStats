export interface NavItem {
    to: string
    labelKey: string
    requiresAuth?: boolean
}

export const publicNavItems: NavItem[] = [
    { to: '/dashboard', labelKey: 'nav.dashboard' },
    { to: '/seasons', labelKey: 'nav.seasons' },
    { to: '/betting-matches', labelKey: 'nav.bettingMatches', requiresAuth: true },
    { to: '/betting-history', labelKey: 'nav.bettingHistory', requiresAuth: true },
    { to: '/earnings', labelKey: 'nav.finances' },
    { to: '/user-stats', labelKey: 'nav.playerStats' },
    { to: '/rules', labelKey: 'nav.rules' },
]

export const adminNavItems = [
    { to: '/admin/logins', labelKey: 'nav.loginManagement' },
    { to: '/admin/users', labelKey: 'nav.users' },
    { to: '/admin/seasons', labelKey: 'nav.adminSeasons' },
    { to: '/admin/teams', labelKey: 'nav.teams' },
    { to: '/admin/roster', labelKey: 'nav.roster' },
    { to: '/admin/matches', labelKey: 'nav.matches' },
    { to: '/admin/aggregated-points', labelKey: 'nav.aggregatedPoints' },
    { to: '/admin/point-reasons', labelKey: 'nav.pointReasons' },
    { to: '/admin/money-config', labelKey: 'nav.moneyConfig' },
    { to: '/admin/expenses', labelKey: 'nav.expenses' },
    { to: '/admin/payouts', labelKey: 'nav.payouts' },
]
