import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Modal from './Modal'

export interface ColumnDef {
    key: string
    label: string
    defaultSelected?: boolean
    required?: boolean
}

interface CsvColumnSelectorModalProps {
    title: string
    columns: ColumnDef[]
    onConfirm: (selectedKeys: string[]) => void
    onClose: () => void
    confirmLabel?: string
}

export default function CsvColumnSelectorModal({
    title,
    columns,
    onConfirm,
    onClose,
    confirmLabel,
}: CsvColumnSelectorModalProps) {
    const { t } = useTranslation()
    const [selected, setSelected] = useState<Set<string>>(
        () => new Set(columns.filter((c) => c.defaultSelected !== false).map((c) => c.key)),
    )

    const toggle = (key: string) => {
        if (columns.find((c) => c.key === key)?.required) return
        setSelected((prev) => {
            const next = new Set(prev)
            if (next.has(key)) { next.delete(key) } else { next.add(key) }
            return next
        })
    }

    const selectAll = () => setSelected(new Set(columns.map((c) => c.key)))
    const deselectAll = () => setSelected(new Set(columns.filter((c) => c.required).map((c) => c.key)))

    return (
        <Modal title={title} onClose={onClose}>
            <div className="space-y-4">
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={selectAll}
                        className="text-sm text-primary hover:underline"
                    >
                        {t('csvExport.selectAll')}
                    </button>
                    <span className="text-text-muted">·</span>
                    <button
                        type="button"
                        onClick={deselectAll}
                        className="text-sm text-primary hover:underline"
                    >
                        {t('csvExport.deselectAll')}
                    </button>
                </div>

                <ul className="space-y-2">
                    {columns.map((col) => (
                        <li key={col.key}>
                            <label className={`flex items-center gap-3 select-none ${col.required ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
                                <input
                                    type="checkbox"
                                    checked={selected.has(col.key)}
                                    onChange={() => toggle(col.key)}
                                    disabled={col.required}
                                    className="w-4 h-4 accent-primary"
                                />
                                <span className="text-sm text-text">{col.label}</span>
                            </label>
                        </li>
                    ))}
                </ul>

                {selected.size === 0 && (
                    <p className="text-sm text-text-muted">{t('csvExport.noColumnsSelected')}</p>
                )}

                <div className="flex justify-end gap-2 pt-2 border-t border-border">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm rounded-md border border-border text-text hover:bg-surface transition-colors"
                    >
                        {t('common.cancel')}
                    </button>
                    <button
                        type="button"
                        onClick={() => onConfirm(Array.from(selected))}
                        disabled={selected.size === 0}
                        className="px-4 py-2 text-sm rounded-md bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        {confirmLabel ?? t('csvExport.confirm')}
                    </button>
                </div>
            </div>
        </Modal>
    )
}
