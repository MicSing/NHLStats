import { render, screen } from '@testing-library/react'
import App from '../App'

describe('smoke', () => {
    test('app renders the login page with a heading', () => {
        render(<App />)
        const heading = screen.queryByRole('heading')
        expect(heading).not.toBeNull()
    })
})
