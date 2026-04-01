import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('../../../services/api', () => ({
    default: {
        get: vi.fn().mockResolvedValue({
            data: {
                properties_indexed: 18700,
                districts_covered: 6,
                data_sources: 4,
            },
        }),
    },
}))

import TrustBar from '../TrustBar'

describe('TrustBar', () => {
    it('keeps the three metrics on a single horizontal row on mobile', async () => {
        const { getByTestId } = render(<TrustBar />)

        expect(await screen.findByText('18.7K+')).toBeInTheDocument()

        expect(getByTestId('trust-bar-grid')).toHaveClass('grid-cols-3')
        expect(getByTestId('trust-bar-grid')).not.toHaveClass('grid-cols-1')
    })
})
