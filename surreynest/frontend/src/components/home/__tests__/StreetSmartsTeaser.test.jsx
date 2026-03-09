/**
 * Tests for StreetSmartsTeaser — verifies API fetch and rendering.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, ...props }) => <div {...props}>{children}</div>,
    },
    useInView: () => true,
}))

// Mock the api module
vi.mock('../../../services/api', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn(),
        interceptors: {
            request: { use: vi.fn() },
            response: { use: vi.fn() },
        },
    },
}))

import api from '../../../services/api'
import StreetSmartsTeaser from '../StreetSmartsTeaser'

function renderWithRouter(ui) {
    return render(<MemoryRouter>{ui}</MemoryRouter>)
}

describe('StreetSmartsTeaser', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('fetches from leaderboard API and renders street names', async () => {
        api.get.mockResolvedValueOnce({
            data: {
                streets: [
                    { street_name: 'Weston Road', composite_score: 72.1 },
                    { street_name: 'Park Avenue', composite_score: 68.5 },
                    { street_name: 'High Street', composite_score: 65.3 },
                ],
            },
        })

        renderWithRouter(<StreetSmartsTeaser />)

        await waitFor(() => {
            expect(screen.getByText('Weston Road')).toBeInTheDocument()
        })

        expect(screen.getByText('Park Avenue')).toBeInTheDocument()
        expect(screen.getByText('High Street')).toBeInTheDocument()

        // Verify API was called with correct params
        expect(api.get).toHaveBeenCalledWith('/api/leaderboard/streets', {
            params: { district: 'GU2', limit: 3 },
        })
    })

    it('shows View Full Rankings link', async () => {
        api.get.mockResolvedValueOnce({ data: { streets: [] } })

        renderWithRouter(<StreetSmartsTeaser />)

        await waitFor(() => {
            expect(screen.getByText('View Full Rankings')).toBeInTheDocument()
        })
    })

    it('handles API failure gracefully', async () => {
        api.get.mockRejectedValueOnce(new Error('Network error'))

        renderWithRouter(<StreetSmartsTeaser />)

        // Should still render the section header
        await waitFor(() => {
            expect(screen.getByText('Best Streets for Students')).toBeInTheDocument()
        })
    })
})
