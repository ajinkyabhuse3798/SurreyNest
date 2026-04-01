import { beforeAll, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../../../services/safetyApi', () => ({
    getSafetyRankings: vi.fn().mockResolvedValue({
        safest: [{ postcode_sector: 'GU1 1', safety_score: 84 }],
    }),
}))

import ExploreSection from '../ExploreSection'
import GuildfordSafetySection from '../GuildfordSafetySection'

beforeAll(() => {
    vi.stubGlobal(
        'IntersectionObserver',
        class {
            observe() {}
            unobserve() {}
            disconnect() {}
        }
    )
})

describe('Responsive home sections', () => {
    it('keeps the explore teaser visually contained on mobile', () => {
        const { container } = render(
            <MemoryRouter>
                <ExploreSection />
            </MemoryRouter>
        )

        const section = container.querySelector('section')
        const teaserCard = [...container.querySelectorAll('div')].find(
            (el) =>
                el.className.includes('glass p-2') &&
                el.className.includes('rounded-[2rem]')
        )

        expect(section).toHaveClass('overflow-hidden')
        expect(teaserCard).toHaveClass('rotate-0')
    })

    it('keeps the guildford safety teaser clipped on mobile', async () => {
        const { container } = render(
            <MemoryRouter>
                <GuildfordSafetySection />
            </MemoryRouter>
        )

        expect(await screen.findByText('GU1 1')).toBeInTheDocument()
        expect(screen.getByText(/Understand Guildford safety/i)).toBeInTheDocument()
        expect(container.querySelector('section')).toHaveClass('overflow-hidden')
    })
})
