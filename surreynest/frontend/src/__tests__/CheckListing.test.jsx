import { describe, expect, it, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../components/Navbar', () => ({
    default: () => <div>Navbar</div>,
}))

vi.mock('../services/api', () => ({
    default: {
        post: vi.fn(),
    },
}))

import CheckListing from '../pages/CheckListing'
import api from '../services/api'

function renderPage() {
    return render(
        <MemoryRouter>
            <CheckListing />
        </MemoryRouter>
    )
}

describe('CheckListing', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('presents manual postcode guidance instead of scrape-based wording', () => {
        renderPage()

        expect(
            screen.getByText(/enter the guildford postcode manually/i)
        ).toBeInTheDocument()
        expect(screen.getByText(/required postcode/i)).toBeInTheDocument()
        expect(screen.queryByText(/optional postcode/i)).not.toBeInTheDocument()
        expect(
            screen.queryByText(/auto-extract|scan the pasted advert link/i)
        ).not.toBeInTheDocument()
    })

    it('requires a postcode before posting the listing check request', async () => {
        const user = userEvent.setup()
        renderPage()

        await user.click(screen.getByRole('button', { name: /check/i }))

        expect(api.post).not.toHaveBeenCalled()
        expect(
            screen.getByText(/please enter the postcode manually/i)
        ).toBeInTheDocument()
    })

    it('removes scrape-based helper copy from the manual-only flow', async () => {
        renderPage()

        expect(
            screen.getByPlaceholderText(/optional: paste the listing description here/i)
        ).toBeInTheDocument()
        expect(
            screen.queryByPlaceholderText(/paste listing url here/i)
        ).not.toBeInTheDocument()
        expect(
            screen.queryByPlaceholderText(/site blocks scraping/i)
        ).not.toBeInTheDocument()
        expect(
            screen.queryByText(/couldn't read the postcode from that page/i)
        ).not.toBeInTheDocument()
    })

    it('labels analysed wording as pasted text when the compliance scan used manual text', async () => {
        const user = userEvent.setup()
        api.post.mockResolvedValueOnce({
            data: {
                postcode: 'GU1 1AA',
                message: 'Analysis ready',
                safety_score: 72,
                safety_label: 'Safe',
                properties_in_area: 1,
                nearby_properties: [],
                hmo_total_count: 0,
                hmo_licensed_count: 0,
                flood_risk_severity: null,
                compliance_report: {
                    status: 'HIGH_RISK',
                    headline: 'Issues found',
                    summary: 'Summary',
                    analysed_text_source: 'manual_text',
                    issues: [],
                    positives: [],
                },
            },
        })

        renderPage()

        await user.type(screen.getByPlaceholderText(/gu1 3jt/i), 'GU1 1AA')
        await user.type(
            screen.getByPlaceholderText(/optional: paste the listing description here/i),
            'No DSS. Sorry, no pets.'
        )
        await user.click(screen.getByRole('button', { name: /check/i }))

        await waitFor(() => {
            expect(screen.getByText(/based on pasted wording/i)).toBeInTheDocument()
        })
    })

    it('labels the scan as unavailable when no wording was provided', async () => {
        const user = userEvent.setup()
        api.post.mockResolvedValueOnce({
            data: {
                postcode: 'GU1 1AA',
                message: 'Analysis ready',
                safety_score: 72,
                safety_label: 'Safe',
                properties_in_area: 1,
                nearby_properties: [],
                hmo_total_count: 0,
                hmo_licensed_count: 0,
                flood_risk_severity: null,
                compliance_report: {
                    status: 'NOT_AVAILABLE',
                    headline: 'Compliance scan unavailable',
                    summary: 'Summary',
                    analysed_text_source: null,
                    issues: [],
                    positives: [],
                },
            },
        })

        renderPage()

        await user.type(screen.getByPlaceholderText(/gu1 3jt/i), 'GU1 1AA')
        await user.click(screen.getByRole('button', { name: /check/i }))

        await waitFor(() => {
            expect(screen.getByText(/no wording scanned/i)).toBeInTheDocument()
        })
    })

    it('submits postcode and pasted wording without a listing link field', async () => {
        const user = userEvent.setup()
        api.post.mockResolvedValueOnce({
            data: {
                postcode: 'GU1 1AA',
                message: 'Analysis ready',
                safety_score: 72,
                safety_label: 'Safe',
                properties_in_area: 1,
                nearby_properties: [],
                hmo_total_count: 0,
                hmo_licensed_count: 0,
                flood_risk_severity: null,
                compliance_report: {
                    status: 'REVIEW',
                    headline: 'Review the wording',
                    summary: 'Summary',
                    analysed_text_source: 'manual_text',
                    issues: [],
                    positives: [],
                },
            },
        })

        renderPage()

        await user.type(screen.getByPlaceholderText(/gu1 3jt/i), 'GU1 1AA')
        await user.type(
            screen.getByPlaceholderText(/optional: paste the listing description here/i),
            'No pets allowed.'
        )
        await user.click(screen.getByRole('button', { name: /check/i }))

        await waitFor(() => {
            expect(api.post).toHaveBeenCalledWith('/api/listings/check', {
                postcode: 'GU1 1AA',
                listing_text: 'No pets allowed.',
            })
        })
    })
})
