/**
 * SafetyDetail tests — covers:
 *   - Star rating logic (overallStars from difference_percent)
 *   - VerdictCard verdict tiers and stat rendering
 *   - SafetyTips visual grouping (positive / warning / info)
 *   - MonthlyChart trend headline (improving / worsening / stable)
 *   - StudentSafety scenario card risk levels
 *   - HolidayAlert always renders (low / moderate / high)
 *   - AreaRankings highlights current sector
 *   - GuildfordComparison renders correct comparison label
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// ── Mocks ─────────────────────────────────────────────────────────────────────
vi.mock('../services/safetyApi', () => ({
    getSafetyIntelligence: vi.fn(() => Promise.resolve(null)),
    getSafetyRankings: vi.fn(() => Promise.resolve(null)),
}))
vi.mock('../services/api', () => ({
    default: { get: vi.fn(() => Promise.resolve({ data: {} })) },
}))
vi.mock('../components/Navbar', () => ({ default: () => <div>Navbar</div> }))
vi.mock('../components/safety/SafetyHero', () => ({
    default: ({ sector }) => <div data-testid="safety-hero">{sector}</div>,
}))
vi.mock('../components/safety/SafetyCityOverview', () => ({
    default: () => <div data-testid="city-overview" />,
}))
vi.mock('../components/safety/GuildfordAttractions', () => ({
    default: () => <div data-testid="guildford-attractions" />,
}))
vi.mock('../components/safety/TrainStations', () => ({
    default: () => <div data-testid="train-stations" />,
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

function wrap(ui) {
    return render(<MemoryRouter>{ui}</MemoryRouter>)
}

// ── VerdictCard ───────────────────────────────────────────────────────────────

import VerdictCard from '../components/safety/VerdictCard'

const baseComparison = {
    sector_total: 48,
    guildford_average: 72,
    difference_percent: -33,
    percentile: 78,
    comparison_label: '33% less crime than Guildford average',
}

const baseStudentVulnerability = {
    student_score: 81.5,
    label: 'Safe for students',
}

describe('VerdictCard', () => {
    it('renders nothing when comparison is null', () => {
        const { container } = wrap(<VerdictCard comparison={null} safetyScore={70} studentVulnerability={null} />)
        expect(container.firstChild).toBeNull()
    })

    it('shows "Area verdict" badge', () => {
        wrap(<VerdictCard comparison={baseComparison} safetyScore={80} studentVulnerability={baseStudentVulnerability} />)
        expect(screen.getByText(/area verdict/i)).toBeInTheDocument()
    })

    it('shows "calmer" headline for safe area (diffPct <= -30)', () => {
        wrap(<VerdictCard comparison={baseComparison} safetyScore={80} studentVulnerability={baseStudentVulnerability} />)
        expect(screen.getByText(/calmer areas in Guildford/i)).toBeInTheDocument()
    })

    it('shows "busier than average" headline when diffPct is 35%', () => {
        const busyComparison = { ...baseComparison, difference_percent: 35, sector_total: 97 }
        wrap(<VerdictCard comparison={busyComparison} safetyScore={45} studentVulnerability={null} />)
        expect(screen.getByText(/busier than average/i)).toBeInTheDocument()
    })

    it('shows "comes up more" headline when diffPct > 50', () => {
        const hotspotComparison = { ...baseComparison, difference_percent: 70, sector_total: 130 }
        wrap(<VerdictCard comparison={hotspotComparison} safetyScore={25} studentVulnerability={null} />)
        expect(screen.getByText(/comes up more in the data/i)).toBeInTheDocument()
    })

    it('shows "fine for most students" headline when diffPct is near zero', () => {
        const avgComparison = { ...baseComparison, difference_percent: 5, sector_total: 72 }
        wrap(<VerdictCard comparison={avgComparison} safetyScore={60} studentVulnerability={null} />)
        expect(screen.getByText(/fine for most students/i)).toBeInTheDocument()
    })

    it('displays the sector_total incident count', () => {
        wrap(<VerdictCard comparison={baseComparison} safetyScore={80} studentVulnerability={baseStudentVulnerability} />)
        expect(screen.getByText('48')).toBeInTheDocument()
    })

    it('shows student safety score when available', () => {
        wrap(<VerdictCard comparison={baseComparison} safetyScore={80} studentVulnerability={baseStudentVulnerability} />)
        expect(screen.getByText('81.5')).toBeInTheDocument()
    })

    it('shows percentile context text', () => {
        wrap(<VerdictCard comparison={baseComparison} safetyScore={80} studentVulnerability={null} />)
        expect(screen.getByText(/Quieter than 78%/i)).toBeInTheDocument()
    })
})

// ── SafetyTips ────────────────────────────────────────────────────────────────

import SafetyTips from '../components/safety/SafetyTips'

describe('SafetyTips', () => {
    it('renders nothing for empty tips array', () => {
        const { container } = wrap(<SafetyTips tips={[]} />)
        expect(container.firstChild).toBeNull()
    })

    it('renders nothing for null tips', () => {
        const { container } = wrap(<SafetyTips tips={null} />)
        expect(container.firstChild).toBeNull()
    })

    it('renders a positive tip correctly', () => {
        const tips = [{ type: 'positive', icon: '✅', text: 'Very quiet area, great for studying' }]
        wrap(<SafetyTips tips={tips} />)
        expect(screen.getByText('Very quiet area, great for studying')).toBeInTheDocument()
    })

    it('renders a warning tip correctly', () => {
        const tips = [{ type: 'warning', icon: '🔒', text: 'Keep windows locked when out' }]
        wrap(<SafetyTips tips={tips} />)
        expect(screen.getByText('Keep windows locked when out')).toBeInTheDocument()
    })

    it('renders an info tip correctly', () => {
        const tips = [{ type: 'info', icon: '🔊', text: 'Can be noisy on weekends' }]
        wrap(<SafetyTips tips={tips} />)
        expect(screen.getByText('Can be noisy on weekends')).toBeInTheDocument()
    })

    it('handles plain string tips (legacy format)', () => {
        const tips = ['Lock your bike securely at all times']
        wrap(<SafetyTips tips={tips} />)
        expect(screen.getByText('Lock your bike securely at all times')).toBeInTheDocument()
    })

    it('renders multiple tips', () => {
        const tips = [
            { type: 'positive', icon: '✅', text: 'Low crime area' },
            { type: 'warning', icon: '⚠️', text: 'Watch your phone' },
        ]
        wrap(<SafetyTips tips={tips} />)
        expect(screen.getByText('Low crime area')).toBeInTheDocument()
        expect(screen.getByText('Watch your phone')).toBeInTheDocument()
    })
})

// ── MonthlyChart ──────────────────────────────────────────────────────────────

import MonthlyChart from '../components/safety/MonthlyChart'

const MONTHLY_DATA = [
    { month: '2025-01-01', count: 10 },
    { month: '2025-02-01', count: 8 },
    { month: '2025-03-01', count: 7 },
    { month: '2025-04-01', count: 6 },
    { month: '2025-05-01', count: 5 },
    { month: '2025-06-01', count: 4 },
]

describe('MonthlyChart', () => {
    it('shows "No monthly data available" when data is empty', () => {
        wrap(<MonthlyChart data={[]} trend={null} />)
        expect(screen.getByText(/no monthly data available/i)).toBeInTheDocument()
    })

    it('shows improving headline for improving trend', () => {
        const trend = { direction: 'improving', change_percent: -28, label: 'Crime down 28%' }
        wrap(<MonthlyChart data={MONTHLY_DATA} trend={trend} />)
        expect(screen.getByText(/gone down 28%/i)).toBeInTheDocument()
    })

    it('shows worsening headline for worsening trend', () => {
        const trend = { direction: 'worsening', change_percent: 15, label: 'Crime up 15%' }
        wrap(<MonthlyChart data={MONTHLY_DATA} trend={trend} />)
        expect(screen.getByText(/gone up 15%/i)).toBeInTheDocument()
    })

    it('shows stable headline for stable trend', () => {
        const trend = { direction: 'stable', change_percent: 2, label: 'Crime stable' }
        wrap(<MonthlyChart data={MONTHLY_DATA} trend={trend} />)
        expect(screen.getByText(/broadly stable/i)).toBeInTheDocument()
    })

    it('also supports legacy "decreasing" direction value', () => {
        const trend = { direction: 'decreasing', change_percent: -20, label: '' }
        wrap(<MonthlyChart data={MONTHLY_DATA} trend={trend} />)
        expect(screen.getByText(/gone down 20%/i)).toBeInTheDocument()
    })
})

// ── StudentSafety ─────────────────────────────────────────────────────────────

import StudentSafety from '../components/safety/StudentSafety'

const STUDENT_DATA_SAFE = {
    student_score: 88,
    general_score: 82,
    label: 'Very safe for students',
    score_difference: 6,
    impacts: [
        { category: 'burglary', label: 'Burglary', count: 3, student_relevance: 'high', student_weight: 4.0, general_weight: 2.0 },
        { category: 'theft-from-the-person', label: 'Theft from Person', count: 5, student_relevance: 'high', student_weight: 3.0, general_weight: 1.5 },
        { category: 'anti-social-behaviour', label: 'Anti-Social Behaviour', count: 12, student_relevance: 'low', student_weight: 1.0, general_weight: 1.5 },
        { category: 'violent-crime', label: 'Violent Crime', count: 4, student_relevance: 'same', student_weight: 3.0, general_weight: 3.0 },
    ],
}

describe('StudentSafety', () => {
    it('shows fallback message when data is null', () => {
        wrap(<StudentSafety data={null} />)
        expect(screen.getByText(/no student safety data/i)).toBeInTheDocument()
    })

    it('shows fallback when student_score is null', () => {
        wrap(<StudentSafety data={{ student_score: null }} />)
        expect(screen.getByText(/no student safety data/i)).toBeInTheDocument()
    })

    it('renders "Looking good" badge for high score', () => {
        wrap(<StudentSafety data={STUDENT_DATA_SAFE} />)
        expect(screen.getByText('Looking good')).toBeInTheDocument()
    })

    it('shows all 5 life scenario cards including bicycle theft', () => {
        wrap(<StudentSafety data={STUDENT_DATA_SAFE} />)
        expect(screen.getByText('Walking home at night')).toBeInTheDocument()
        expect(screen.getByText('Your shared house')).toBeInTheDocument()
        expect(screen.getByText('Personal belongings')).toBeInTheDocument()
        expect(screen.getByText('Noise and atmosphere')).toBeInTheDocument()
        expect(screen.getByText('Your bike')).toBeInTheDocument()
    })

    it('shows score difference note', () => {
        wrap(<StudentSafety data={STUDENT_DATA_SAFE} />)
        expect(screen.getByText(/6\.0 points safer for students/i)).toBeInTheDocument()
    })

    it('shows general score for comparison', () => {
        wrap(<StudentSafety data={STUDENT_DATA_SAFE} />)
        expect(screen.getByText('82')).toBeInTheDocument()
    })
})

// ── HolidayAlert ──────────────────────────────────────────────────────────────

import HolidayAlert from '../components/safety/HolidayAlert'

describe('HolidayAlert', () => {
    it('renders a fallback message when risk is null', () => {
        wrap(<HolidayAlert risk={null} />)
        expect(screen.getByText(/no holiday burglary data/i)).toBeInTheDocument()
    })

    it('renders a positive message for low risk', () => {
        const low = { risk_level: 'low', label: 'No significant holiday pattern', holiday_count: 2, term_count: 3, spike_percent: 5, tip: 'Always lock your windows.' }
        wrap(<HolidayAlert risk={low} />)
        expect(screen.getByText(/No unusual break-in pattern during holidays/i)).toBeInTheDocument()
    })

    it('renders a warning for moderate risk', () => {
        const mod = { risk_level: 'moderate', label: 'Burglaries up 30%', holiday_count: 8, term_count: 5, spike_percent: 30, tip: 'Use timer switches for lights.' }
        wrap(<HolidayAlert risk={mod} />)
        expect(screen.getByText(/Some increase in break-ins during holidays/i)).toBeInTheDocument()
    })

    it('renders a high risk warning', () => {
        const high = { risk_level: 'high', label: 'Burglaries spike 80%', holiday_count: 18, term_count: 8, spike_percent: 80, tip: 'Ask landlord about CCTV.' }
        wrap(<HolidayAlert risk={high} />)
        expect(screen.getByText(/Higher break-in risk when students leave/i)).toBeInTheDocument()
    })

    it('renders the tip for moderate risk', () => {
        const mod = { risk_level: 'moderate', label: '', holiday_count: 8, term_count: 5, spike_percent: 30, tip: 'Use timer switches for lights.' }
        wrap(<HolidayAlert risk={mod} />)
        expect(screen.getByText('Use timer switches for lights.')).toBeInTheDocument()
    })

    it('shows spike percentage for high risk', () => {
        const high = { risk_level: 'high', label: '', holiday_count: 18, term_count: 8, spike_percent: 80, tip: '' }
        wrap(<HolidayAlert risk={high} />)
        expect(screen.getByText(/80% higher during holiday months/i)).toBeInTheDocument()
    })
})

// ── AreaRankings ──────────────────────────────────────────────────────────────

import AreaRankings from '../components/safety/AreaRankings'

const RANKINGS = {
    safest: [
        { postcode_sector: 'GU2 7', total_crimes: 20, safety_score: 92 },
        { postcode_sector: 'GU3 1', total_crimes: 25, safety_score: 88 },
        { postcode_sector: 'GU4 2', total_crimes: 30, safety_score: 85 },
        { postcode_sector: 'GU5 9', total_crimes: 35, safety_score: 82 },
        { postcode_sector: 'GU7 1', total_crimes: 40, safety_score: 78 },
    ],
    hotspots: [
        { postcode_sector: 'GU1 1', total_crimes: 120, safety_score: 22 },
        { postcode_sector: 'GU1 4', total_crimes: 110, safety_score: 30 },
        { postcode_sector: 'GU1 3', total_crimes: 100, safety_score: 35 },
        { postcode_sector: 'GU2 4', total_crimes: 90, safety_score: 40 },
        { postcode_sector: 'GU2 5', total_crimes: 80, safety_score: 45 },
    ],
}

describe('AreaRankings', () => {
    it('shows fallback when rankings is null', () => {
        wrap(<AreaRankings rankings={null} currentSector="GU2 7" />)
        expect(screen.getByText(/no ranking data available/i)).toBeInTheDocument()
    })

    it('renders safest areas list', () => {
        wrap(<AreaRankings rankings={RANKINGS} currentSector="GU3 1" />)
        expect(screen.getByText('GU2 7')).toBeInTheDocument()
        expect(screen.getByText('GU3 1')).toBeInTheDocument()
    })

    it('renders hotspot areas list', () => {
        wrap(<AreaRankings rankings={RANKINGS} currentSector="GU3 1" />)
        expect(screen.getByText('GU1 1')).toBeInTheDocument()
    })

    it('highlights the current sector with "(you)" label', () => {
        wrap(<AreaRankings rankings={RANKINGS} currentSector="GU2 7" />)
        expect(screen.getByText('you')).toBeInTheDocument()
    })
})

// ── GuildfordComparison ───────────────────────────────────────────────────────

import GuildfordComparison from '../components/safety/GuildfordComparison'

describe('GuildfordComparison', () => {
    it('shows fallback when comparison is null', () => {
        wrap(<GuildfordComparison comparison={null} />)
        expect(screen.getByText(/no comparison data available/i)).toBeInTheDocument()
    })

    it('shows this area total and Guildford average', () => {
        const comparison = { sector_total: 48, guildford_average: 72, difference_percent: -33, comparison_label: '33% less crime' }
        wrap(<GuildfordComparison comparison={comparison} />)
        expect(screen.getAllByText('48').length).toBeGreaterThan(0)
        expect(screen.getAllByText('72').length).toBeGreaterThan(0)
    })

    it('shows "below" when below average', () => {
        const comparison = { sector_total: 48, guildford_average: 72, difference_percent: -33, comparison_label: '' }
        wrap(<GuildfordComparison comparison={comparison} />)
        expect(screen.getByText(/33%.*below the Guildford average/i)).toBeInTheDocument()
    })

    it('shows "above" when above average', () => {
        const comparison = { sector_total: 110, guildford_average: 72, difference_percent: 53, comparison_label: '' }
        wrap(<GuildfordComparison comparison={comparison} />)
        expect(screen.getByText(/53%.*above the Guildford average/i)).toBeInTheDocument()
    })
})
