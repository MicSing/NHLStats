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
                    DEFAULT: 'var(--color-primary)',
                    hover: 'var(--color-primary-hover)',
                },
                secondary: {
                    DEFAULT: 'var(--color-secondary)',
                    hover: 'var(--color-secondary-hover)',
                },
                // ── Surface tokens ─────────────────────────────────────────
                bg: 'var(--color-bg)',
                surface: 'var(--color-surface)',
                border: 'var(--color-border)',
                // ── Text tokens ────────────────────────────────────────────
                text: {
                    DEFAULT: 'var(--color-text)',
                    muted: 'var(--color-text-muted)',
                },
                // ── Semantic status ────────────────────────────────────────
                success: 'var(--color-success)',
                warning: 'var(--color-warning)',
                danger: 'var(--color-danger)',
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
