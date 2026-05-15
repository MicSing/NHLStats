import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Modal from '../Modal'
import { useToast } from '../../context/ToastContext'
import type { CreateLoginDto } from '../../types/loginManagement'

interface AddIdentityModalProps {
    onClose: () => void
    onSubmit: (dto: Omit<CreateLoginDto, 'userId'>) => Promise<void>
}

export default function AddIdentityModal({ onClose, onSubmit }: AddIdentityModalProps) {
    const { t } = useTranslation()
    const toast = useToast()
    const [email, setEmail] = useState('')
    const [alias, setAlias] = useState('')
    const [password, setPassword] = useState('')
    const [isLoading, setIsLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        const trimmedEmail = email.trim()
        const trimmedAlias = alias.trim()
        if (!trimmedEmail && !trimmedAlias) {
            toast.error(t('errors.allFieldsRequired'))
            return
        }
        setIsLoading(true)
        try {
            await onSubmit({
                email: trimmedEmail || undefined,
                alias: trimmedAlias || undefined,
                password,
            })
            onClose()
        } catch (err) {
            toast.error(err instanceof Error ? err.message : t('toast.operationFailed'))
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Modal title="Pridať prístupovú identitu" onClose={onClose}>
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
                <div>
                    <label className="label">{t('login.email')}</label>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder={t('login.emailPlaceholder')}
                        className="input"
                    />
                </div>
                <div>
                    <label className="label">{t('login.alias')}</label>
                    <input
                        type="text"
                        value={alias}
                        onChange={(e) => setAlias(e.target.value)}
                        placeholder={t('login.aliasPlaceholder')}
                        className="input"
                    />
                    <p className="text-xs text-text-muted mt-1">Email alebo alias je povinný.</p>
                </div>
                <div>
                    <label className="label">{t('login.password')}</label>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="input"
                    />
                </div>
                <div className="flex gap-2 justify-end pt-2">
                    <button type="button" onClick={onClose} className="btn-ghost text-sm">
                        {t('common.cancel')}
                    </button>
                    <button type="submit" disabled={isLoading} className="btn-primary text-sm">
                        {isLoading ? t('common.creating') : t('common.create')}
                    </button>
                </div>
            </form>
        </Modal>
    )
}
