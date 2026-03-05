import { useTranslation } from 'react-i18next'

interface LoadingSpinnerProps {
    /** Optional message below the spinner */
    message?: string
    /** Size variant */
    size?: 'sm' | 'md' | 'lg'
    /** If true, renders inline instead of full-page centered */
    inline?: boolean
}

const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
}

export default function LoadingSpinner({
    message,
    size = 'md',
    inline = false,
}: LoadingSpinnerProps) {
    const { t } = useTranslation()
    const label = message ?? t('common.loading')

    const spinner = (
        <div className={`flex ${inline ? 'inline-flex' : ''} flex-col items-center gap-3`}>
            <svg
                className={`animate-spin ${sizeClasses[size]} text-primary`}
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
            >
                <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                />
                <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
            </svg>
            {label && <p className="text-sm text-text-muted">{label}</p>}
        </div>
    )

    if (inline) return spinner

    return (
        <div className="flex items-center justify-center py-12" role="status" aria-label={label}>
            {spinner}
        </div>
    )
}
