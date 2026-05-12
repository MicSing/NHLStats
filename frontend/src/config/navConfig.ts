export interface NavItem {
    to: string
    labelKey: string
    requiresAuth?: boolean
}

export interface NavGroup {
    labelKey: string
    items: NavItem[]
}

export const publicNavItems: NavItem[] = [
    { to: '/dashboard', labelKey: 'nav.dashboard' },
    { to: '/seasons', labelKey: 'nav.seasons' },
    { to: '/user-stats', labelKey: 'nav.playerStats' },
    { to: '/betting', labelKey: 'nav.betting', requiresAuth: true },
    { to: '/earnings', labelKey: 'nav.finances' },
    { to: '/rules', labelKey: 'nav.rules' },
]

export const adminNavGroups: NavGroup[] = [
    {
        labelKey: 'nav.groupUsers',
        items: [
            { to: '/admin/logins', labelKey: 'nav.loginManagement' },
            { to: '/admin/users', labelKey: 'nav.users' },
        ],
    },
    {
        labelKey: 'nav.groupGameData',
        items: [
            { to: '/admin/seasons', labelKey: 'nav.adminSeasons' },
            { to: '/admin/teams', labelKey: 'nav.teams' },
            { to: '/admin/roster', labelKey: 'nav.roster' },
            { to: '/admin/matches', labelKey: 'nav.matches' },
        ],
    },
    {
        labelKey: 'nav.groupPoints',
        items: [
            { to: '/admin/aggregated-points', labelKey: 'nav.aggregatedPoints' },
            { to: '/admin/point-reasons', labelKey: 'nav.pointReasons' },
            { to: '/admin/points', labelKey: 'nav.pointsManagement' },
        ],
    },
    {
        labelKey: 'nav.groupFinancial',
        items: [
            { to: '/admin/money-config', labelKey: 'nav.moneyConfig' },
            { to: '/admin/expenses', labelKey: 'nav.expenses' },
            { to: '/admin/payouts', labelKey: 'nav.payouts' },
        ],
    },
]
