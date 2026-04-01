import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../../ScoreGauge', () => ({
    default: () => <div>ScoreGauge</div>,
}))

import SafetyHero from '../SafetyHero'

describe('SafetyHero', () => {
    it('keeps the safety postcode input at a non-zooming mobile size and clips the search shell', () => {
        render(
            <MemoryRouter>
                <SafetyHero
                    sector="GU1 3"
                    decodedPostcode="GU1 3"
                    safetyScore={68}
                    overallStars={4}
                    sectorTotal={123}
                    percentile={72}
                />
            </MemoryRouter>
        )

        const input = screen.getByPlaceholderText(/try another area, e\.g\. gu1 3, gu2 7/i)
        const form = input.closest('form')

        expect(input).toHaveClass('text-base')
        expect(input).not.toHaveClass('text-sm')
        expect(input.parentElement).toHaveClass('min-w-0')
        expect(form).toHaveClass('overflow-hidden')
    })
})
