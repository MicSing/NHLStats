function withOpacity(variableName) {
    return ({ opacityValue }) => {
        if (opacityValue !== undefined) {
            return `color-mix(in srgb, var(${variableName}) calc(100% * ${opacityValue}), transparent)`
        }
        return `var(${variableName})`
    }
}

module.exports = {
    content: [
        './index.html',
        './src/**/*.{ts,tsx,js,jsx}'
    ],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                // ── Brand palette ──────────────────────────────────────────
                primary: {
                    DEFAULT: withOpacity('--color-primary'),
                    hover: withOpacity('--color-primary-hover'),
                },
                secondary: {
                    DEFAULT: withOpacity('--color-secondary'),
                    hover: withOpacity('--color-secondary-hover'),
                },
                // ── Surface tokens ─────────────────────────────────────────
                bg: withOpacity('--color-bg'),
                surface: withOpacity('--color-surface'),
                border: withOpacity('--color-border'),
                // ── Text tokens ────────────────────────────────────────────
                text: {
                    DEFAULT: withOpacity('--color-text'),
                    muted: withOpacity('--color-text-muted'),
                },
                // ── Semantic status ────────────────────────────────────────
                success: withOpacity('--color-success'),
                warning: withOpacity('--color-warning'),
                danger: withOpacity('--color-danger'),
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'Avenir', 'Helvetica', 'Arial', 'sans-serif'],
            },
            boxShadow: {
                card: '0 2px 8px 0 rgba(0,0,0,0.35)',
                'card-hover': '0 4px 16px 0 rgba(0,0,0,0.45)',
            },
        },
    },
    plugins: [],
}
