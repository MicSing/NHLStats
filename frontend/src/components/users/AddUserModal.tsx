import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Modal from '../Modal'

interface AddUserModalProps {
    onClose: () => void
    onSubmit: (name: string) => Promise<void>
}

export default function AddUserModal({ onClose, onSubmit }: AddUserModalProps) {
    const { t } = useTranslation()
    const [name, setName] = useState('')

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        await onSubmit(name)
        onClose()
    }

    return (
        <Modal title={t('admin.users.addUser')} onClose={onClose}>
            <form onSubmit={(e) => void handleSubmit(e)}>
                <label htmlFor="add-user-name" className="label">
                    {t('common.name')}
                </label>
                <input
                    id="add-user-name"
                    className="input mb-4"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                />
                <div className="flex gap-2 justify-end">
                    <button type="button" onClick={onClose} className="btn-ghost text-sm">
                        {t('common.cancel')}
                    </button>
                    <button type="submit" className="btn-primary text-sm">
                        {t('common.save')}
                    </button>
                </div>
            </form>
        </Modal>
    )
}
