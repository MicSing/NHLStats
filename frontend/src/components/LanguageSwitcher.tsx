import { useTranslation } from 'react-i18next'

const LANGUAGES = [
    { code: 'en', flag: '🇬🇧', label: 'EN' },
    { code: 'sk', flag: '🇸🇰', label: 'SK' },
]

export default function LanguageSwitcher() {
    const { i18n } = useTranslation()

    return (
        <div className="flex items-center gap-1">
            {LANGUAGES.map((lang) => (
                <button
                    key={lang.code}
                    onClick={() => void i18n.changeLanguage(lang.code)}
                    className={`px-2 py-1 rounded text-xs font-medium transition-colors ${i18n.language === lang.code
                            ? 'bg-primary text-white'
                            : 'text-text-muted hover:bg-border hover:text-text'
                        }`}
                    title={lang.label}
                >
                    {lang.flag} {lang.label}
                </button>
            ))}
        </div>
    )
}
