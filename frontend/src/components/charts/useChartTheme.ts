import { useTheme } from '../../context/ThemeContext'

/** Provides theme-aware colors for Recharts components. */
export function useChartTheme() {
    const { theme } = useTheme()
    const isDark = theme === 'dark'

    return {
        grid: isDark ? '#374151' : '#D1D5DB',
        tick: isDark ? '#9ca3af' : '#4B5563',
        tooltipBg: isDark ? '#1f2937' : '#FFFFFF',
        tooltipBorder: isDark ? '#374151' : '#E5E7EB',
        tooltipText: isDark ? '#fff' : '#1A202C',
        legendText: isDark ? '#9ca3af' : '#4B5563',
        pieLabelText: isDark ? '#fff' : '#1A202C',
    }
}
