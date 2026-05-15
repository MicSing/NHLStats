import type { Icon as PhosphorIcon } from '@phosphor-icons/react'
import {
    House, Trophy, ChartLine, Target, CurrencyDollar, BookOpen,
    Users, ShieldIcon,
    TagIcon, Wallet,
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
    { to: '/admin/seasons', labelKey: 'nav.adminSeasons', icon: Trophy },
    { to: '/admin/point-reasons', labelKey: 'nav.pointReasons', icon: TagIcon },
    { to: '/admin/teams', labelKey: 'nav.teams', icon: ShieldIcon },
]

export const adminNavGroups: NavGroup[] = []
