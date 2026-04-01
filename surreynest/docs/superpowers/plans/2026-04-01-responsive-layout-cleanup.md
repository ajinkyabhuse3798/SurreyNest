# Responsive Layout Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove mobile horizontal scrolling on the home page, make footer links land on real destinations, and replace academic-facing UI copy with professional Guildford-focused messaging.

**Architecture:** The fix stays entirely in the frontend. We will add regression coverage first, then tighten global overflow containment, adjust the home-page sections that currently spill outside the viewport, and expand the About/Footer information architecture so footer links point to real in-app sections.

**Tech Stack:** React 18, React Router, Tailwind CSS, Vitest, Testing Library, Vite

---

### Task 1: Lock in Footer and Brand Regressions

**Files:**
- Modify: `frontend/src/components/__tests__/Footer.test.jsx`
- Create: `frontend/src/__tests__/About.test.jsx`
- Test: `frontend/src/components/__tests__/Footer.test.jsx`
- Test: `frontend/src/__tests__/About.test.jsx`

- [ ] **Step 1: Write the failing footer and about-page tests**

Add assertions that:
- footer links point to real destinations such as `/about#faq`, `/about#contact`, `/about#privacy`, `/about#terms`
- footer no longer renders placeholder `href="#"` links
- footer no longer says `Built for students, by students`
- about page no longer says `final year MSc project`
- about page exposes anchored sections that match the footer navigation

- [ ] **Step 2: Run the targeted tests to verify they fail**

Run:

```bash
cd /Users/ajinkyabhuse/Downloads/Aj\ Projects/surreynest/frontend
npm test -- src/components/__tests__/Footer.test.jsx src/__tests__/About.test.jsx
```

Expected:
- FAIL because the footer still uses placeholder and generic links
- FAIL because the about page still contains academic wording and lacks the expected anchors

- [ ] **Step 3: Commit the red test state only if needed for checkpointing**

```bash
git status --short
```

Expected:
- test-only changes staged in working tree if a checkpoint is needed

### Task 2: Lock in Responsive Containment Regressions

**Files:**
- Create: `frontend/src/components/home/__tests__/ResponsiveSections.test.jsx`
- Test: `frontend/src/components/home/__tests__/ResponsiveSections.test.jsx`

- [ ] **Step 1: Write the failing responsive containment test**

Add assertions that:
- `ExploreSection` keeps its outer section clipped with `overflow-hidden`
- the rotated teaser card uses a mobile-safe transform instead of always rotating
- `GuildfordSafetySection` keeps its decorative layer inside a clipped wrapper

- [ ] **Step 2: Run the targeted responsive test to verify it fails**

Run:

```bash
cd /Users/ajinkyabhuse/Downloads/Aj\ Projects/surreynest/frontend
npm test -- src/components/home/__tests__/ResponsiveSections.test.jsx
```

Expected:
- FAIL because the current home sections do not expose the containment classes the test expects

### Task 3: Implement Footer Navigation and Professional Copy

**Files:**
- Modify: `frontend/src/components/Footer.jsx`
- Modify: `frontend/src/pages/About.jsx`
- Test: `frontend/src/components/__tests__/Footer.test.jsx`
- Test: `frontend/src/__tests__/About.test.jsx`

- [ ] **Step 1: Update the footer to use real destinations**

Implement:
- platform links that still point to live product routes
- resource/company links that point to matching About anchors
- removal of placeholder `href="#"` links or replacement with real destinations

- [ ] **Step 2: Expand the About page into anchorable sections**

Implement sections with stable IDs for:
- overview
- what-we-offer
- data-sources
- faq
- contact
- privacy
- terms

- [ ] **Step 3: Replace academic-facing copy**

Implement copy updates so that:
- footer brand copy is Guildford-focused and professional
- about page removes `final year MSc project`
- the UI presents SurreyNest as a professional web app for people living in Guildford

- [ ] **Step 4: Run the targeted tests to verify they pass**

Run:

```bash
cd /Users/ajinkyabhuse/Downloads/Aj\ Projects/surreynest/frontend
npm test -- src/components/__tests__/Footer.test.jsx src/__tests__/About.test.jsx
```

Expected:
- PASS

### Task 4: Implement Mobile Overflow Cleanup

**Files:**
- Modify: `frontend/src/index.css`
- Modify: `frontend/src/components/home/ExploreSection.jsx`
- Modify: `frontend/src/components/home/GuildfordSafetySection.jsx`
- Test: `frontend/src/components/home/__tests__/ResponsiveSections.test.jsx`

- [ ] **Step 1: Add a safe global overflow guard**

Implement a light global rule that clips accidental horizontal overflow without breaking intentional local horizontal scrollers.

- [ ] **Step 2: Make `ExploreSection` mobile-safe**

Implement:
- clipped outer section
- reduced or disabled rotation on small screens
- contained decorative art while preserving the stronger desktop composition

- [ ] **Step 3: Make `GuildfordSafetySection` mobile-safe**

Implement:
- clipped section/card boundaries
- decorative circles that stay visually inside the component on mobile
- preserved desktop richness at larger breakpoints

- [ ] **Step 4: Run the targeted responsive test to verify it passes**

Run:

```bash
cd /Users/ajinkyabhuse/Downloads/Aj\ Projects/surreynest/frontend
npm test -- src/components/home/__tests__/ResponsiveSections.test.jsx
```

Expected:
- PASS

### Task 5: Verify the Whole Frontend

**Files:**
- Verify only

- [ ] **Step 1: Run the full frontend test suite**

Run:

```bash
cd /Users/ajinkyabhuse/Downloads/Aj\ Projects/surreynest/frontend
npm test
```

Expected:
- PASS with zero failing tests

- [ ] **Step 2: Run the production build**

Run:

```bash
cd /Users/ajinkyabhuse/Downloads/Aj\ Projects/surreynest/frontend
npm run build
```

Expected:
- PASS with Vite build output

- [ ] **Step 3: Run a browser-level mobile overflow check**

Run a mobile-sized browser script against the local preview or deployed frontend to confirm:
- `/` no longer exceeds viewport width
- `/search?postcode=GU1%201AA&radius=1000` still behaves normally

Expected:
- home route width equals viewport width
- no page-level horizontal overflow on the checked routes

- [ ] **Step 4: Commit the implementation**

```bash
git add frontend/src/index.css frontend/src/components/home/ExploreSection.jsx frontend/src/components/home/GuildfordSafetySection.jsx frontend/src/components/Footer.jsx frontend/src/pages/About.jsx frontend/src/components/__tests__/Footer.test.jsx frontend/src/__tests__/About.test.jsx frontend/src/components/home/__tests__/ResponsiveSections.test.jsx docs/superpowers/plans/2026-04-01-responsive-layout-cleanup.md
git commit -m "Polish responsive layout and footer navigation"
```

Expected:
- implementation committed after tests and build pass
