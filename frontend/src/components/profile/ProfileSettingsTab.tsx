import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
    MoonIcon,
    SunIcon,
    LockKeyIcon,
    SignOutIcon,
    CheckCircleIcon,
    EyeIcon,
    EyeSlashIcon,
    WarningCircleIcon,
} from '@phosphor-icons/react'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { useToast } from '../../context/ToastContext'
import apiClient from '../../services/apiClient'
import LoadingSpinner from '../LoadingSpinner'
import Modal from '../Modal'

export default function ProfileSettingsTab() {
    const { t, i18n } = useTranslation()
    const { isAuthenticated, logout } = useAuth()
    const { theme, toggleTheme } = useTheme()
    const toast = useToast()
    const navigate = useNavigate()

    // Password change state
    const [currentPassword, setCurrentPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [showCurrentPassword, setShowCurrentPassword] = useState(false)
    const [showNewPassword, setShowNewPassword] = useState(false)
    const [loadingPassword, setLoadingPassword] = useState(false)
    const [passwordError, setPasswordError] = useState<string | null>(null)
    const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null)

    // Logout confirm modal state
    const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false)

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault()
        setPasswordError(null)
        setPasswordSuccess(null)

        if (!currentPassword || !newPassword || !confirmPassword) {
            setPasswordError(t('errors.allFieldsRequired') || 'All fields are required')
            return
        }

        if (newPassword !== confirmPassword) {
            setPasswordError(t('profile.settings.passwordsDoNotMatch'))
            return
        }

        if (newPassword.length < 6) {
            setPasswordError(t('profile.settings.newPasswordLength'))
            return
        }

        setLoadingPassword(true)
        try {
            await apiClient.post('/api/auth/change-password', {
                currentPassword,
                newPassword,
            })
            setPasswordSuccess(t('profile.settings.passwordChangedSuccess'))
            toast.success(t('profile.settings.passwordChangedSuccess'))
            setCurrentPassword('')
            setNewPassword('')
            setConfirmPassword('')
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Failed to change password'
            setPasswordError(msg)
            toast.error(msg)
        } finally {
            setLoadingPassword(false)
        }
    }

    const handleConfirmLogout = () => {
        setIsLogoutModalOpen(false)
        logout()
        navigate('/login')
    }

    return (
        <div className="space-y-6 max-w-3xl">
            {/* ─── Appearance (Theme) ──────────────────────────────────────── */}
            <div className="card p-5 border-border">
                <div className="mb-4">
                    <h3 className="text-base font-bold text-text">
                        {t('profile.settings.appearanceTitle')}
                    </h3>
                    <p className="text-xs text-text-muted mt-0.5">
                        {t('profile.settings.appearanceSubtitle')}
                    </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Dark Theme Button */}
                    <button
                        type="button"
                        onClick={() => {
                            if (theme !== 'dark') toggleTheme()
                        }}
                        className={`p-4 rounded-xl border text-left transition-all duration-200 flex items-start gap-3.5 relative cursor-pointer ${
                            theme === 'dark'
                                ? 'bg-primary/10 border-primary shadow-sm'
                                : 'bg-surface border-border hover:border-primary/50'
                        }`}
                    >
                        <div
                            className={`p-2 rounded-lg ${
                                theme === 'dark'
                                    ? 'bg-primary text-white'
                                    : 'bg-bg text-text-muted'
                            }`}
                        >
                            <MoonIcon size={20} weight="fill" />
                        </div>
                        <div className="flex-1 min-w-0 pr-6">
                            <p className="text-sm font-semibold text-text">
                                {t('profile.settings.themeDark')}
                            </p>
                            <p className="text-xs text-text-muted mt-0.5">
                                {t('profile.settings.themeDarkDesc')}
                            </p>
                        </div>
                        {theme === 'dark' && (
                            <CheckCircleIcon
                                size={20}
                                weight="fill"
                                className="text-primary absolute top-4 right-4"
                            />
                        )}
                    </button>

                    {/* Light Theme Button */}
                    <button
                        type="button"
                        onClick={() => {
                            if (theme !== 'light') toggleTheme()
                        }}
                        className={`p-4 rounded-xl border text-left transition-all duration-200 flex items-start gap-3.5 relative cursor-pointer ${
                            theme === 'light'
                                ? 'bg-primary/10 border-primary shadow-sm'
                                : 'bg-surface border-border hover:border-primary/50'
                        }`}
                    >
                        <div
                            className={`p-2 rounded-lg ${
                                theme === 'light'
                                    ? 'bg-primary text-white'
                                    : 'bg-bg text-text-muted'
                            }`}
                        >
                            <SunIcon size={20} weight="fill" />
                        </div>
                        <div className="flex-1 min-w-0 pr-6">
                            <p className="text-sm font-semibold text-text">
                                {t('profile.settings.themeLight')}
                            </p>
                            <p className="text-xs text-text-muted mt-0.5">
                                {t('profile.settings.themeLightDesc')}
                            </p>
                        </div>
                        {theme === 'light' && (
                            <CheckCircleIcon
                                size={20}
                                weight="fill"
                                className="text-primary absolute top-4 right-4"
                            />
                        )}
                    </button>
                </div>
            </div>

            {/* ─── Language ───────────────────────────────────────────────── */}
            <div className="card p-5 border-border">
                <div className="mb-4">
                    <h3 className="text-base font-bold text-text">
                        {t('profile.settings.languageTitle')}
                    </h3>
                    <p className="text-xs text-text-muted mt-0.5">
                        {t('profile.settings.languageSubtitle')}
                    </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                        type="button"
                        onClick={() => void i18n.changeLanguage('sk')}
                        className={`p-4 rounded-xl border text-left transition-all duration-200 flex items-center gap-3.5 relative cursor-pointer ${
                            i18n.language.startsWith('sk')
                                ? 'bg-primary/10 border-primary shadow-sm'
                                : 'bg-surface border-border hover:border-primary/50'
                        }`}
                    >
                        <span className="text-2xl">🇸🇰</span>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-text">Slovenčina</p>
                            <p className="text-xs text-text-muted">Slovenský jazyk</p>
                        </div>
                        {i18n.language.startsWith('sk') && (
                            <CheckCircleIcon
                                size={20}
                                weight="fill"
                                className="text-primary absolute top-4 right-4"
                            />
                        )}
                    </button>

                    <button
                        type="button"
                        onClick={() => void i18n.changeLanguage('en')}
                        className={`p-4 rounded-xl border text-left transition-all duration-200 flex items-center gap-3.5 relative cursor-pointer ${
                            i18n.language.startsWith('en')
                                ? 'bg-primary/10 border-primary shadow-sm'
                                : 'bg-surface border-border hover:border-primary/50'
                        }`}
                    >
                        <span className="text-2xl">🇬🇧</span>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-text">English</p>
                            <p className="text-xs text-text-muted">English language</p>
                        </div>
                        {i18n.language.startsWith('en') && (
                            <CheckCircleIcon
                                size={20}
                                weight="fill"
                                className="text-primary absolute top-4 right-4"
                            />
                        )}
                    </button>
                </div>
            </div>

            {/* ─── Change Password & Session (Authenticated Only) ─────── */}
            {isAuthenticated ? (
                <>
                    <div className="card p-5 border-border">
                        <div className="mb-4">
                            <div className="flex items-center gap-2">
                                <LockKeyIcon size={18} className="text-primary" />
                                <h3 className="text-base font-bold text-text">
                                    {t('profile.settings.securityTitle')}
                                </h3>
                            </div>
                            <p className="text-xs text-text-muted mt-0.5">
                                {t('profile.settings.securitySubtitle')}
                            </p>
                        </div>

                        {passwordSuccess && (
                            <div className="p-3 mb-4 rounded-lg bg-success/20 border border-success/40 text-success text-xs flex items-center gap-2">
                                <CheckCircleIcon size={16} weight="fill" className="shrink-0" />
                                <span>{passwordSuccess}</span>
                            </div>
                        )}

                        {passwordError && (
                            <div className="p-3 mb-4 rounded-lg bg-danger/20 border border-danger/40 text-danger text-xs flex items-center gap-2">
                                <WarningCircleIcon size={16} weight="fill" className="shrink-0" />
                                <span>{passwordError}</span>
                            </div>
                        )}

                        <form onSubmit={handlePasswordChange} className="space-y-4">
                            <div>
                                <label className="label text-xs">
                                    {t('changePassword.currentPassword')}
                                </label>
                                <div className="relative">
                                    <input
                                        type={showCurrentPassword ? 'text' : 'password'}
                                        value={currentPassword}
                                        onChange={(e) => setCurrentPassword(e.target.value)}
                                        required
                                        disabled={loadingPassword}
                                        className="input pr-10 text-xs sm:text-sm"
                                        placeholder="••••••••"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowCurrentPassword((prev) => !prev)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text transition-colors"
                                    >
                                        {showCurrentPassword ? <EyeSlashIcon size={16} /> : <EyeIcon size={16} />}
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="label text-xs">
                                        {t('changePassword.newPassword')}
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={showNewPassword ? 'text' : 'password'}
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            required
                                            disabled={loadingPassword}
                                            className="input pr-10 text-xs sm:text-sm"
                                            placeholder="••••••••"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowNewPassword((prev) => !prev)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text transition-colors"
                                        >
                                            {showNewPassword ? <EyeSlashIcon size={16} /> : <EyeIcon size={16} />}
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="label text-xs">
                                        {t('changePassword.confirmPassword')}
                                    </label>
                                    <input
                                        type={showNewPassword ? 'text' : 'password'}
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        required
                                        disabled={loadingPassword}
                                        className="input text-xs sm:text-sm"
                                        placeholder="••••••••"
                                    />
                                </div>
                            </div>

                            <div className="pt-2">
                                <button
                                    type="submit"
                                    disabled={loadingPassword}
                                    className="btn-primary text-xs sm:text-sm flex items-center gap-2"
                                >
                                    {loadingPassword && <LoadingSpinner size="sm" />}
                                    <span>{t('changePassword.title')}</span>
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* ─── Session / Logout ────────────────────────────────────────── */}
                    <div className="card p-5 border-border">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                                <h3 className="text-base font-bold text-text">
                                    {t('profile.settings.sessionTitle')}
                                </h3>
                                <p className="text-xs text-text-muted mt-0.5">
                                    {t('profile.settings.sessionSubtitle')}
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() => setIsLogoutModalOpen(true)}
                                className="btn-danger text-xs sm:text-sm flex items-center gap-2 self-start sm:self-center"
                            >
                                <SignOutIcon size={16} />
                                <span>{t('profile.settings.logoutButton')}</span>
                            </button>
                        </div>
                    </div>
                </>
            ) : (
                <div className="card p-5 border-border bg-surface/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h3 className="text-base font-bold text-text">
                            {t('profile.settings.loginPromptTitle')}
                        </h3>
                        <p className="text-xs text-text-muted mt-0.5">
                            {t('profile.settings.loginPromptSubtitle')}
                        </p>
                    </div>

                    <Link
                        to="/login"
                        className="btn-primary text-xs sm:text-sm self-start sm:self-center shrink-0"
                    >
                        {t('layout.signIn')}
                    </Link>
                </div>
            )}

            {/* Logout Confirm Modal */}
            {isLogoutModalOpen && (
                <Modal
                    title={t('profile.settings.confirmLogoutTitle')}
                    onClose={() => setIsLogoutModalOpen(false)}
                >
                    <div className="space-y-4">
                        <p className="text-sm text-text">
                            {t('profile.settings.confirmLogoutText')}
                        </p>
                        <div className="flex items-center justify-end gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setIsLogoutModalOpen(false)}
                                className="btn-ghost text-xs sm:text-sm"
                            >
                                {t('common.cancel')}
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmLogout}
                                className="btn-danger text-xs sm:text-sm"
                            >
                                {t('layout.logout')}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    )
}
