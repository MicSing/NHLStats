import '@testing-library/jest-dom'
import './i18n'
import { server } from './mocks/server'

// Recharts uses ResizeObserver which is not available in jsdom
global.ResizeObserver = class ResizeObserver {
    observe() { }
    unobserve() { }
    disconnect() { }
}

// Recharts reads bounding boxes; return a non-zero size so bars render
Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
    value: () => ({ width: 500, height: 300, top: 0, left: 0, right: 500, bottom: 300, x: 0, y: 0, toJSON: () => { } }),
    configurable: true,
})

// jsdom doesn't implement matchMedia; useIsDesktop and similar hooks need it
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => { },
        removeListener: () => { },
        addEventListener: () => { },
        removeEventListener: () => { },
        dispatchEvent: () => false,
    }),
})

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
