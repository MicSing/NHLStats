import { useTranslation } from 'react-i18next'
import type { LoginUser } from '../../types/loginManagement'
import { MailIcon, AliasIcon, KeyIcon, TrashIcon } from './userIcons'

interface LoginCardProps {
    login: LoginUser
    editedRoles: string[]
    isSaving: boolean
    onRolesChange: (roles: string[]) => void
    onSaveRoles: () => void
    onChangePassword: () => void
    onDelete: () => void
}

export default function LoginCard({
    login,
    editedRoles,
    isSaving,
    onRolesChange,
    onSaveRoles,
    onChangePassword,
    onDelete,
}: LoginCardProps) {
    const { t } = useTranslation()
    const identifier = login.email ?? login.alias ?? '—'
    const isEmail = !!login.email
    const isAdminChecked = editedRoles.includes('Admin')
    const isDirty =
        JSON.stringify(editedRoles.slice().sort()) !==
        JSON.stringify(login.roles.slice().sort())

    return (
        <div className="bg-bg border border-border rounded-xl p-4">
            <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2 min-w-0">
                    <div className="p-1.5 bg-surface rounded-md text-text-muted flex-shrink-0">
                        {isEmail ? <MailIcon /> : <AliasIcon />}
                    </div>
                    <span className="text-sm font-medium text-text truncate">{identifier}</span>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                    <button
                        onClick={onChangePassword}
                        className="p-1.5 text-text-muted hover:text-text hover:bg-border/50 rounded-md transition-all"
                        title={t('common.changePassword')}
                    >
                        <KeyIcon />
                    </button>
                    <button
                        onClick={onDelete}
                        className="p-1.5 text-text-muted hover:text-rose-400 hover:bg-rose-500/10 rounded-md transition-all"
                        title={t('common.delete')}
                    >
                        <TrashIcon />
                    </button>
                </div>
            </div>

            <div className="pt-3 border-t border-border/50">
                <span className="text-[10px] text-text-muted uppercase tracking-wider font-semibold block mb-2">
                    Priradené roly
                </span>
                <div className="flex flex-wrap gap-1.5 mb-3">
                    {login.roles.map((role) => (
                        <span
                            key={role}
                            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium ring-1 ring-inset ${
                                role === 'Admin'
                                    ? 'bg-indigo-500/10 text-indigo-400 ring-indigo-500/20'
                                    : 'bg-border/50 text-text-muted ring-border'
                            }`}
                        >
                            {role}
                        </span>
                    ))}
                </div>
                <label className="flex items-center gap-2 text-xs text-text-muted cursor-pointer select-none">
                    <input
                        type="checkbox"
                        checked={isAdminChecked}
                        onChange={(e) =>
                            onRolesChange(e.target.checked ? ['Participient', 'Admin'] : ['Participient'])
                        }
                        className="accent-[var(--color-primary)]"
                    />
                    Admin
                </label>
                {isDirty && (
                    <button
                        onClick={onSaveRoles}
                        disabled={isSaving}
                        className="mt-2 text-xs text-primary hover:text-primary-hover disabled:opacity-50 font-medium transition-colors"
                    >
                        {isSaving ? t('common.saving') : t('common.save')}
                    </button>
                )}
            </div>
        </div>
    )
}
