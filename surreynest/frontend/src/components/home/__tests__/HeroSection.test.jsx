import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../../../services/api', () => ({
    default: {
        get: vi.fn().mockResolvedValue({ data: [] }),
    },
}))

import HeroSection from '../HeroSection'

describe('HeroSection', () => {
    it('keeps the home postcode input at a non-zooming mobile size and clips the shell', () => {
        const { container } = render(
            <MemoryRouter>
                <HeroSection
                    postcode=""
                    setPostcode={vi.fn()}
                    error=""
                    loading={false}
                    handleSearch={vi.fn()}
                />
            </MemoryRouter>
        )

        const input = screen.getByPlaceholderText(/enter postcode \(e\.g\. gu2 7xh\)/i)
        const shell = [...container.querySelectorAll('div')].find(
            (el) =>
                el.className.includes('glass rounded-xl p-2') &&
                el.className.includes('shadow-xl')
        )

        expect(input).toHaveClass('text-base')
        expect(input).not.toHaveClass('text-sm')
        expect(shell).toHaveClass('overflow-hidden')
    })
})
