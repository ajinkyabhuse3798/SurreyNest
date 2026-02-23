# SURREYNEST — DESIGN SYSTEM
## Add this entire section to the bottom of your CLAUDE.md

---

## Design System (read this before touching ANY frontend file)

### What we're going for
Inspired by Rightmove's clean information hierarchy and Super's floating card hero.
White background, bold but legible, search is the centrepiece on every key page.
Students on their phone at 11pm should be able to find and read everything instantly.

**NOT copying:** house photo heroes, dark navbars, complex tab navigation, anything heavy.

---

### Colour tokens (use only these — no others)

```
Background:     #FFFFFF  (white — everywhere, no grey panels)
Text primary:   #0A0A0A  (near-black — all body copy, headings)
Text secondary: #6B7280  (gray-500 — captions, metadata, placeholders)
Border:         #E5E7EB  (gray-200 — card borders, input borders, dividers)
Accent:         #4F46E5  (indigo-600 — buttons, links, active states, logo "Nest")
Accent hover:   #4338CA  (indigo-700 — hover state on accent elements)
Success:        #16A34A  (green-600 — good scores, licensed HMO badge)
Warning:        #D97706  (amber-600 — mid scores, expiring badges)
Danger:         #DC2626  (red-600 — poor scores, unlicensed badge)
Surface:        #F9FAFB  (gray-50 — ONLY for the hero section background, nowhere else)
```

**Tailwind equivalents:**
- `bg-white` everywhere
- `text-[#0A0A0A]` or `text-gray-950` for body
- `text-gray-500` for secondary text
- `border-gray-200` for all borders
- `bg-indigo-600` / `hover:bg-indigo-700` for accent
- `bg-gray-50` ONLY on the hero section

---

### Typography

**Font:** Inter — already in the project via Google Fonts import
```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');
body { font-family: 'Inter', sans-serif; }
```

**Scale (mobile → desktop):**
```
Page title (h1):   text-2xl font-semibold → md:text-4xl
Section title (h2): text-xl font-semibold  → md:text-2xl
Card title (h3):   text-base font-semibold → md:text-lg
Body:              text-sm leading-relaxed → md:text-base
Caption/label:     text-xs text-gray-500
```

**Rules:**
- font-semibold (600) only — never font-bold (700) or font-extrabold
- Never all-caps text
- Never decorative letter-spacing
- Line height: leading-relaxed on body, leading-tight on headings

---

### Logo

```jsx
// Use exactly this — never change it
<span className="text-xl font-semibold md:text-2xl">
  <span className="text-[#0A0A0A]">Surrey</span>
  <span className="text-indigo-600">Nest</span>
</span>
```

No icon. No house emoji. Just the wordmark. That's it.

---

### Navbar

**Mobile (< 768px):**
```
[SurreyNest logo]                    [Sign In]
```
Single row. Logo left, Sign In right. Nothing else visible.

**Desktop (md: and above):**
```
[SurreyNest logo]    [Search] [Rights Guide] [HMO Check]    [Sign In] [Register]
```

```jsx
<nav className="sticky top-0 z-50 bg-white border-b border-gray-200">
  <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between md:h-16">
    {/* Logo left */}
    <Logo />
    
    {/* Links — hidden on mobile */}
    <div className="hidden md:flex items-center gap-6 text-sm text-gray-600">
      <a href="/search" className="hover:text-gray-900 transition-colors">Search</a>
      <a href="/rights" className="hover:text-gray-900 transition-colors">Rights Guide</a>
      <a href="/hmo" className="hover:text-gray-900 transition-colors">HMO Check</a>
    </div>
    
    {/* Auth right */}
    <div className="flex items-center gap-2">
      <a href="/login" className="text-sm text-gray-600 hover:text-gray-900 px-3 py-2">Sign in</a>
      <a href="/register" className="text-sm bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors">Register</a>
    </div>
  </div>
</nav>
```

**Rules:**
- `sticky top-0 z-50` — always stays at top on scroll
- `border-b border-gray-200` — single pixel separator, no shadow
- Height: `h-14` mobile, `h-16` desktop
- No hamburger menu — just hide links on mobile

---

### Hero Section (Home page only)

Inspired by Rightmove's search-centred hero + Super's floating white card.
**No house photo. No full-width image. Clean and fast.**

```
[gray-50 background section]
  Big headline — left aligned on mobile, centred on desktop
  Subheadline in gray-500
  [White search card — rounded-2xl, border, p-6]
    Postcode input + radius dropdown + Search button
  Trust strip below: "12,000 Guildford properties · Updated monthly · Free to use"
```

```jsx
<section className="bg-gray-50 px-4 py-12 md:py-20">
  <div className="max-w-2xl mx-auto">
    
    {/* Headline */}
    <h1 className="text-2xl font-semibold text-[#0A0A0A] mb-2 md:text-4xl md:text-center">
      Find fair rent in Guildford
    </h1>
    <p className="text-sm text-gray-500 mb-8 md:text-base md:text-center">
      Check if your rent is fair, verify HMO licensing and see safety scores — all free.
    </p>
    
    {/* Floating search card */}
    <div className="bg-white rounded-2xl border border-gray-200 p-5 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row">
        <input
          type="text"
          placeholder="Enter a Guildford postcode e.g. GU2 7XH"
          className="flex-1 border border-gray-200 rounded-lg px-4 py-3 text-sm 
                     focus:outline-none focus:border-indigo-600 transition-colors"
        />
        <select className="border border-gray-200 rounded-lg px-3 py-3 text-sm 
                           text-gray-600 focus:outline-none focus:border-indigo-600 md:w-36">
          <option>Within 0.5km</option>
          <option>Within 1km</option>
          <option>Within 2km</option>
        </select>
        <button className="bg-indigo-600 text-white rounded-lg px-6 py-3 text-sm 
                           font-medium hover:bg-indigo-700 transition-colors">
          Search
        </button>
      </div>
    </div>
    
    {/* Trust strip */}
    <p className="text-xs text-gray-400 mt-4 text-center">
      12,000+ Guildford properties · Updated monthly · Completely free
    </p>
    
  </div>
</section>
```

---

### Property Cards (Search Results)

```
[border border-gray-200 rounded-xl p-4]
  Address (font-medium text-sm)
  Postcode + type (text-xs text-gray-500)
  ─────────────────────────────────
  [Score row]
    [● 82 Fair Rent]  [● 74 Safety]  [HMO: Licensed]
  ─────────────────────────────────
  [3 bed · Flat · EPC: C]          [View →]
```

Score dot colours:
- `bg-green-500` score ≥ 70
- `bg-amber-500` score 40–69
- `bg-red-500` score < 40

```jsx
// Score badge component
const ScoreDot = ({ score, label }) => {
  const colour = score >= 70 ? 'bg-green-500' 
               : score >= 40 ? 'bg-amber-500' 
               : 'bg-red-500'
  return (
    <span className="flex items-center gap-1.5 text-xs text-gray-700">
      <span className={`w-2 h-2 rounded-full ${colour} flex-shrink-0`} />
      {score} {label}
    </span>
  )
}

// Card
<div className="border border-gray-200 rounded-xl p-4 hover:border-gray-300 
                transition-colors cursor-pointer">
  <p className="text-sm font-medium text-[#0A0A0A]">{address}</p>
  <p className="text-xs text-gray-500 mt-0.5">{postcode} · {propertyType}</p>
  
  <div className="border-t border-gray-100 mt-3 pt-3 flex flex-wrap gap-3">
    <ScoreDot score={fairnessScore} label="Fair Rent" />
    <ScoreDot score={safetyScore} label="Safety" />
    <HMOBadge status={hmoStatus} />
  </div>
  
  <div className="border-t border-gray-100 mt-3 pt-3 flex items-center justify-between">
    <span className="text-xs text-gray-500">{rooms} bed · {type} · EPC: {rating}</span>
    <span className="text-xs font-medium text-indigo-600">View →</span>
  </div>
</div>
```

---

### HMO Badge

```jsx
const HMOBadge = ({ status }) => {
  const styles = {
    licensed:   'bg-green-50 text-green-700 border-green-200',
    expired:    'bg-amber-50 text-amber-700 border-amber-200',
    not_found:  'bg-gray-50 text-gray-500 border-gray-200',
  }
  const labels = {
    licensed:   '✓ HMO Licensed',
    expired:    '⚠ HMO Expired',
    not_found:  '— HMO Unknown',
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border ${styles[status]}`}>
      {labels[status]}
    </span>
  )
}
```

---

### Buttons

```jsx
// Primary — use for main action on any page
<button className="bg-indigo-600 text-white rounded-lg px-6 py-3 text-sm 
                   font-medium hover:bg-indigo-700 transition-colors">
  Search
</button>

// Secondary — use for secondary actions
<button className="border border-gray-200 text-gray-700 rounded-lg px-6 py-3 
                   text-sm font-medium hover:border-gray-300 hover:bg-gray-50 
                   transition-colors">
  Cancel
</button>

// Danger — use for destructive actions only
<button className="text-red-600 text-sm font-medium hover:text-red-700 
                   transition-colors">
  Delete review
</button>
```

**Rules:**
- Minimum height: `py-3` (48px touch target) on all interactive elements
- rounded-lg on buttons — not rounded-full, not rounded
- Never use disabled styling that makes text unreadable — use `opacity-50`

---

### Input Fields

```jsx
<input
  className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm
             placeholder:text-gray-400 focus:outline-none focus:border-indigo-600
             transition-colors"
/>

// With label (always label above, never placeholder as label)
<div className="flex flex-col gap-1.5">
  <label className="text-xs font-medium text-gray-700">Postcode</label>
  <input className="border border-gray-200 rounded-lg px-4 py-3 text-sm
                    focus:outline-none focus:border-indigo-600 transition-colors" />
</div>
```

---

### Page Layout (all pages)

```jsx
// Every page wraps content like this
<main className="min-h-screen bg-white">
  <Navbar />
  
  {/* Page content — max width centred */}
  <div className="max-w-5xl mx-auto px-4 py-8 md:py-12">
    {/* content */}
  </div>
</main>
```

**Max widths:**
- Search page (list + map): `max-w-6xl` (wider for two-column layout)
- All other pages: `max-w-2xl` (keeps text readable on large screens)
- Always `mx-auto px-4`

---

### Two-Column Layout (Search Results page)

```
Mobile:   Full-width list, map collapsed behind a "Show map" button
Desktop:  Left: scrollable property list (45%) | Right: sticky map (55%)
```

```jsx
// Mobile: stack vertically
// Desktop: side by side
<div className="md:flex md:h-[calc(100vh-64px)]">
  
  {/* Property list — scrollable */}
  <div className="md:w-5/12 md:overflow-y-auto md:border-r md:border-gray-200">
    <div className="p-4 space-y-3">
      {properties.map(p => <PropertyCard key={p.uprn} {...p} />)}
    </div>
  </div>
  
  {/* Map — sticky on desktop, hidden on mobile by default */}
  <div className="hidden md:block md:w-7/12 md:sticky md:top-16">
    <MapView properties={properties} />
  </div>

</div>
```

---

### Map Styling

- Leaflet with OpenStreetMap tiles
- CircleMarker per property: radius 8, colour from fairness score (green/amber/red)
- Popup on click: address + scores + "View property →" link
- Attribution: "© OpenStreetMap contributors" — Leaflet shows this automatically

```jsx
<CircleMarker
  center={[lat, lng]}
  radius={8}
  pathOptions={{
    fillColor: score >= 70 ? '#16A34A' : score >= 40 ? '#D97706' : '#DC2626',
    fillOpacity: 0.9,
    color: 'white',
    weight: 2,
  }}
/>
```

---

### Property Detail — Tab Layout

```
[Back to results]
[Address + postcode]
[Score row: Fair Rent · Safety · HMO Status]

[Overview] [Reviews] [Safety] [Rights]   ← tab bar

[Tab content below]
```

```jsx
// Tab bar — scrollable on mobile
<div className="flex gap-0 border-b border-gray-200 overflow-x-auto">
  {tabs.map(tab => (
    <button
      key={tab}
      className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 
                  transition-colors ${
                    activeTab === tab
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-900'
                  }`}
    >
      {tab}
    </button>
  ))}
</div>
```

---

### Loading States

No skeleton shimmer. No spinners. Just text:

```jsx
// Page loading
<div className="px-4 py-12 text-center text-sm text-gray-400">
  Loading properties...
</div>

// Inline loading (inside a card)
<p className="text-xs text-gray-400">Calculating score...</p>

// Score not available
<span className="text-xs text-gray-400">Score unavailable</span>
```

---

### Empty States

```jsx
<div className="px-4 py-16 text-center">
  <p className="text-sm font-medium text-gray-900 mb-1">No properties found</p>
  <p className="text-sm text-gray-500">Try a different postcode or increase the search radius</p>
</div>
```

---

### Error States

```jsx
<div className="border border-red-200 bg-red-50 rounded-lg px-4 py-3 text-sm text-red-700">
  Something went wrong. Please try again.
</div>
```

---

### Section Dividers

```jsx
// Between sections on a page
<div className="border-t border-gray-100 my-6" />

// Inside a card
<div className="border-t border-gray-100 mt-3 pt-3" />
```

Never use `<hr>`. Never use `bg-gray-200` as a thick divider.

---

### Spacing Rules (non-negotiable)

```
Page horizontal padding:   px-4 (mobile) — never less, never more without max-w
Section vertical gaps:     py-8 (mobile), py-12 (desktop)
Between cards in a list:   space-y-3
Inside a card:             p-4 (mobile), p-5 (desktop)
Between label and input:   gap-1.5
Between form fields:       space-y-4
Between nav links:         gap-6
```

---

### Things Claude must NEVER do on this project

```
❌ No full-width house photography hero
❌ No dark background sections (no navy, no dark gray panels)
❌ No gradient backgrounds or gradient buttons
❌ No box shadows (no shadow-md, shadow-lg etc) — use borders instead
❌ No rounded-full on buttons — use rounded-lg
❌ No skeleton loaders with shimmer animation
❌ No modal dialogs — use dedicated pages
❌ No hamburger menus
❌ No emoji in UI except HMO badge (✓ ⚠)
❌ No inline styles
❌ No hardcoded colour values except the indigo/green/amber/red defined above
❌ No TypeScript — plain JSX with JSDoc comments
❌ No new npm packages without asking first
❌ No font-bold or font-extrabold — font-semibold is the maximum weight
```
