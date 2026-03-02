module.exports = {
    content: [
        './index.html',
        './src/**/*.{ts,tsx,js,jsx}'
    ],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                cyan: {
                    400: '#22d3ee',
                    500: '#06b6d4',
                    600: '#0891b2',
                },
                orange: {
                    400: '#fb923c',
                    500: '#f97316',
                    600: '#ea580c',
                },
            },
        },
    },
    plugins: [],
}
