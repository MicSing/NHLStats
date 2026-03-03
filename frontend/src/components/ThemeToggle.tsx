import { useTheme } from '../context/ThemeContext'

export default function ThemeToggle() {
    const { theme, toggleTheme } = useTheme()
    const isDark = theme === 'dark'

    return (
        <button
            onClick={toggleTheme}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-text-muted hover:bg-border hover:text-text transition-colors"
        >
            {/* Track */}
            <span className="relative inline-flex items-center w-9 h-5 shrink-0">
                <span
                    className={`absolute inset-0 rounded-full transition-colors duration-200 ${isDark ? 'bg-border' : 'bg-primary'
                        }`}
                />
                <span
                    className={`relative w-3.5 h-3.5 rounded-full bg-white shadow transition-transform duration-200 ${isDark ? 'translate-x-0.5' : 'translate-x-[18px]'
                        }`}
                />
            </span>
            <span className="select-none">
                {isDark ? '🌙 Dark' : '☀️ Light'}
            </span>
        </button>
    )
}
