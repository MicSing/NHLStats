import { useTranslation } from 'react-i18next'

/** Ring colours the Collector can look for; keep in sync with PositionColorService and collector/rings.py. */
export const RING_COLORS: Record<string, string> = {
    red: '#e5484d', orange: '#f76b15', yellow: '#ffe629', green: '#30a46c', cyan: '#00c2d7', blue: '#3e63dd', pink: '#d6409f',
}

export function useColorName() {
    const { t } = useTranslation()
    return (color: string | null | undefined) => (color ? (color in RING_COLORS ? t(`colors.${color}`) : color) : t('colors.none'))
}
