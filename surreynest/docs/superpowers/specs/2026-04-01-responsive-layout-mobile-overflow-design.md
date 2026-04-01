# Responsive Layout Mobile Overflow Design

Date: 2026-04-01
Product: SurreyNest
Scope: Fix mobile horizontal scrolling and tighten responsive presentation without changing functionality, routes, or data behavior.

## Summary

SurreyNest should keep its current visual personality on desktop while removing accidental horizontal scrolling and cramped edge cases on mobile.

The work will stay UI-only:

- no route changes
- no API changes
- no state or behavior changes
- no copy rewrites beyond what layout requires

The main outcome is a cleaner responsive shell where the app feels intentional on phones and remains polished on desktop.

## Root Cause

The live Render frontend reproduces mobile overflow on the home route.

Observed evidence from a mobile-sized browser run against `https://surreynest-web.onrender.com`:

- `/` expands wider than the viewport
- `/search`, `/safety`, `/rights`, and `/about` do not create page-level horizontal scroll
- the strongest home-page offenders are the rotated map teaser card in `ExploreSection` and decorative off-canvas circles used in home safety teaser art

This means the issue is not search functionality. It is layout containment.

## Goals

- Remove horizontal page scrolling on mobile
- Preserve the current feature set and app behavior
- Keep the desktop composition visually rich
- Make decorative layers feel contained instead of spilling outside their sections
- Improve general layout resilience so future UI polish is less likely to reintroduce overflow

## Non-Goals

- No redesign of the product structure
- No changes to search, safety, or property logic
- No removal of branded decorative elements entirely
- No broad visual rewrite of every page in the app

## Recommended Approach

Use a targeted responsive cleanup rather than a broad redesign.

### 1. Add a light global horizontal overflow guard

Apply a safe page-level guard in the global stylesheet so accidental decorative spill cannot make the app horizontally scroll.

Intent:

- clip stray visual overflow at the document level
- avoid interfering with intentional local horizontal scrollers such as tables that already use `overflow-x-auto`

### 2. Fix the home-page offenders at the source

Update the home route sections that currently extend past the viewport:

- `ExploreSection`
- `GuildfordSafetySection`

Design changes:

- keep section wrappers clipped
- reduce or disable rotation on small screens where it adds width pressure
- keep the rotated/expressive treatment for larger breakpoints
- ensure decorative circles and ambient art stay visually inside the card boundaries

### 3. Tighten responsive composition without changing meaning

Where a card or section is visually aggressive on small screens:

- reduce transform intensity
- prefer centered or fully contained art
- keep spacing balanced so the mobile layout still feels premium, not just constrained

### 4. Preserve desktop character

Desktop should still feel layered and expressive:

- retain larger rotations and ornamental shapes at `lg+`
- keep existing two-column and card-based composition
- avoid flattening the visual language just to solve mobile issues

## Files In Scope

- `frontend/src/index.css`
- `frontend/src/components/home/ExploreSection.jsx`
- `frontend/src/components/home/GuildfordSafetySection.jsx`

Possible touch-ups only if verification shows they are still needed:

- `frontend/src/components/safety/SafetyHero.jsx`
- `frontend/src/pages/Home.jsx`

## Validation Plan

### Automated

- add a small regression test around the responsive containment classes for the affected home components
- run the targeted frontend test file
- run the frontend test suite
- run the production build

### Browser Verification

Verify on a mobile-sized viewport that:

- `/` has no horizontal page scroll
- `/search` still renders normally
- desktop layout still looks visually consistent

## Success Criteria

- Mobile users can no longer drag the home page sideways
- Search and other flows behave exactly as before
- Desktop retains the current premium feel
- The fix is localized and maintainable
