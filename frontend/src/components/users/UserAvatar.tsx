const AVATAR_COLORS = [
    'bg-blue-500/20 text-blue-400',
    'bg-emerald-500/20 text-emerald-400',
    'bg-indigo-500/20 text-indigo-400',
    'bg-rose-500/20 text-rose-400',
    'bg-amber-500/20 text-amber-400',
]

const getAvatarColor = (name: string) => {
    let sum = 0
    for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i)
    return AVATAR_COLORS[sum % AVATAR_COLORS.length]
}

interface UserAvatarProps {
    name: string
    size?: 'sm' | 'lg'
}

export default function UserAvatar({ name, size = 'sm' }: UserAvatarProps) {
    const initials = name ? name.substring(0, 2).toUpperCase() : '?'
    const color = getAvatarColor(name)
    const sizeClass = size === 'lg'
        ? 'w-12 h-12 text-lg font-semibold'
        : 'w-9 h-9 text-xs font-semibold'

    return (
        <div className={`${sizeClass} rounded-full flex items-center justify-center tracking-wide flex-shrink-0 ${color}`}>
            {initials}
        </div>
    )
}
