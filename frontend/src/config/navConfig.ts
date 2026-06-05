import type { Icon as PhosphorIcon } from '@phosphor-icons/react'
import {
    HouseIcon, TrophyIcon, ChartLineIcon, TargetIcon, CurrencyDollarIcon, BookOpenIcon,
    UsersIcon, ShieldIcon,
    TagIcon, WalletIcon,
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
    { to: '/dashboard', labelKey: 'nav.dashboard', icon: HouseIcon },
    { to: '/seasons', labelKey: 'nav.seasons', icon: TrophyIcon },
    { to: '/user-stats', labelKey: 'nav.playerStats', icon: ChartLineIcon },
    { to: '/betting', labelKey: 'nav.betting', icon: TargetIcon },
    { to: '/earnings', labelKey: 'nav.finances', icon: CurrencyDollarIcon },
    { to: '/rules', labelKey: 'nav.rules', icon: BookOpenIcon },
]

export const adminTopNavItems: NavItem[] = [
    { to: '/admin/users', labelKey: 'nav.users', icon: UsersIcon },
    { to: '/admin/finance', labelKey: 'nav.finance', icon: WalletIcon },
    { to: '/admin/seasons', labelKey: 'nav.adminSeasons', icon: TrophyIcon },
    { to: '/admin/point-reasons', labelKey: 'nav.pointReasons', icon: TagIcon },
    { to: '/admin/teams', labelKey: 'nav.teams', icon: ShieldIcon },
]

export const adminNavGroups: NavGroup[] = []
