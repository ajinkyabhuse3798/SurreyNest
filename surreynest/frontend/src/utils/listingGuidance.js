export const LISTING_RULES_TOPIC = 'listing-rules'

const ISSUE_CONTENT = {
    rental_bidding: {
        title: 'If a listing hints at offers over the asking rent',
        summary: 'Keep the advertised price and wording together. From 1 May 2026 in England, landlords and agents cannot ask for, encourage, or accept bids above the advertised rent.',
        actions: [
            'Take screenshots showing the asking rent, the wording, and the listing URL.',
            'Ask the agent or landlord to confirm the fixed advertised rent in writing.',
            'Do not feel pressured to outbid other renters just to stay in the running.',
        ],
        ctaLabel: 'Read the bidding rules',
    },
    rent_in_advance: {
        title: 'If the advert asks for several months upfront',
        summary: 'Large upfront requests are a risk signal. From 1 May 2026 in England, landlords and agents cannot require more than 1 month of rent in advance for most private tenancies.',
        actions: [
            'Save the wording that mentions how many months are being asked for upfront.',
            'Ask whether the request is a preference or a condition of being accepted.',
            'Do not transfer money until the rent terms, deposit terms, and tenancy paperwork are clear.',
        ],
        ctaLabel: 'Read the advance-rent rules',
    },
    benefits_discrimination: {
        title: 'If the advert excludes renters on benefits',
        summary: 'Blanket wording such as "No DSS" is a serious warning sign. From 1 May 2026 in England, landlords and agents cannot make someone less likely to rent because they receive benefits.',
        actions: [
            'Keep a screenshot of the exclusion wording and the date you saw it.',
            'Ask for the affordability criteria in writing instead of relying on verbal explanations.',
            'If the wording stays in place, use the rights guide and get advice before you apply.',
        ],
        ctaLabel: 'See the discrimination guidance',
    },
    children_discrimination: {
        title: 'If the advert rules out children or families',
        summary: 'Blanket family exclusions are a serious warning sign. From 1 May 2026 in England, landlords and agents cannot make someone less likely to rent because they have children.',
        actions: [
            'Save the advert wording exactly as it appears, including the platform and date.',
            'Ask for the genuine property suitability criteria in writing if you still want to apply.',
            'Use the rights guide to check what counts as unfair screening.',
        ],
        ctaLabel: 'Read the family discrimination guidance',
    },
    pets: {
        title: 'If the advert says "no pets"',
        summary: 'A blanket pet ban is worth checking carefully. From 1 May 2026 in England, landlords must consider pet requests individually and give valid reasons if they refuse.',
        actions: [
            'Keep the wording that mentions pets, especially if it sounds absolute.',
            'Ask for the pet policy in writing and whether any building or insurance limits apply.',
            'If you plan to request a pet, make that request in writing so there is a record.',
        ],
        ctaLabel: 'Read the pet rules',
    },
}

export function getListingIssueContent(issueId) {
    return ISSUE_CONTENT[issueId] || null
}

export function buildListingActionCards(report, postcode) {
    const cleanedPostcode = typeof postcode === 'string'
        ? postcode.replace(/\s+area$/i, '').trim()
        : ''

    const cards = [
        {
            id: 'save-evidence',
            iconKey: 'camera',
            eyebrow: 'Do first',
            title: 'Save the advert before it changes',
            description: 'Take screenshots of the price, wording, and URL now. Listings and messages can change once you start asking questions.',
            to: `/rights?topic=${LISTING_RULES_TOPIC}`,
            ctaLabel: 'See the listing rules',
        },
    ]

    const issueIds = Array.isArray(report?.issues) ? report.issues.map(issue => issue.id) : []

    issueIds.forEach((issueId) => {
        const issue = getListingIssueContent(issueId)
        if (!issue) return

        cards.push({
            id: issueId,
            iconKey: issueId === 'rental_bidding' ? 'scale' : issueId === 'pets' ? 'message' : 'guide',
            eyebrow: 'Know your position',
            title: issue.title,
            description: issue.summary,
            to: `/rights?topic=${LISTING_RULES_TOPIC}&issue=${issueId}`,
            ctaLabel: issue.ctaLabel,
        })
    })

    if (cleanedPostcode) {
        cards.push({
            id: 'compare-area',
            iconKey: 'search',
            eyebrow: 'Compare nearby options',
            title: `See what else is available near ${cleanedPostcode}`,
            description: 'If the wording feels off, compare nearby homes and local context before committing to this listing.',
            to: `/search?postcode=${encodeURIComponent(cleanedPostcode)}&radius=1000`,
            ctaLabel: 'Open area search',
        })
    }

    if (!issueIds.length) {
        cards.push({
            id: 'understand-rules',
            iconKey: 'guide',
            eyebrow: 'Stay prepared',
            title: 'Read the new listing rules in plain English',
            description: 'Nothing obvious was flagged, but it still helps to know the rules on bidding, upfront rent, pets, and unfair screening.',
            to: `/rights?topic=${LISTING_RULES_TOPIC}`,
            ctaLabel: 'Open the rights guide',
        })
    }

    const seen = new Set()
    return cards.filter((card) => {
        if (seen.has(card.id)) return false
        seen.add(card.id)
        return true
    }).slice(0, 4)
}
