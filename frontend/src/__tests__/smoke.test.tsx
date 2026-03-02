import { render, screen } from '@testing-library/react'
import App from '../App'

describe('smoke', () => {
    test('app renders', () => {
        render(<App />)
        const heading = screen.queryByRole('heading')
        expect(heading).not.toBeNull()
    })
})
