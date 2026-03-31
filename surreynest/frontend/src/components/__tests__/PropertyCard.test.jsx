import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import PropertyCard from '../PropertyCard'

const property = {
    uprn: '100021062911',
    address: '1 Test Street, Guildford',
    postcode: 'GU1 3XX',
    property_type: 'Flat',
    num_rooms: 3,
    energy_rating: 'C',
    floor_area_m2: 58,
    fairness_score: 71,
    safety_score: 62,
    hmo_status: 'not_found',
    distance_m: 420,
    tenure: 'private rental',
}

describe('PropertyCard', () => {
    it('shows habitable rooms instead of bedrooms on search cards', () => {
        render(
            <MemoryRouter>
                <PropertyCard property={property} />
            </MemoryRouter>
        )

        expect(screen.getByText('3 habitable rooms')).toBeInTheDocument()
        expect(screen.queryByText('3 bed')).not.toBeInTheDocument()
    })
})
