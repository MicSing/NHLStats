import { useTranslation } from 'react-i18next'

interface ErrorMessageProps {
    /** The error message to display */
    message: string
    /** Optional retry callback — shows a retry button when provided */
    onRetry?: () => void
    /** Optional title above the message */
    title?: string
}

export default function ErrorMessage({ message, onRetry, title }: ErrorMessageProps) {
    const { t } = useTranslation()

    return (
        <div
            role="alert"
            className="flex flex-col items-center gap-3 py-12 px-4 text-center"
        >
            <div className="w-12 h-12 rounded-full bg-danger/10 flex items-center justify-center">
                <span className="text-danger text-xl">!</span>
            </div>
            {title && <h3 className="text-lg font-semibold text-text">{title}</h3>}
            <p className="text-sm text-text-muted max-w-md">{message}</p>
            {onRetry && (
                <button onClick={onRetry} className="btn-primary text-sm mt-2">
                    {t('common.retry')}
                </button>
            )}
        </div>
    )
}
