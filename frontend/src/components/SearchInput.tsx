import { useTranslation } from 'react-i18next'

interface SearchInputProps {
    value: string
    onChange: (value: string) => void
    placeholder?: string
    className?: string
}

export default function SearchInput({
    value,
    onChange,
    placeholder,
    className = '',
}: SearchInputProps) {
    const { t } = useTranslation()

    return (
        <div className={`relative ${className}`}>
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm pointer-events-none">
                🔍
            </span>
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder ?? t('common.search')}
                className="input pl-9 pr-8 py-1.5 text-sm"
                aria-label={t('common.search')}
            />
            {value && (
                <button
                    onClick={() => onChange('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text text-sm"
                    aria-label={t('common.clear')}
                >
                    ✕
                </button>
            )}
        </div>
    )
}
