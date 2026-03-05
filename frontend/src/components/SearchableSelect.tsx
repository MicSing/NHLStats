import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

export interface SelectOption {
    value: number | string
    label: string
}

interface SearchableSelectProps {
    options: SelectOption[]
    value: number | string | ''
    onChange: (value: number | string | '') => void
    placeholder?: string
    className?: string
}

export default function SearchableSelect({
    options,
    value,
    onChange,
    placeholder = 'Select…',
    className = '',
}: SearchableSelectProps) {
    const { t } = useTranslation()
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState('')
    const containerRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)
    const [highlighted, setHighlighted] = useState(0)

    const selectedLabel =
        value !== '' ? (options.find((o) => o.value === value)?.label ?? '') : ''

    const filtered = options.filter((o) =>
        o.label.toLowerCase().includes(query.toLowerCase()),
    )

    // Close on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false)
                setQuery('')
            }
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    const handleOpen = () => {
        setOpen(true)
        setQuery('')
        setHighlighted(0)
        setTimeout(() => inputRef.current?.focus(), 0)
    }

    const handleSelect = (opt: SelectOption) => {
        onChange(opt.value)
        setOpen(false)
        setQuery('')
    }

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation()
        onChange('')
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault()
            setHighlighted((h) => Math.min(h + 1, filtered.length - 1))
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setHighlighted((h) => Math.max(h - 1, 0))
        } else if (e.key === 'Enter') {
            e.preventDefault()
            if (filtered[highlighted]) handleSelect(filtered[highlighted])
        } else if (e.key === 'Escape') {
            setOpen(false)
            setQuery('')
        }
    }

    return (
        <div ref={containerRef} className={`relative ${className}`}>
            <div
                onClick={handleOpen}
                className="flex items-center justify-between bg-surface rounded-lg px-3 py-1.5 text-sm cursor-pointer min-w-36 border border-border focus-within:border-primary transition-colors"
            >
                <span className={selectedLabel ? 'text-text' : 'text-text-muted'}>
                    {selectedLabel || placeholder}
                </span>
                <div className="flex items-center gap-1">
                    {value !== '' && (
                        <button
                            type="button"
                            onClick={handleClear}
                            aria-label={t('common.close')}
                            className="text-text-muted hover:text-text text-xs px-1"
                        >
                            ✕
                        </button>
                    )}
                    <span className="text-text-muted text-xs">▾</span>
                </div>
            </div>

            {open && (
                <div className="absolute z-50 mt-1 w-full min-w-48 bg-surface border border-border rounded-lg shadow-card">
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(e) => {
                            setQuery(e.target.value)
                            setHighlighted(0)
                        }}
                        onKeyDown={handleKeyDown}
                        placeholder="Search…"
                        className="w-full bg-bg text-sm px-3 py-2 outline-none border-b border-border text-text placeholder-text-muted"
                    />
                    <ul className="max-h-48 overflow-y-auto">
                        {filtered.length === 0 ? (
                            <li className="px-3 py-2 text-sm text-text-muted">{t('common.noData')}</li>
                        ) : (
                            filtered.map((opt, i) => (
                                <li
                                    key={opt.value}
                                    onMouseDown={() => handleSelect(opt)}
                                    onMouseEnter={() => setHighlighted(i)}
                                    className={`px-3 py-1.5 text-sm cursor-pointer ${i === highlighted
                                        ? 'bg-primary text-white'
                                        : 'hover:bg-border'
                                        }`}
                                >
                                    {opt.label}
                                </li>
                            ))
                        )}
                    </ul>
                </div>
            )}
        </div>
    )
}
