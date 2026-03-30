# Area Decision Safety Design

Date: 2026-03-30
Product: SurreyNest
Scope: Redesign the existing safety experience into a richer, more interactive area-intelligence experience that supports property evaluation and informed decisions.

## Summary

SurreyNest should evolve from a strong but crime-first safety report into an area decision experience.

The new experience will still use the existing safety analysis as its backbone, but it will present that information in a friendlier and more balanced way:

- Lead with a plain-English area summary, not charts
- Show positives as well as watch-outs
- Help users understand travel convenience, value, and availability next to safety
- Keep the first view simple, then let users compare areas as a second step
- Use SurreyNest's existing warm amber visual language across the safety experience

This design keeps SurreyNest focused on helping people understand an area around a property. It does not turn the product into a listings marketplace or a generic policing dashboard.

## Current Context

SurreyNest already has strong safety foundations:

- Guildford-wide overview at `/safety`
- Area drill-down at `/safety/:postcode`
- Existing safety score, trend, crime mix, rankings, student view, holiday burglary risk, and practical tips
- Supporting area signals elsewhere in the product such as average rent, nearby properties, HMO counts, and street rankings

The current weakness is not lack of data. The weakness is framing and flow.

Today the safety experience is still anchored around crime analytics:

- the first impression is a safety score and charts
- positive decision context is scattered or static
- the handoff from area understanding to property exploration is weak
- the map/explorer story exists in pieces but is not yet the main journey
- some language is still closer to the data than to the user's decision

## Problem Statement

Users need help answering a simple question:

"Would this area work well for me before I spend time looking closely at properties here?"

The current safety pages answer narrower questions:

- how much crime is here?
- what kind of crime is it?
- how does it compare with Guildford?

Those are useful, but they are not enough on their own. A good area decision page should also answer:

- what feels good about this area?
- what should I think carefully about?
- is it convenient for university, town, and day-to-day travel?
- is there enough property availability here to make it worth exploring?
- how does this area compare with nearby alternatives?

## Goals

- Make the safety experience understandable for non-technical users
- Reframe the page around decision-making, not raw data reading
- Keep the experience area-first
- Make the page feel balanced, not negative-only
- Improve mobile and desktop usability without splitting the product into separate experiences
- Build on the current backend and frontend instead of replacing them
- Keep a clear path from area research to relevant properties

## Non-Goals

- Do not become a property listings marketplace
- Do not become a generic Police.uk explorer
- Do not present exact incident maps or exact street-level victim locations
- Do not use stop-and-search as a main decision signal
- Do not overload users with technical policing terms or unexplained metrics

## Recommended Product Direction

The safety experience should become an `Area Decision` product surface with a phased `Area Explorer` on top.

Recommended shape:

- `/safety` becomes the main area explorer entry point
- `/safety/:postcode` becomes a full area decision page
- users explore one area first
- users compare later, after they understand the first area

This preserves simplicity for first-time visitors while creating a clear path toward a stickier, more interactive exploration flow.

## Experience Principles

### 1. Simple answer first

The first screen should answer:

- what this area is like overall
- what is good about it
- what needs a closer look
- whether it is worth exploring properties here

### 2. Positive and caution together

Every area should have a balanced read:

- "What works well here"
- "Things to think about"

That prevents the page from feeling like a crime alert page and makes the product more trustworthy.

### 3. Plain language over technical language

Users should not need to understand policing data structures.

The page should say:

- "What happens here most often?"
- "How has this area been changing?"
- "What should students or renters think about here?"

The page should avoid leading with phrases like:

- "crime mix"
- "weighted score"
- "sector methodology"
- "incident composition"

These can still exist in methodology details, but not as the main reading experience.

### 4. Mobile-first reading flow

On mobile, the page should read as one clear vertical story.

On desktop, the same content can be grouped into two columns or map-plus-report layouts, but the order of meaning should remain identical.

### 5. Compare later, not immediately

Comparison should be available, but not required to understand the page.

The first task is confidence.
The second task is comparison.

## Information Architecture

### `/safety` - Area Explorer

Purpose:

- help users explore Guildford areas before choosing one to inspect closely

Main sections:

1. Search and quick area lookup
2. "Best places to start" cards
3. Live interactive area explorer
4. Ranked nearby areas
5. Quick comparison tray
6. Trust and methodology notes

### `/safety/:postcode` - Area Decision Page

Purpose:

- help users decide whether an area is worth considering before narrowing to specific properties

Main sections:

1. Area summary hero
2. Why this area works
3. Things to think about
4. Travel and daily life
5. Value and availability
6. Safety explained simply
7. Compare nearby areas
8. Deeper evidence
9. Official local context
10. Explore properties here

## Detailed Page Design

### 1. Hero: Area Summary

This replaces the current crime-first hero with a decision-first header.

Hero content:

- area name or postcode sector
- one-line plain-English summary
- one balanced verdict line
- branded safety score
- "worth exploring" style guidance
- one prominent search input
- one main CTA to continue exploring this area

Example tone:

- "Generally calm, easy for university travel, but worth checking burglary patterns during holiday periods."

The hero should not feel like a warning banner. It should feel like an informed guide.

### 2. Why This Area Works

This is the user's first positive context block and should sit above any deep crime visuals.

It should be a compact balanced mix of:

- travel convenience
- day-to-day fit
- value and availability

Example cards:

- "Easy to get to campus"
- "Good number of nearby properties"
- "Quieter than many nearby areas"

This section should be data-backed where possible, not generic lifestyle copy.

### 3. Things To Think About

This is the companion block to the positive section.

It should call out 2-4 area-specific caution points in calm, readable language.

Examples:

- "Bike theft is worth paying attention to here"
- "This area gets busier than average late in the year"
- "Check locks and outdoor storage if you are considering shared housing"

The tone must be informative, not alarmist.

### 4. Travel and Daily Life

This should bring together the positive context users asked for.

Signals to include:

- travel time to university
- travel time to town
- nearest station and approximate access
- whether the area feels convenient for day-to-day routines

The section should be written as utility, not lifestyle marketing.

### 5. Value and Availability

This should help users decide whether an area is practical to keep exploring.

Signals:

- average rent signal
- number of nearby properties or active searchable properties
- HMO presence
- whether the area has enough supply to be worth browsing further

This gives the user a reason to stay on the product and continue from area to property.

### 6. Safety Explained Simply

This replaces the current feeling of "charts first."

Order inside this section:

1. plain-English summary
2. what happens here most often
3. how the area has been changing
4. student-specific read
5. practical tips

The charts still exist, but they should support the explanation rather than lead it.

### 7. Compare Nearby Areas

Comparison becomes the second-step interaction.

Recommended interaction:

- show 3 suggested nearby alternatives
- each alternative gets a short one-line summary
- user can add up to 2 areas to a compare tray
- comparison stays lightweight and readable

Comparison categories:

- overall feel
- safety
- convenience
- value

The comparison should not be a dense table by default.

### 8. Deeper Evidence

This is where the current strength of SurreyNest remains visible.

Move existing deep components here:

- crime donut
- monthly trend chart
- Guildford comparison
- area rankings
- holiday burglary risk
- student-weighted analysis

These should sit lower on the page and be clearly framed as supporting evidence.

### 9. Official Local Context

This section is where Police.uk enrichments should appear.

Recommended additions:

- official neighbourhood name
- neighbourhood boundary context
- local police priorities
- outcome profile for reported incidents
- data freshness and coverage note

This adds trustworthy public context without turning the page into a police service portal.

### 10. Explore Properties Here

The page must end with a strong next step.

Actions:

- explore properties near this area
- check a listing in this area
- save area for later comparison

This is the missing bridge in the current experience.

## Area Explorer Design

The `/safety` page should evolve from a summary page into a lighter-weight explorer.

### Entry Behaviour

The user should be able to:

- search a postcode
- tap an area card
- use a live explorer surface

### Explorer Surface

Recommended design:

- hybrid explorer, not pure map and not pure report
- mobile: area cards and compact explorer above a simplified map
- desktop: explorer map plus summary panel

The explorer should let users:

- browse areas visually
- see a simple summary for the selected area
- jump into a full area decision page

### Explorer Filters

Keep filters human-readable:

- calmer areas
- easier for university travel
- better value
- student-friendly

Avoid technical filter labels.

## Data Strategy

### Keep Using Existing SurreyNest Signals

Continue using:

- safety score
- student vulnerability view
- holiday burglary risk
- Guildford comparison
- rankings
- nearby station distance
- average rent
- HMO density
- nearby properties

These are already valuable and should be presented more clearly rather than hidden behind analytics language.

### Add High-Value Police.uk Context

Add these next:

1. `crime-last-updated`
   - show real freshness
   - improve trust

2. `outcomes-at-location`
   - show outcome mix
   - helps users understand whether incidents typically remain unresolved or move forward

3. `locate-neighbourhood`
   - map each area to official local police neighbourhood

4. neighbourhood details and boundary
   - provide clearer official local context than postcode sector alone

5. neighbourhood priorities
   - show what local police are actively focused on

6. neighbourhood events or team context
   - optional secondary trust layer

### Explicitly Exclude From Core Scoring

- stop and search
- senior officers
- force-wide administrative data
- crime-specific drill-down pages

These are weak or risky fits for area decision-making.

## Architecture and Data Flow

The redesign should build on the current SurreyNest structure instead of introducing a separate safety stack.

### Backend shape

Keep the current separation of concerns:

- pipeline and aggregation logic stays in the existing crime and supporting data pipelines
- score computation stays in the score service layer
- richer area decision payloads are assembled in the safety intelligence layer
- area explorer payloads remain lightweight and summary-focused

### Frontend shape

Keep the current route model and extend it:

- `/safety` stays the explorer entry
- `/safety/:postcode` stays the drill-down route
- new sections are added as focused components rather than one large page file

Recommended component groupings:

- hero and area summary
- positive signals and watch-outs
- travel and daily-life cards
- value and availability cards
- compare tray and nearby alternatives
- deeper evidence modules
- official local context modules

### Area decision payload

The current `/api/safety/intelligence` response is already rich, but the page needs a more user-facing shape above it.

Recommended additions to the area decision payload:

- `area_summary`
  - one-line plain-English summary
- `positive_signals`
  - short list of things that work well here
- `watchouts`
  - short list of things to think about
- `travel_context`
  - university, town, and station convenience
- `value_context`
  - rent signal, HMO signal, nearby property availability
- `nearby_alternatives`
  - suggested areas for compare-later flow
- `official_local_context`
  - neighbourhood name, priorities, optional events/team
- `data_freshness`
  - latest month, coverage note, optional caveats

These additions should be assembled from existing SurreyNest data first, then enriched with Police.uk where relevant.

### Explorer payload

The area explorer should remain lightweight and quick to scan.

Recommended explorer payload fields:

- postcode sector
- short summary line
- safety score
- one positive tag
- one caution tag
- travel convenience hint
- value hint
- property count

This avoids pushing full area-report payloads into the explorer surface.

### Data flow

The intended data flow is:

1. user opens `/safety`
2. explorer returns area summaries
3. user selects one area
4. area page loads full decision payload
5. user optionally adds nearby areas to compare
6. user moves into property exploration for the chosen area

That flow keeps the first response fast, keeps the page readable, and creates a natural bridge from area research into property decisions.

## Content and Language Rules

Every area page should follow these writing rules:

- explain meaning before showing raw numbers
- prefer short sentences
- use headings that sound like user questions
- balance positives and caution points
- avoid jargon unless expanded immediately

Preferred language examples:

- "What happens here most often?"
- "How this area has been changing"
- "What students should know"
- "Why this area works"
- "Things to think about"

Avoid or minimize:

- "methodology" at the top
- "weighted incidents"
- "crime taxonomy"
- "comparative risk profile"

## Visual Design Direction

The safety experience should stay inside SurreyNest's existing visual system.

Existing brand cues to keep:

- `primary` amber `#ea871d`
- warm orange-to-amber hero gradients
- soft off-white background
- glassmorphism cards and subtle glow treatment
- rounded, approachable card shapes

### Safety Score Styling

The safety score should be brought closer to the current SurreyNest palette.

Recommended changes:

- use SurreyNest amber as the dominant safety accent
- reduce harsh red/green contrast
- use a warm brand-consistent scale for the gauge ring and badges
- keep semantic meaning in copy and icon treatment, not only in color

Recommended feel:

- high score: primary amber with light halo and supportive copy
- mid score: darker amber / bronze
- low score: terracotta / burnt orange, not bright error red

This keeps the component readable while making it feel native to the rest of the product.

### Section Styling

Top-of-page sections should visually separate:

- balanced positives
- watch-outs
- travel and convenience
- value and availability

Do this with:

- icon-led cards
- short summaries
- calm background tints
- very limited chart exposure above the fold

## Responsive Behaviour

### Mobile

- one main story flow
- important summary and positives above charts
- compare tray opens after first area is understood
- no dense side-by-side tables

### Desktop

- hero with summary plus score
- balanced cards in compact grids
- explorer or summary panel beside map where useful
- two-column deep-dive content lower on the page

## Accessibility

- do not rely on color alone to communicate score quality
- keep summaries readable at a glance
- use plain labels, not abbreviations
- maintain strong contrast on amber surfaces
- provide descriptive button and section titles
- ensure comparison and explorer interactions work cleanly on keyboard and touch

## Error Handling

- if optional Police.uk enrichments are unavailable, hide the section rather than showing broken placeholders
- if data is old, show the latest month clearly
- if an area has limited data, explain that calmly in plain English
- if map data fails, keep the page usable through cards and search

## Testing Strategy

The redesigned experience should be validated against:

- mobile reading flow
- desktop scannability
- comprehension for non-technical users
- graceful handling of missing optional Police.uk datasets
- accessibility of score and comparison components
- clear handoff from area page to property exploration

## Rollout Recommendation

### Phase 1: Reframe the existing safety pages

- redesign `/safety/:postcode` into the new area decision page
- move charts lower
- add balanced summary sections
- brand-align the safety score
- improve property handoff

### Phase 2: Turn `/safety` into a stronger explorer

- activate the explorer surface
- improve area selection flow
- add single-first compare-later interaction

### Phase 3: Add Police.uk enrichments

- add freshness
- add outcome profile
- add local police neighbourhood context and priorities

This sequencing gives SurreyNest a visibly better user experience quickly while keeping the richer explorer and public-data context aligned with the same design.

## Design Outcome

After this redesign, SurreyNest's safety experience should feel like:

- an area guide
- a decision-support tool
- a trustworthy public-data explainer

It should no longer feel like a crime page that happens to sit next to property information.

It should feel like a user-friendly area intelligence product built specifically to help people make better property decisions.
