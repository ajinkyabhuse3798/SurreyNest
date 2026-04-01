# Cloudflare Pageview Analytics Design

## Summary

Replace Microsoft Clarity with a lightweight Cloudflare Web Analytics integration for SurreyNest. The goal is to keep only simple hosted visitor analytics such as page views, top pages, referrers, countries, and basic performance, while removing session replay behavior, consent-banner UI, and consent-state management from the app.

## Goals

- Remove Clarity and all session-replay-oriented analytics behavior.
- Remove the analytics consent banner and privacy controls added for Clarity.
- Add a minimal frontend-only Cloudflare Web Analytics loader that only runs on production SurreyNest hostnames.
- Keep local development and preview environments free of analytics by default.
- Update visible privacy copy so it accurately describes lightweight pageview analytics instead of Clarity.

## Non-Goals

- No backend analytics endpoints or database changes.
- No custom event taxonomy, funnels, or product analytics.
- No new consent banner or cookie preferences UI for this pass.
- No DNS or hosting migration to Cloudflare.

## Recommended Approach

Use Cloudflare Web Analytics as the single analytics integration for SurreyNest.

Why this approach:

- It is free and hosted.
- It is materially lighter than Clarity.
- It aligns with the user's preference for simple visitor counts rather than session recordings.
- It lets us delete more code than we add.

## User Experience

- Visitors should no longer see the analytics consent banner.
- The About page privacy section should describe lightweight pageview analytics in plain language.
- There should be no user-facing analytics preference toggle in the UI.

## Technical Design

### Frontend analytics loader

Replace the current Clarity service logic with a Cloudflare-specific loader module.

Behavior:

- Load only when a Cloudflare site token is configured.
- Load only on `surreynest.uk` and `www.surreynest.uk`.
- Do not run on localhost, preview hosts, or local test runs unless explicitly configured.
- Inject the Cloudflare analytics script only once.

The existing top-level analytics component pattern can stay, but it should become a much smaller wrapper around a pageview-only loader.

### SPA navigation behavior

SurreyNest is a React single-page app, so the integration should preserve a small route-aware wrapper. The wrapper should ensure analytics is initialized once and remains stable across client-side route changes. If Cloudflare only needs the script present, route changes should not add extra tracking code beyond what is necessary for SPA pageview visibility.

### Privacy copy

The About page privacy section should:

- remove Microsoft Clarity references
- remove wording about session behaviour or replay-style analytics
- state that SurreyNest uses lightweight pageview analytics to understand visits and popular pages

### Deployment config

Replace the frontend env variable used for Clarity with a Cloudflare token variable.

Expected frontend env shape:

- `VITE_CLOUDFLARE_ANALYTICS_TOKEN`

The frontend example env files and production example env file should be updated to reflect the new token name.

## Files Expected To Change

- `frontend/src/services/clarity.js`
  - replace with Cloudflare loader logic or rename to a more generic analytics service if that is cleaner
- `frontend/src/components/ClarityAnalytics.jsx`
  - replace or rename to a lightweight pageview analytics component
- `frontend/src/components/CookieConsentBanner.jsx`
  - delete
- `frontend/src/components/AnalyticsConsentControls.jsx`
  - delete
- `frontend/src/hooks/useAnalyticsConsent.js`
  - delete
- `frontend/src/App.jsx`
  - swap the mounted analytics component and remove the banner mount
- `frontend/src/pages/About.jsx`
  - update privacy copy and remove consent controls
- `frontend/src/services/__tests__/clarity.test.jsx`
  - replace with tests for the Cloudflare loader
- `frontend/src/components/__tests__/ClarityAnalytics.test.jsx`
  - replace with tests for the new pageview analytics component
- `frontend/src/components/__tests__/CookieConsentBanner.test.jsx`
  - delete
- `frontend/src/__tests__/About.test.jsx`
  - update privacy assertions
- `frontend/.env.example`
  - replace Clarity env var with Cloudflare token env var
- `.env.production.example`
  - replace Clarity env var with Cloudflare token env var
- any deploy config currently referencing `VITE_CLARITY_PROJECT_ID`
  - update to the Cloudflare token name

## Public Interfaces

- No backend API changes.
- No database schema changes.
- No new public routes.
- One frontend env variable changes:
  - from `VITE_CLARITY_PROJECT_ID`
  - to `VITE_CLOUDFLARE_ANALYTICS_TOKEN`

## Testing Strategy

### Frontend tests

- Verify the analytics loader does nothing when the token is missing.
- Verify the analytics loader does nothing on disallowed hostnames.
- Verify the Cloudflare script is injected only once.
- Verify the app no longer renders the consent banner.
- Verify the About page no longer shows Clarity-specific copy or consent controls.

### Verification commands

- `npm test`
- `npm run build`
- `VITE_CLOUDFLARE_ANALYTICS_TOKEN=<token> npm run build`

### Live verification

- Confirm `surreynest.uk` serves the new frontend bundle.
- Confirm the live bundle no longer contains Clarity identifiers such as `clarity.ms`, `consentv2`, or the Clarity project ID.
- Confirm the live bundle contains the Cloudflare analytics loader/token.

## Risks And Mitigations

### Risk: leftover Clarity code or env config remains active

Mitigation:

- remove the banner, consent hook, and Clarity-specific env usage entirely
- verify the production bundle for absence of Clarity strings

### Risk: Cloudflare analytics requires one manual dashboard step

Mitigation:

- document clearly that the Cloudflare site token must be created outside the repo and set in Render before production analytics becomes active

## Manual Step Outside The Repo

Create a Cloudflare Web Analytics property for `surreynest.uk` and provide the token/site ID needed by the frontend env variable. Code changes alone cannot create the Cloudflare analytics property.

## References

- Cloudflare Web Analytics overview: `https://developers.cloudflare.com/web-analytics/about/`
- Cloudflare Web Analytics setup: `https://developers.cloudflare.com/web-analytics/get-started/`
