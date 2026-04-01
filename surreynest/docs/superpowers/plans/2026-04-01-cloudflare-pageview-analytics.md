# Cloudflare Pageview Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Microsoft Clarity and its consent UI with a lightweight Cloudflare Web Analytics pageview integration for SurreyNest.

**Architecture:** The frontend will switch from a Clarity-specific analytics stack to a small generic pageview loader that injects Cloudflare Web Analytics only on `surreynest.uk` and `www.surreynest.uk`. We will delete the Clarity consent/banner state entirely, simplify the About privacy copy, update build-time env plumbing from `VITE_CLARITY_PROJECT_ID` to `VITE_CLOUDFLARE_ANALYTICS_TOKEN`, and then finish with a Render env/CSP update plus a production smoke check.

**Tech Stack:** React 18, React Router, Vite, Vitest, Testing Library, Tailwind CSS, Render static site hosting

---

### Task 1: Replace the Clarity Tests With Cloudflare Pageview Tests

**Files:**
- Delete: `frontend/src/services/__tests__/clarity.test.jsx`
- Delete: `frontend/src/components/__tests__/ClarityAnalytics.test.jsx`
- Delete: `frontend/src/components/__tests__/CookieConsentBanner.test.jsx`
- Create: `frontend/src/services/__tests__/analytics.test.jsx`
- Create: `frontend/src/components/__tests__/PageviewAnalytics.test.jsx`
- Modify: `frontend/src/__tests__/About.test.jsx`
- Test: `frontend/src/services/__tests__/analytics.test.jsx`
- Test: `frontend/src/components/__tests__/PageviewAnalytics.test.jsx`
- Test: `frontend/src/__tests__/About.test.jsx`

- [ ] **Step 1: Write the new failing service test for the Cloudflare loader**

Create `frontend/src/services/__tests__/analytics.test.jsx` with assertions for:
- missing token -> loader returns `false`
- disallowed hostname such as `localhost` -> loader returns `false`
- allowed host + token -> injects exactly one script with `src="https://static.cloudflareinsights.com/beacon.min.js"`
- injected script includes `data-cf-beacon` JSON with the real token and `"spa":true`

Use this test structure:

```jsx
import { beforeEach, describe, expect, it } from 'vitest'
import {
    PAGEVIEW_ANALYTICS_SCRIPT_ID,
    ensurePageviewAnalyticsLoaded,
} from '../analytics'

describe('ensurePageviewAnalyticsLoaded', () => {
    beforeEach(() => {
        document.head.innerHTML = ''
        document.body.innerHTML = ''
    })

    it('does nothing when the analytics token is missing', () => {
        expect(
            ensurePageviewAnalyticsLoaded({
                token: '',
                hostname: 'surreynest.uk',
                doc: document,
            })
        ).toBe(false)
    })

    it('injects the Cloudflare beacon only once for an allowed host', () => {
        expect(
            ensurePageviewAnalyticsLoaded({
                token: 'demo-token',
                hostname: 'surreynest.uk',
                doc: document,
            })
        ).toBe(true)

        expect(
            ensurePageviewAnalyticsLoaded({
                token: 'demo-token',
                hostname: 'surreynest.uk',
                doc: document,
            })
        ).toBe(true)

        const scripts = document.querySelectorAll(`#${PAGEVIEW_ANALYTICS_SCRIPT_ID}`)
        expect(scripts).toHaveLength(1)
        expect(scripts[0].getAttribute('src')).toBe('https://static.cloudflareinsights.com/beacon.min.js')
        expect(scripts[0].getAttribute('data-cf-beacon')).toContain('"token":"demo-token"')
        expect(scripts[0].getAttribute('data-cf-beacon')).toContain('"spa":true')
    })
})
```

- [ ] **Step 2: Write the failing component test for the new analytics mount**

Create `frontend/src/components/__tests__/PageviewAnalytics.test.jsx` with a router harness that verifies:
- the analytics component calls `ensurePageviewAnalyticsLoaded` on initial load
- client-side navigation does not break routing
- repeated route changes do not require consent helpers or route-tag APIs

Use this mock shape:

```jsx
vi.mock('../../services/analytics', () => ({
    ensurePageviewAnalyticsLoaded: vi.fn(),
}))
```

And assert:

```jsx
expect(ensurePageviewAnalyticsLoaded).toHaveBeenCalledTimes(1)
await user.click(screen.getByRole('link', { name: 'About' }))
expect(await screen.findByText('About Page')).toBeInTheDocument()
expect(ensurePageviewAnalyticsLoaded).toHaveBeenCalledTimes(2)
```

- [ ] **Step 3: Rewrite the About test around lightweight pageview analytics**

Update `frontend/src/__tests__/About.test.jsx` so it expects:
- `Microsoft Clarity` text is gone
- `Allow analytics` / `Turn off analytics` buttons are gone
- privacy section now mentions lightweight pageview analytics
- the professional Guildford-focused anchors still exist

Use these core assertions:

```jsx
expect(screen.queryByText(/Microsoft Clarity/i)).not.toBeInTheDocument()
expect(screen.queryByRole('button', { name: 'Allow analytics' })).not.toBeInTheDocument()
expect(screen.queryByRole('button', { name: 'Turn off analytics' })).not.toBeInTheDocument()
expect(screen.getByText(/lightweight pageview analytics/i)).toBeInTheDocument()
```

- [ ] **Step 4: Run the targeted tests to verify the red state**

Run:

```bash
cd /Users/ajinkyabhuse/Downloads/Aj\ Projects/surreynest/frontend
npm test -- src/services/__tests__/analytics.test.jsx src/components/__tests__/PageviewAnalytics.test.jsx src/__tests__/About.test.jsx
```

Expected:
- FAIL because the Cloudflare analytics files do not exist yet
- FAIL because the About page still renders Clarity/privacy-control UI

### Task 2: Implement the Cloudflare Pageview Loader and Remove Clarity Code

**Files:**
- Delete: `frontend/src/services/clarity.js`
- Delete: `frontend/src/components/ClarityAnalytics.jsx`
- Delete: `frontend/src/components/CookieConsentBanner.jsx`
- Delete: `frontend/src/components/AnalyticsConsentControls.jsx`
- Delete: `frontend/src/hooks/useAnalyticsConsent.js`
- Create: `frontend/src/services/analytics.js`
- Create: `frontend/src/components/PageviewAnalytics.jsx`
- Modify: `frontend/src/App.jsx`
- Test: `frontend/src/services/__tests__/analytics.test.jsx`
- Test: `frontend/src/components/__tests__/PageviewAnalytics.test.jsx`

- [ ] **Step 1: Create the new analytics service**

Create `frontend/src/services/analytics.js` with this implementation shape:

```jsx
const ALLOWED_ANALYTICS_HOSTS = new Set(['surreynest.uk', 'www.surreynest.uk'])

export const PAGEVIEW_ANALYTICS_SCRIPT_ID = 'surreynest-cloudflare-analytics'

function getDefaultAnalyticsToken() {
    return import.meta.env.VITE_CLOUDFLARE_ANALYTICS_TOKEN?.trim() || ''
}

export function shouldEnablePageviewAnalytics({
    token = getDefaultAnalyticsToken(),
    hostname = typeof window !== 'undefined' ? window.location.hostname : '',
} = {}) {
    return Boolean(token) && ALLOWED_ANALYTICS_HOSTS.has(hostname)
}

export function ensurePageviewAnalyticsLoaded({
    token = getDefaultAnalyticsToken(),
    hostname = typeof window !== 'undefined' ? window.location.hostname : '',
    doc = typeof document !== 'undefined' ? document : null,
} = {}) {
    if (!doc || !shouldEnablePageviewAnalytics({ token, hostname })) {
        return false
    }

    if (doc.getElementById(PAGEVIEW_ANALYTICS_SCRIPT_ID)) {
        return true
    }

    const script = doc.createElement('script')
    script.id = PAGEVIEW_ANALYTICS_SCRIPT_ID
    script.defer = true
    script.src = 'https://static.cloudflareinsights.com/beacon.min.js'
    script.setAttribute('data-cf-beacon', JSON.stringify({ token, spa: true }))
    doc.head.appendChild(script)

    return true
}
```

- [ ] **Step 2: Create the new top-level pageview component**

Create `frontend/src/components/PageviewAnalytics.jsx`:

```jsx
import React from 'react'
import { useLocation } from 'react-router-dom'
import { ensurePageviewAnalyticsLoaded } from '../services/analytics'

export default function PageviewAnalytics() {
    const location = useLocation()

    React.useEffect(() => {
        ensurePageviewAnalyticsLoaded()
    }, [location.pathname, location.search])

    return null
}
```

This keeps the mount router-aware, but does not carry over Clarity-specific route tagging or consent behavior.

- [ ] **Step 3: Swap the app shell to the new component and remove the banner mount**

Update `frontend/src/App.jsx`:
- replace `ClarityAnalytics` import with `PageviewAnalytics`
- remove `CookieConsentBanner` import
- mount `<PageviewAnalytics />`
- delete the trailing `<CookieConsentBanner />`

The relevant diff should look like:

```jsx
import PageviewAnalytics from './components/PageviewAnalytics'

<BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <ScrollToTop />
    <PageviewAnalytics />
    <div className="flex flex-col min-h-screen">
```

- [ ] **Step 4: Run the targeted analytics tests to verify they pass**

Run:

```bash
cd /Users/ajinkyabhuse/Downloads/Aj\ Projects/surreynest/frontend
npm test -- src/services/__tests__/analytics.test.jsx src/components/__tests__/PageviewAnalytics.test.jsx
```

Expected:
- PASS

### Task 3: Remove the Clarity UI and Simplify the Privacy Copy

**Files:**
- Modify: `frontend/src/pages/About.jsx`
- Modify: `frontend/src/__tests__/About.test.jsx`
- Test: `frontend/src/__tests__/About.test.jsx`

- [ ] **Step 1: Remove the consent-control import and rendered block**

Delete this import from `frontend/src/pages/About.jsx`:

```jsx
import AnalyticsConsentControls from '../components/AnalyticsConsentControls'
```

Delete this render line from the privacy section:

```jsx
<AnalyticsConsentControls />
```

- [ ] **Step 2: Replace the Clarity copy with lightweight pageview wording**

Update the privacy section paragraph to this wording:

```jsx
<p className="mt-3 text-sm leading-6 text-slate-600">
    SurreyNest uses lightweight pageview analytics to understand overall visits,
    popular pages, and basic traffic patterns so we can improve the product.
    This setup is intentionally limited and does not use session replay tooling.
</p>
```

- [ ] **Step 3: Run the About test to verify the UI cleanup passes**

Run:

```bash
cd /Users/ajinkyabhuse/Downloads/Aj\ Projects/surreynest/frontend
npm test -- src/__tests__/About.test.jsx
```

Expected:
- PASS

### Task 4: Replace the Build-Time Analytics Config and Remove Clarity Env Usage

**Files:**
- Modify: `frontend/.env.example`
- Modify: `.env.production.example`
- Modify: `frontend/Dockerfile`
- Modify: `docker-compose.prod.yml`

- [ ] **Step 1: Replace the frontend env variable in the example files**

Update `frontend/.env.example`:

```env
# Optional Cloudflare Web Analytics token for production visitor analytics
VITE_CLOUDFLARE_ANALYTICS_TOKEN=
```

Update `.env.production.example`:

```env
# Frontend build config
# Leave blank to use same-origin /api via the frontend Nginx proxy.
VITE_API_URL=
VITE_CLOUDFLARE_ANALYTICS_TOKEN=
```

- [ ] **Step 2: Replace the Docker build arg/env names**

Update `frontend/Dockerfile`:

```dockerfile
ARG VITE_CLOUDFLARE_ANALYTICS_TOKEN=
ENV VITE_CLOUDFLARE_ANALYTICS_TOKEN=${VITE_CLOUDFLARE_ANALYTICS_TOKEN}
```

Update `docker-compose.prod.yml`:

```yaml
frontend:
  build:
    context: ./frontend
    dockerfile: Dockerfile
    args:
      VITE_API_URL: ${VITE_API_URL:-}
      VITE_CLOUDFLARE_ANALYTICS_TOKEN: ${VITE_CLOUDFLARE_ANALYTICS_TOKEN:-}
```

- [ ] **Step 3: Verify that no repo files still reference Clarity**

Run:

```bash
cd /Users/ajinkyabhuse/Downloads/Aj\ Projects/surreynest
rg -n "clarity|VITE_CLARITY|CookieConsentBanner|AnalyticsConsentControls|useAnalyticsConsent" frontend .env.production.example docker-compose.prod.yml
```

Expected:
- no matches in tracked frontend/config files after the swap

### Task 5: Verify Locally, Update Render, and Smoke-Test Production

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

- [ ] **Step 2: Run both build variants**

Run:

```bash
cd /Users/ajinkyabhuse/Downloads/Aj\ Projects/surreynest/frontend
npm run build
VITE_CLOUDFLARE_ANALYTICS_TOKEN=demo-token npm run build
```

Expected:
- both builds PASS

- [ ] **Step 3: Commit the repo changes**

```bash
cd /Users/ajinkyabhuse/Downloads/Aj\ Projects/surreynest
git add frontend/src/services/analytics.js frontend/src/components/PageviewAnalytics.jsx frontend/src/App.jsx frontend/src/pages/About.jsx frontend/src/__tests__/About.test.jsx frontend/src/services/__tests__/analytics.test.jsx frontend/src/components/__tests__/PageviewAnalytics.test.jsx frontend/.env.example .env.production.example frontend/Dockerfile docker-compose.prod.yml
git add -u frontend/src/services/clarity.js frontend/src/components/ClarityAnalytics.jsx frontend/src/components/CookieConsentBanner.jsx frontend/src/components/AnalyticsConsentControls.jsx frontend/src/hooks/useAnalyticsConsent.js frontend/src/services/__tests__/clarity.test.jsx frontend/src/components/__tests__/ClarityAnalytics.test.jsx frontend/src/components/__tests__/CookieConsentBanner.test.jsx
git commit -m "Replace Clarity with Cloudflare pageview analytics"
```

Expected:
- implementation committed after tests and build pass

- [ ] **Step 4: Create the Cloudflare Web Analytics property**

In the Cloudflare dashboard:
- open Web Analytics
- add `surreynest.uk`
- copy the site token that Cloudflare generates for this property

Expected:
- one real token string available for the Render frontend env

- [ ] **Step 5: Update the Render frontend environment and remove the Clarity env**

Set the frontend service env:
- add `VITE_CLOUDFLARE_ANALYTICS_TOKEN` to the exact token copied from Cloudflare
- remove `VITE_CLARITY_PROJECT_ID`

For the current frontend service ID `srv-d763cvtm5p6s73dofnc0`, verify the env set from the Render dashboard after saving:

```bash
curl -sS https://api.render.com/v1/services/srv-d763cvtm5p6s73dofnc0/env-vars \
  -H "Authorization: Bearer $RENDER_API_KEY"
```

Expected:
- response contains `VITE_CLOUDFLARE_ANALYTICS_TOKEN`
- response no longer contains `VITE_CLARITY_PROJECT_ID`

- [ ] **Step 6: Update the Render static-site CSP manually**

In the Render dashboard for `surreynest-web`, replace the current Clarity-oriented policy with a Cloudflare-oriented one:

```text
default-src 'self'; base-uri 'self'; frame-ancestors 'none'; object-src 'none'; script-src 'self' https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; connect-src 'self' https://surreynest-api.onrender.com https://api.surreynest.uk https://api.postcodes.io https://cloudflareinsights.com
```

Expected:
- Clarity domains and `c.bing.com` removed from CSP
- Cloudflare analytics script/connect domains allowed

- [ ] **Step 7: Trigger and verify the production deploy**

Run:

```bash
cd /Users/ajinkyabhuse/Downloads/Aj\ Projects/surreynest
git push origin main
curl -sS -X POST https://api.render.com/v1/services/srv-d763cvtm5p6s73dofnc0/deploys \
  -H "Authorization: Bearer $RENDER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Expected:
- Render frontend deploy enters `build_in_progress`, then `live`

- [ ] **Step 8: Smoke-test the live bundle**

Run:

```bash
html=$(curl -sS https://surreynest.uk)
asset=$(printf '%s' "$html" | grep -o '/assets/index-[^"]*\.js' | head -1)
curl -sSI https://surreynest.uk
curl -sS "https://surreynest.uk$asset" | rg "static.cloudflareinsights.com|beacon.min.js"
curl -sS "https://surreynest.uk$asset" | rg "clarity.ms|consentv2|w51txpgves"
```

Expected:
- homepage returns `200`
- CSP contains `https://static.cloudflareinsights.com` and `https://cloudflareinsights.com`
- bundle contains the Cloudflare beacon
- bundle does **not** contain `clarity.ms`, `consentv2`, or the old Clarity project ID `w51txpgves`
