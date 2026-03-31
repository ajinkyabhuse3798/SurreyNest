import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

const mockGet = vi.fn()

vi.mock('../components/Navbar', () => ({
    default: () => <div>Navbar</div>,
}))

vi.mock('../components/ReviewList', () => ({
    default: () => <div>ReviewList</div>,
}))

vi.mock('../components/ReviewForm', () => ({
    default: () => <div>ReviewForm</div>,
}))

vi.mock('../components/RentRadarChart', () => ({
    default: () => <div>RentRadarChart</div>,
}))

vi.mock('../components/property/LocationMap', () => ({
    default: () => <div>LocationMap</div>,
}))

vi.mock('../hooks/useCompare', () => ({
    useCompare: () => ({
        addToCompare: vi.fn(),
        removeFromCompare: vi.fn(),
        isInCompare: () => false,
    }),
}))

vi.mock('../services/api', () => ({
    default: {
        get: (...args) => mockGet(...args),
    },
}))

vi.mock('../utils/propertyUtils', () => ({
    KEY_LOCATIONS: [],
    haversine: vi.fn(() => 0),
    walkingTime: vi.fn(() => 0),
    cyclingTime: vi.fn(() => 0),
    epcImpact: vi.fn(() => ({ label: 'Efficient', detail: 'Mock EPC detail' })),
    safetyVerdict: vi.fn(() => ({ text: 'Moderate area' })),
}))

import PropertyDetail from '../pages/PropertyDetail'

const propertyResponse = {
    data: {
        uprn: '100021062911',
        address: '1 Test Street, Guildford',
        postcode: 'GU1 3XX',
        property_type: 'Flat',
        built_form: 'Apartment',
        tenure: 'Private rental',
        num_rooms: 3,
        floor_area_m2: 58,
        energy_rating: 'C',
        safety_score: 62,
        lat: null,
        lng: null,
        reviews: { review_count: 0 },
        hmo: { is_hmo: false, is_active: false },
        rent_prediction: {
            predicted_weekly_rent: 320,
            rent_low: 290,
            rent_high: 350,
            confidence: 72,
            model_version: 'v8.0.0+lc1',
        },
    },
}

const safetyResponse = {
    data: {
        label: 'Safer than average',
        breakdown: [],
    },
}

const hmoResponse = {
    data: {
        status: 'not_found',
    },
}

function renderPage() {
    return render(
        <MemoryRouter initialEntries={['/property/100021062911']}>
            <Routes>
                <Route path="/property/:uprn" element={<PropertyDetail />} />
            </Routes>
        </MemoryRouter>
    )
}

describe('PropertyDetail', () => {
    beforeEach(() => {
        mockGet.mockReset()
        mockGet.mockImplementation((url) => {
            if (url === '/api/properties/100021062911') return Promise.resolve(propertyResponse)
            if (url === '/api/scores/safety') return Promise.resolve(safetyResponse)
            if (url === '/api/hmo/check') return Promise.resolve(hmoResponse)
            return Promise.reject(new Error(`Unexpected API call: ${url}`))
        })
    })

    it('does not show the rent model version on the property page', async () => {
        renderPage()

        expect(await screen.findByText('1 Test Street, Guildford')).toBeInTheDocument()
        expect(screen.queryByText('Model')).not.toBeInTheDocument()
        expect(screen.queryByText('v8.0.0+lc1')).not.toBeInTheDocument()
        expect(screen.getByText('Est. Monthly')).toBeInTheDocument()
    })
})
