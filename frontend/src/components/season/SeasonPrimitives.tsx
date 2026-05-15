import type { ReactNode } from 'react'
import { PencilSimple, Trash } from '@phosphor-icons/react'

export function Tab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className={`py-4 px-1 border-b-2 text-sm font-medium transition-colors whitespace-nowrap ${
                active
                    ? 'border-primary text-primary'
                    : 'border-transparent text-text-muted hover:text-text hover:border-border'
            }`}
        >
            {label}
        </button>
    )
}

export function TableCard({ children }: { children: ReactNode }) {
    return (
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-sm">{children}</table>
            </div>
        </div>
    )
}

export function TableHead({ columns }: { columns: string[] }) {
    return (
        <thead>
            <tr className="text-left border-b border-border text-text-muted text-xs uppercase tracking-wider font-semibold bg-bg/50">
                {columns.map((col, i) => (
                    <th
                        key={col}
                        className={`p-4 ${i === columns.length - 1 ? 'text-right' : ''}`}
                    >
                        {col}
                    </th>
                ))}
            </tr>
        </thead>
    )
}

export function ActionCell({
    onEdit,
    onDelete,
    editTitle,
    deleteTitle,
}: {
    onEdit?: () => void
    onDelete: () => void
    editTitle: string
    deleteTitle: string
}) {
    return (
        <td className="p-4">
            <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {onEdit && (
                    <button
                        onClick={onEdit}
                        className="p-1.5 text-text-muted hover:text-text hover:bg-border rounded transition-colors"
                        title={editTitle}
                    >
                        <PencilSimple size={16} />
                    </button>
                )}
                <button
                    onClick={onDelete}
                    className="p-1.5 text-text-muted hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                    title={deleteTitle}
                >
                    <Trash size={16} />
                </button>
            </div>
        </td>
    )
}

export function PrimaryButton({
    icon,
    label,
    onClick,
    disabled,
    type = 'button',
}: {
    icon?: ReactNode
    label: string
    onClick?: () => void
    disabled?: boolean
    type?: 'button' | 'submit'
}) {
    return (
        <button
            type={type}
            onClick={onClick}
            disabled={disabled}
            className="flex items-center gap-2 bg-primary hover:bg-primary-hover px-4 py-2 rounded text-sm font-medium transition-colors disabled:opacity-50"
        >
            {icon}
            {label}
        </button>
    )
}

export function SecondaryButton({
    label,
    onClick,
    disabled,
}: {
    label: string
    onClick: () => void
    disabled?: boolean
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className="bg-border hover:bg-border/80 px-4 py-2 rounded text-sm transition-colors disabled:opacity-50"
        >
            {label}
        </button>
    )
}
