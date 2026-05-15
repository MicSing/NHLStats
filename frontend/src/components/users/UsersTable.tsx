import { useTranslation } from 'react-i18next'
import type { MergedUser } from './userTypes'
import StatusBadge from '../StatusBadge'
import UserAvatar from './UserAvatar'
import { SearchIcon, UserPlusIcon, ChevronRightIcon, MailIcon, AliasIcon } from './userIcons'

interface UsersTableProps {
    filteredUsers: MergedUser[]
    search: string
    onSearchChange: (value: string) => void
    onSelectUser: (userId: number) => void
    onAddUser: () => void
}

export default function UsersTable({
    filteredUsers,
    search,
    onSearchChange,
    onSelectUser,
    onAddUser,
}: UsersTableProps) {
    const { t } = useTranslation()

    return (
        <div className="bg-surface rounded-2xl border border-border shadow-xl overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-border/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="relative w-full sm:max-w-xs">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-text-muted">
                        <SearchIcon />
                    </div>
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => onSearchChange(e.target.value)}
                        placeholder="Hľadať používateľa alebo email..."
                        className="w-full bg-bg border border-border rounded-lg text-sm text-text pl-10 py-2.5 pr-3 focus:outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-text-muted/50 transition-all"
                    />
                </div>
                <button
                    onClick={onAddUser}
                    className="btn-primary flex items-center gap-2 w-full sm:w-auto justify-center"
                >
                    <UserPlusIcon />
                    {t('admin.users.addUser')}
                </button>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse whitespace-nowrap">
                    <thead>
                        <tr className="border-b border-border/50">
                            <th className="table-header">Používateľ</th>
                            <th className="table-header">Prístupové metódy</th>
                            <th className="table-header w-32">{t('common.status')}</th>
                            <th className="table-header w-12"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                        {filteredUsers.map((user) => (
                            <tr
                                key={user.id}
                                onClick={() => onSelectUser(user.id)}
                                className="hover:bg-primary/5 transition-colors cursor-pointer group"
                            >
                                <td className="table-cell">
                                    <div className="flex items-center gap-3">
                                        <UserAvatar name={user.name} size="sm" />
                                        <span className="text-sm font-medium text-text group-hover:text-primary transition-colors">
                                            {user.name}
                                        </span>
                                    </div>
                                </td>
                                <td className="table-cell">
                                    {user.logins.length > 0 ? (
                                        <div className="flex flex-col gap-1">
                                            <span className="text-sm text-text-muted flex items-center gap-1.5">
                                                {user.logins[0].email ? <MailIcon /> : <AliasIcon />}
                                                {user.logins[0].email ?? user.logins[0].alias}
                                            </span>
                                            {user.logins.length > 1 && (
                                                <span className="text-[11px] text-text-muted/70 font-medium">
                                                    +{user.logins.length - 1} ďalší účet
                                                </span>
                                            )}
                                        </div>
                                    ) : (
                                        <span className="text-sm text-text-muted/50 italic">
                                            Zatiaľ bez loginu
                                        </span>
                                    )}
                                </td>
                                <td className="table-cell">
                                    <StatusBadge variant={user.isActive ? 'success' : 'muted'}>
                                        {user.isActive ? t('common.active') : t('common.inactive')}
                                    </StatusBadge>
                                </td>
                                <td className="table-cell text-right text-text-muted/40 group-hover:text-text-muted transition-colors">
                                    <ChevronRightIcon />
                                </td>
                            </tr>
                        ))}
                        {filteredUsers.length === 0 && (
                            <tr>
                                <td
                                    colSpan={4}
                                    className="px-6 py-12 text-center text-sm text-text-muted/60 italic"
                                >
                                    {search
                                        ? 'Žiadni používatelia nezodpovedajú vyhľadávaniu.'
                                        : 'Žiadni používatelia.'}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
