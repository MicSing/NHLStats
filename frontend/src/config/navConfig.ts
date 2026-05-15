import type { Icon as PhosphorIcon } from '@phosphor-icons/react'
import {
    House, Trophy, ChartLine, Target, CurrencyDollar, BookOpen,
    Users, Database, Shield, ListBullets, GameController,
    ChartBar, Tag, Hash, Wallet,
} from '@phosphor-icons/react'

export interface NavItem {
    to: string
    labelKey: string
    icon: PhosphorIcon
    requiresAuth?: boolean
}

export interface NavGroup {
    labelKey: string
    icon: PhosphorIcon
    items: NavItem[]
}

export const publicNavItems: NavItem[] = [
    { to: '/dashboard', labelKey: 'nav.dashboard', icon: House },
    { to: '/seasons', labelKey: 'nav.seasons', icon: Trophy },
    { to: '/user-stats', labelKey: 'nav.playerStats', icon: ChartLine },
    { to: '/betting', labelKey: 'nav.betting', icon: Target, requiresAuth: true },
    { to: '/earnings', labelKey: 'nav.finances', icon: CurrencyDollar },
    { to: '/rules', labelKey: 'nav.rules', icon: BookOpen },
]

export const adminTopNavItems: NavItem[] = [
    { to: '/admin/users', labelKey: 'nav.users', icon: Users },
    { to: '/admin/finance', labelKey: 'nav.finance', icon: Wallet },
]

export const adminNavGroups: NavGroup[] = [
    {
        labelKey: 'nav.groupGameData',
        icon: Database,
        items: [
            { to: '/admin/seasons', labelKey: 'nav.adminSeasons', icon: Trophy },
            { to: '/admin/teams', labelKey: 'nav.teams', icon: Shield },
            { to: '/admin/roster', labelKey: 'nav.roster', icon: ListBullets },
            { to: '/admin/matches', labelKey: 'nav.matches', icon: GameController },
        ],
    },
    {
        labelKey: 'nav.groupPoints',
        icon: ChartBar,
        items: [
            { to: '/admin/aggregated-points', labelKey: 'nav.aggregatedPoints', icon: ChartBar },
            { to: '/admin/point-reasons', labelKey: 'nav.pointReasons', icon: Tag },
            { to: '/admin/points', labelKey: 'nav.pointsManagement', icon: Hash },
        ],
    },
]
