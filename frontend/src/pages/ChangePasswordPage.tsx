import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import apiClient from '../services/apiClient'
import { useToast } from '../context/ToastContext'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorMessage from '../components/ErrorMessage'

export default function ChangePasswordPage() {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const toast = useToast()
    const [currentPassword, setCurrentPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [successMessage, setSuccessMessage] = useState<string | null>(null)

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        setSuccessMessage(null)

        if (!currentPassword || !newPassword || !confirmPassword) {
            setError(t('errors.allFieldsRequired'))
            return
        }

        if (newPassword !== confirmPassword) {
            setError('New passwords do not match')
            return
        }

        if (newPassword.length < 6) {
            setError('New password must be at least 6 characters')
            return
        }

        setLoading(true)
        try {
            await apiClient.post('/api/auth/change-password', {
                currentPassword,
                newPassword,
            })
            setSuccessMessage('Password changed successfully')
            toast.success('Password changed successfully')
            setCurrentPassword('')
            setNewPassword('')
            setConfirmPassword('')
            // Redirect to dashboard after 2 seconds
            setTimeout(() => {
                navigate('/dashboard')
            }, 2000)
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Failed to change password'
            setError(errorMsg)
            toast.error(errorMsg)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-bg flex items-center justify-center p-4">
            <div className="max-w-md w-full card p-6">
                <h1 className="text-2xl font-bold mb-6 text-text">{t('changePassword.title') || 'Change Password'}</h1>

                {successMessage && (
                    <div className="bg-success/20 border border-success/50 text-success px-4 py-3 rounded mb-4">
                        {successMessage}
                    </div>
                )}

                {error && <ErrorMessage message={error} />}

                <form onSubmit={handleChangePassword} className="space-y-4">
                    <div>
                        <label className="label">
                            {t('changePassword.currentPassword') || 'Current Password'}
                        </label>
                        <input
                            type="password"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            required
                            disabled={loading}
                            className="input"
                            placeholder="Enter your current password"
                        />
                    </div>

                    <div>
                        <label className="label">
                            {t('changePassword.newPassword') || 'New Password'}
                        </label>
                        <input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            required
                            disabled={loading}
                            className="input"
                            placeholder="Enter a new password (min 6 characters)"
                        />
                    </div>

                    <div>
                        <label className="label">
                            {t('changePassword.confirmPassword') || 'Confirm New Password'}
                        </label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                            disabled={loading}
                            className="input"
                            placeholder="Confirm your new password"
                        />
                    </div>

                    <div className="flex gap-2 pt-4">
                        <button
                            type="submit"
                            disabled={loading}
                            className="btn-primary flex-1 flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <LoadingSpinner />
                                    {t('common.saving')}
                                </>
                            ) : (
                                t('common.save')
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={() => navigate('/dashboard')}
                            disabled={loading}
                            className="btn-ghost flex-1"
                        >
                            {t('common.cancel')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
