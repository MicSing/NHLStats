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
        <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
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

            <div className="overflow-x-auto rounded-xl border border-border overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-surface">
                        <tr className="text-left text-text-muted uppercase text-xs tracking-wider">
                            <th className="px-4 py-3 font-medium">Používateľ</th>
                            <th className="px-4 py-3 font-medium">Prístupové metódy</th>
                            <th className="px-4 py-3 font-medium w-32">{t('common.status')}</th>
                            <th className="px-4 py-3 font-medium w-12"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {filteredUsers.map((user) => (
                            <tr
                                key={user.id}
                                onClick={() => onSelectUser(user.id)}
                                className="hover:bg-surface/50 transition-colors cursor-pointer group"
                            >
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-3">
                                        <UserAvatar name={user.name} size="sm" />
                                        <span className="font-medium text-text group-hover:text-primary transition-colors">
                                            {user.name}
                                        </span>
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    {user.logins.length > 0 ? (
                                        <div className="flex flex-col gap-1">
                                            <span className="text-text-muted flex items-center gap-1.5">
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
                                        <span className="text-text-muted/50 italic">
                                            Zatiaľ bez loginu
                                        </span>
                                    )}
                                </td>
                                <td className="px-4 py-3">
                                    <StatusBadge variant={user.isActive ? 'success' : 'muted'}>
                                        {user.isActive ? t('common.active') : t('common.inactive')}
                                    </StatusBadge>
                                </td>
                                <td className="px-4 py-3 text-right text-text-muted/40 group-hover:text-text-muted transition-colors">
                                    <ChevronRightIcon />
                                </td>
                            </tr>
                        ))}
                        {filteredUsers.length === 0 && (
                            <tr>
                                <td
                                    colSpan={4}
                                    className="px-6 py-12 text-center text-text-muted/60 italic"
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
