import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useToast } from '../../context/ToastContext'
import { bettingService } from '../../services/bettingService'
import type { BetDto } from '../../types/bet'
import ArchiveTable from './ArchiveTable'

interface ArchiveTabProps {
    refreshKey?: number
}

export default function ArchiveTab({ refreshKey }: ArchiveTabProps) {
    const { t } = useTranslation()
    const { error } = useToast()
    const [historyBets, setHistoryBets] = useState<BetDto[] | null>(null)

    useEffect(() => {
        const load = async () => {
            try {
                const items = await bettingService.listHistory()
                setHistoryBets(items)
            } catch {
                error(t('betting.loadError'))
            }
        }
        void load()
    }, [error, t])

    useEffect(() => {
        if (!refreshKey) return
        bettingService.listHistory().then(setHistoryBets).catch(() => { /* silent */ })
    }, [refreshKey])

    return <ArchiveTable bets={historyBets} />
}
