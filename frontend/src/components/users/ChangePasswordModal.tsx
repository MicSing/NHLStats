import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Modal from '../Modal'
import { useToast } from '../../context/ToastContext'

interface ChangePasswordModalProps {
    onClose: () => void
    onSubmit: (password: string) => Promise<void>
}

export default function ChangePasswordModal({ onClose, onSubmit }: ChangePasswordModalProps) {
    const { t } = useTranslation()
    const toast = useToast()
    const [password, setPassword] = useState('')
    const [isLoading, setIsLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (password.length < 6) {
            toast.error('Heslo musí mať aspoň 6 znakov')
            return
        }
        setIsLoading(true)
        try {
            await onSubmit(password)
            onClose()
        } catch (err) {
            toast.error(err instanceof Error ? err.message : t('toast.operationFailed'))
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Modal title={t('common.changePassword')} onClose={onClose}>
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
                <div>
                    <label className="label">{t('changePassword.newPassword')}</label>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        placeholder="min. 6 znakov"
                        className="input"
                    />
                </div>
                <div className="flex gap-2 justify-end">
                    <button type="button" onClick={onClose} className="btn-ghost text-sm">
                        {t('common.cancel')}
                    </button>
                    <button type="submit" disabled={isLoading} className="btn-primary text-sm">
                        {isLoading ? t('common.saving') : t('common.save')}
                    </button>
                </div>
            </form>
        </Modal>
    )
}
