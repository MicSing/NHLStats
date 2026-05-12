import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'

function LoginPage() {
    const { login } = useAuth()
    const navigate = useNavigate()
    const { t } = useTranslation()
    const [identifier, setIdentifier] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setError(null)
        setLoading(true)
        try {
            await login({ identifier, password })
            navigate('/admin')
        } catch {
            setError(t('login.invalidCredentials'))
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-bg flex items-center justify-center px-4">
            <div className="w-full max-w-md card p-8 shadow-card">
                <div className="text-center mb-8">
                    <p className="text-4xl mb-2">🏒</p>
                    <h1 className="text-2xl font-bold text-primary">{t('login.title')}</h1>
                    <p className="text-sm text-text-muted mt-1">{t('login.subtitle')}</p>
                </div>
                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label htmlFor="identifier" className="label">{t('login.identifier')}</label>
                        <input
                            id="identifier"
                            type="text"
                            value={identifier}
                            onChange={(e) => setIdentifier(e.target.value)}
                            required
                            autoComplete="username"
                            placeholder={t('login.identifierPlaceholder')}
                            className="input"
                        />
                    </div>
                    <div>
                        <label htmlFor="password" className="label">{t('login.password')}</label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            autoComplete="current-password"
                            placeholder={t('login.passwordPlaceholder')}
                            className="input"
                        />
                    </div>
                    {error && (
                        <p role="alert" className="text-danger text-sm bg-danger/10 border border-danger/30 rounded-lg px-3 py-2">
                            {error}
                        </p>
                    )}
                    <button
                        type="submit"
                        disabled={loading}
                        className="btn-primary w-full py-2.5 mt-2"
                    >
                        {loading ? t('login.signingIn') : t('login.signIn')}
                    </button>
                </form>
            </div>
        </div>
    )
}

export default LoginPage
