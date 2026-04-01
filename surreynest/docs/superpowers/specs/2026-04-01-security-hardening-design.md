# Security Hardening Design

Date: 2026-04-01
Product: SurreyNest
Scope: Reduce practical attack surface in the live web app by removing risky public fetch behavior, tightening public response exposure, and adding baseline browser-facing security headers without changing the core product experience.

## Summary

SurreyNest should be treated as a public web app, not as a system that can ever be declared "fully protected."

The right goal for this iteration is not perfection. It is meaningful hardening of the highest-risk public surfaces already identified in the deployed app.

This security pass will:

- remove remote listing URL fetching from public user flows
- keep listing analysis available through manual postcode and listing text input
- add baseline HTTP security headers for the frontend and backend
- reduce unnecessary public infrastructure disclosure from the health endpoint
- preserve existing search, property, safety, review, and internal admin functionality

## Root Cause

The current app has a decent baseline, but several public-facing choices increase risk more than they need to:

- `/api/listings/check` can fetch remote URLs supplied by users, which creates unnecessary SSRF-style exposure even with domain checks
- the live app is missing common browser security headers such as HSTS, CSP, frame restrictions, referrer policy, and permissions policy
- `/health?deep=true` publicly reveals production component status that is useful for operations but not needed by anonymous visitors

None of these issues imply that the database or backend source is currently "open to the world." They do mean the app is not yet hardened enough for a strong security claim.

## Goals

- Remove the riskiest public request path from production behavior
- Keep the listing-checker feature usable through safer manual input
- Add standard browser-facing hardening headers on both frontend and backend responses
- Limit public operational detail exposure
- Preserve the current product routes and user-facing core flows
- Avoid introducing a large refactor or auth system just for this pass

## Non-Goals

- No promise of absolute security
- No full auth/authorization redesign
- No WAF, DDoS platform migration, or infrastructure re-architecture
- No private network redesign for Render services in this iteration
- No rewrite of all public endpoints
- No removal of the internal admin key pattern in this pass

## Recommended Approach

Use a focused application hardening bundle.

### 1. Remove public remote listing fetch behavior

The strongest improvement is to stop the backend from visiting third-party listing URLs on behalf of anonymous users.

Design changes:

- keep the listing checker route, but require manual postcode input
- continue accepting optional manual listing text supplied by the user
- reject requests that rely on backend URL scraping/fetching
- update UI copy so the feature clearly asks for manual postcode and pasted listing details

Why this is the recommendation:

- it removes the highest-risk public attack surface outright
- it is easier to reason about than trying to perfectly harden redirects, DNS resolution, IP filtering, response size limits, and hostile third-party behavior
- it preserves the feature's core value for users

### 2. Add baseline security headers

SurreyNest should emit a practical baseline set of response headers from the app layer where possible.

Target headers:

- `Strict-Transport-Security`
- `Content-Security-Policy`
- `X-Frame-Options`
- `Referrer-Policy`
- `Permissions-Policy`
- continue `X-Content-Type-Options`

Design direction:

- add middleware in the FastAPI app for backend responses
- add equivalent static header handling for the frontend hosting path where repo/deploy setup allows it
- use a conservative CSP that supports the current frontend and map stack instead of a fake "strict" policy that breaks production

### 3. Reduce public health endpoint disclosure

The public health endpoint should still support uptime checks without advertising internal readiness details to anonymous callers.

Design changes:

- keep `/health` public with a minimal `status` response
- gate the deep health check behind the internal admin key, or remove public deep diagnostics entirely
- preserve enough health behavior for Render uptime and deployment checks

### 4. Preserve and clarify internal-only controls

The existing `X-Internal-Admin-Key` mechanism is appropriate for this app's current internal admin routes.

Design changes:

- keep internal routes protected by the shared secret dependency
- ensure sensitive ops endpoints do not leak extra detail on auth failure
- avoid exposing internal-only instructions in public UI or docs

### 5. Keep abuse limits on public write endpoints

The public review and listing-analysis flows should remain limited even after the listing checker becomes manual-only.

Design changes:

- keep current rate limiting
- verify the listing checker remains rate-limited after the behavior change
- keep anonymous review creation moderated and rate-limited

## Files In Scope

- `backend/app/main.py`
- `backend/app/routers/listings.py`
- `backend/app/routers/pipelines.py`
- `backend/app/services/internal_admin.py`
- `backend/tests/`
- `frontend/src/pages/CheckListing.jsx`
- `frontend/src/components/`
- frontend hosting/deploy config files if needed for static security headers

Possible deploy/config touch points if implementation requires them:

- `frontend/vite.config.js`
- `frontend/public/`
- Render service configuration or redirect/header config tracked in repo

## Validation Plan

### Automated

- add backend tests proving the listing checker no longer performs remote fetches for public requests
- add backend tests proving protected health diagnostics require the internal admin key
- add backend tests for the security headers middleware
- update frontend tests for manual-only listing-checker copy and behavior
- run targeted backend and frontend tests
- run full backend test suite
- run frontend test suite
- run frontend production build

### Production Verification

Verify against the deployed domains that:

- listing checker no longer triggers third-party fetch behavior
- public `/health` stays minimal
- protected diagnostics reject unauthenticated callers
- frontend and backend responses include the intended security headers
- normal user flows for search, property detail, safety, and reviews still work

## Success Criteria

- Anonymous users can no longer cause SurreyNest to fetch arbitrary listing pages
- Listing analysis still works through manual input
- Public health no longer exposes deep component detail
- The live app sends baseline browser security headers
- Internal admin endpoints remain protected
- Existing product behavior remains intact outside the intentional listing-checker UX change

## Risks And Tradeoffs

- Removing automatic listing URL scraping is a UX downgrade for convenience, but a net win for security and maintainability
- CSP can break frontend assets or maps if written too aggressively, so implementation must be tested against the real production app
- This pass materially hardens the app, but it does not eliminate all classes of attack

## Recommendation

Proceed with this hardening pass, then make the GitHub repository private after verifying both Render services can still deploy from the private repo.
