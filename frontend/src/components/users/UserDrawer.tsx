import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import type { LoginUser, CreateLoginDto } from '../../types/loginManagement'
import type { MergedUser } from './userTypes'
import StatusBadge from '../StatusBadge'
import UserAvatar from './UserAvatar'
import { XIcon } from '@phosphor-icons/react'
import LoginCard from './LoginCard'
import AddIdentityModal from './AddIdentityModal'
import ChangePasswordModal from './ChangePasswordModal'

interface UserDrawerProps {
    user: MergedUser
    onClose: () => void
    onAddIdentity: (dto: CreateLoginDto) => Promise<void>
    onChangePassword: (loginId: string, password: string) => Promise<void>
    onDeleteLogin: (loginId: string) => Promise<void>
    onSaveRoles: (login: LoginUser, roles: string[]) => Promise<void>
    onDeactivate: (user: MergedUser) => Promise<void>
}

export default function UserDrawer({
    user,
    onClose,
    onAddIdentity,
    onChangePassword,
    onDeleteLogin,
    onSaveRoles,
    onDeactivate,
}: UserDrawerProps) {
    const { t } = useTranslation()

    const [editedRolesById, setEditedRolesById] = useState<Record<string, string[]>>(
        () => Object.fromEntries(user.logins.map((l) => [l.id, l.roles])),
    )
    const [roleSavingById, setRoleSavingById] = useState<Record<string, boolean>>({})
    const [showAddIdentityModal, setShowAddIdentityModal] = useState(false)
    const [showChangePasswordModal, setShowChangePasswordModal] = useState(false)
    const [changePasswordLoginId, setChangePasswordLoginId] = useState<string | null>(null)

    useEffect(() => {
        setEditedRolesById(Object.fromEntries(user.logins.map((l) => [l.id, l.roles])))
    }, [user.id])

    const handleSaveRolesForLogin = async (login: LoginUser) => {
        const roles = editedRolesById[login.id] ?? login.roles
        setRoleSavingById((prev) => ({ ...prev, [login.id]: true }))
        try {
            await onSaveRoles(login, roles)
        } finally {
            setRoleSavingById((prev) => ({ ...prev, [login.id]: false }))
        }
    }

    const openChangePassword = (loginId: string) => {
        setChangePasswordLoginId(loginId)
        setShowChangePasswordModal(true)
    }

    const handleChangePasswordSubmit = async (password: string) => {
        await onChangePassword(changePasswordLoginId!, password)
        setShowChangePasswordModal(false)
        setChangePasswordLoginId(null)
    }

    const handleAddIdentitySubmit = async (dto: Omit<CreateLoginDto, 'userId'>) => {
        await onAddIdentity({ ...dto, userId: user.id })
    }

    return (
        <>
            <div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30"
                onClick={onClose}
            />
            <div className="fixed inset-y-0 right-0 w-full max-w-md bg-surface border-l border-border z-40 shadow-2xl flex flex-col">
                <div className="p-6 border-b border-border/50 flex items-start justify-between flex-shrink-0">
                    <div className="flex items-center gap-4">
                        <UserAvatar name={user.name} size="lg" />
                        <div>
                            <h2 className="text-xl font-medium text-text">{user.name}</h2>
                            <div className="mt-1">
                                <StatusBadge variant={user.isActive ? 'success' : 'muted'}>
                                    {user.isActive ? t('common.active') : t('common.inactive')}
                                </StatusBadge>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-text-muted hover:text-text hover:bg-border/50 p-2 rounded-lg transition-colors"
                    >
                        <XIcon size={20} />
                    </button>
                </div>

                <div className="p-6 flex-1 overflow-y-auto">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-text">
                            Prístupové identity (Loginy)
                        </h3>
                        <button
                            onClick={() => setShowAddIdentityModal(true)}
                            className="text-xs font-medium text-primary hover:text-primary-hover transition-colors"
                        >
                            + Pridať identitu
                        </button>
                    </div>

                    {user.logins.length === 0 ? (
                        <div className="text-center py-8 border border-dashed border-border rounded-xl">
                            <p className="text-sm text-text-muted/70">
                                Tento používateľ nemá vytvorený žiadny login.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {user.logins.map((login) => (
                                <LoginCard
                                    key={login.id}
                                    login={login}
                                    editedRoles={editedRolesById[login.id] ?? login.roles}
                                    isSaving={roleSavingById[login.id] ?? false}
                                    onRolesChange={(roles) =>
                                        setEditedRolesById((prev) => ({ ...prev, [login.id]: roles }))
                                    }
                                    onSaveRoles={() => void handleSaveRolesForLogin(login)}
                                    onChangePassword={() => openChangePassword(login.id)}
                                    onDelete={() => void onDeleteLogin(login.id)}
                                />
                            ))}
                        </div>
                    )}

                    <div className="mt-12 pt-6 border-t border-border/50">
                        <h3 className="text-sm font-semibold text-danger mb-2">Nebezpečná zóna</h3>
                        <p className="text-xs text-text-muted/70 mb-4">
                            Akcie vykonané tu sú trvalé a ovplyvnia prístup používateľa do systému.
                        </p>
                        {user.isActive ? (
                            <button
                                onClick={() => void onDeactivate(user)}
                                className="w-full bg-danger/10 hover:bg-danger/20 text-danger text-sm font-medium py-2.5 px-4 rounded-lg transition-colors ring-1 ring-inset ring-danger/20"
                            >
                                {t('common.deactivate')} používateľa
                            </button>
                        ) : (
                            <p className="text-xs text-text-muted/50 italic">
                                Používateľ je deaktivovaný.
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {showAddIdentityModal && (
                <AddIdentityModal
                    onClose={() => setShowAddIdentityModal(false)}
                    onSubmit={handleAddIdentitySubmit}
                />
            )}

            {showChangePasswordModal && (
                <ChangePasswordModal
                    onClose={() => {
                        setShowChangePasswordModal(false)
                        setChangePasswordLoginId(null)
                    }}
                    onSubmit={handleChangePasswordSubmit}
                />
            )}
        </>
    )
}
