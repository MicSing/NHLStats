import { useTheme } from '../../context/ThemeContext'

/** Provides theme-aware colors for Recharts components. */
export function useChartTheme() {
    const { theme } = useTheme()
    const isDark = theme === 'dark'

    return {
        grid: isDark ? 'rgba(51, 65, 85, 0.4)' : '#E5E7EB',
        tick: isDark ? '#94A3B8' : '#4B5563',
        tooltipBg: isDark ? '#0F172A' : '#FFFFFF',
        tooltipBorder: isDark ? '#334155' : '#E5E7EB',
        tooltipText: isDark ? '#F8FAFC' : '#1A202C',
        legendText: isDark ? '#94A3B8' : '#4B5563',
        pieLabelText: isDark ? '#F8FAFC' : '#1A202C',
    }
}
