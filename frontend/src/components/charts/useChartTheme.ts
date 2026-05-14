import { useTheme } from '../../context/ThemeContext'

/** Provides theme-aware colors and responsive margins for Recharts components. */
export function useChartTheme() {
    const { theme } = useTheme()
    const isDark = theme === 'dark'
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 640

    return {
        grid: isDark ? 'rgba(51, 65, 85, 0.4)' : '#E5E7EB',
        tick: isDark ? '#94A3B8' : '#4B5563',
        tooltipBg: isDark ? '#0F172A' : '#FFFFFF',
        tooltipBorder: isDark ? '#334155' : '#E5E7EB',
        tooltipText: isDark ? '#F8FAFC' : '#1A202C',
        legendText: isDark ? '#94A3B8' : '#4B5563',
        pieLabelText: isDark ? '#F8FAFC' : '#1A202C',
        margin: isMobile
            ? { top: 6, right: 8, left: 0, bottom: 4 }
            : { top: 10, right: 30, left: 0, bottom: 5 },
        yAxisWidthNarrow: isMobile ? 24 : 32,
    }
}
