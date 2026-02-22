# Landing Page Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the Comply landing page from AI-slop aesthetic to a refined white + warm brown consulting-grade look with Cormorant Garamond serif typography.

**Architecture:** Pure visual refactor of existing Next.js components. Replace color palette in globals.css, swap display font in layout.tsx, then update each section component to use new palette and strip AI-slop elements. No structural/routing changes.

**Tech Stack:** Next.js 16, Tailwind CSS v4, Cormorant Garamond (Google Fonts), motion/react

---

### Task 1: Create feature branch

**Step 1:** Create and checkout the branch

```bash
cd /Users/mohammadtallab/Documents/GitHub/Comply
git checkout -b landing-page-redesign
```

---

### Task 2: Swap font from Playfair Display to Cormorant Garamond

**Files:**
- Modify: `frontend/comply-landing/src/app/layout.tsx`
- Modify: `frontend/comply-landing/package.json` (if needed — Cormorant Garamond is in `next/font/google`)

**Step 1:** In `layout.tsx`, replace `Playfair_Display` import and config with `Cormorant_Garamond`:

```tsx
import { Geist, Geist_Mono, Cormorant_Garamond } from "next/font/google";

const cormorantGaramond = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  style: ["normal", "italic"],
  weight: ["300", "400", "500", "600", "700"],
});
```

Update the body className to use `cormorantGaramond.variable` instead of `playfairDisplay.variable`.

**Step 2:** In `globals.css`, update the `--font-display` variable:

```css
--font-display: var(--font-cormorant), Georgia, "Times New Roman", serif;
```

**Step 3:** Verify: `npm run dev` in `frontend/comply-landing`, check that headings render in Cormorant Garamond.

**Step 4:** Commit: `feat: swap Playfair Display for Cormorant Garamond`

---

### Task 3: Replace color palette in globals.css

**Files:**
- Modify: `frontend/comply-landing/src/app/globals.css`

**Step 1:** Replace the entire `@theme` color block with the new warm brown palette:

```css
@theme {
  /* Warm palette */
  --color-warm-white: #FAFAF8;
  --color-warm-brown-50: #FAF7F4;
  --color-warm-brown-100: #F0EBE3;
  --color-warm-brown-200: #E2D9CC;
  --color-warm-brown-300: #D4C5B0;
  --color-warm-brown-400: #C4A882;
  --color-warm-brown-500: #B8845C;
  --color-warm-brown-600: #A0724D;
  --color-warm-brown-700: #7D5A3D;
  --color-warm-brown-800: #5A412D;
  --color-warm-brown-900: #38281C;

  /* Warm greys */
  --color-warm-grey-50: #FAF9F7;
  --color-warm-grey-100: #F0EEEA;
  --color-warm-grey-200: #EDEBE6;
  --color-warm-grey-300: #D6D2CB;
  --color-warm-grey-400: #A39E95;
  --color-warm-grey-500: #8A857C;
  --color-warm-grey-600: #6B6459;
  --color-warm-grey-700: #524D44;
  --color-warm-grey-800: #3A362F;
  --color-warm-grey-900: #1A1612;

  /* Fonts */
  --font-sans: var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif;
  --font-mono: var(--font-geist-mono), ui-monospace, monospace;
  --font-display: var(--font-cormorant), Georgia, "Times New Roman", serif;
}
```

**Step 2:** Update body styles:

```css
body {
  background-color: #FAFAF8;
  color: #1A1612;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

**Step 3:** Remove `.dot-grid` class entirely.

**Step 4:** Replace `.gradient-text` with solid brown accent:

```css
.accent-text {
  color: #B8845C;
}
```

**Step 5:** Commit: `feat: replace green palette with warm white + brown`

---

### Task 4: Update Navbar

**Files:**
- Modify: `frontend/comply-landing/src/components/sections/Navbar.tsx`

**Step 1:** Replace the logo — remove the ShieldCheck icon box, use a simple text wordmark:

```tsx
<a href="#" className="font-display text-xl font-semibold tracking-tight text-warm-grey-900">
  Comply
</a>
```

**Step 2:** Update all color classes throughout the component:
- `border-dust-grey-*` → `border-warm-grey-200`
- `bg-dust-grey-*` → `bg-warm-white` / `bg-warm-grey-50`
- `text-dry-sage-*` → `text-warm-grey-600`
- `text-fern-*` → `text-warm-grey-900` (for hover states)
- `bg-fern-700` → `bg-warm-brown-500`
- `hover:bg-fern-800` → `hover:bg-warm-brown-600`

**Step 3:** Remove `ShieldCheck` import from lucide-react.

**Step 4:** Commit: `feat: update navbar to warm brown palette`

---

### Task 5: Redesign HeroSection

**Files:**
- Modify: `frontend/comply-landing/src/components/sections/HeroSection.tsx`
- Modify: `frontend/comply-landing/src/components/ui/Badge.tsx`

**Step 1:** Strip AI-slop from HeroSection:
- Remove the entire "Atmospheric gradient orbs" div
- Remove `dot-grid` from the section className
- Remove `gradient-text` span, replace with `accent-text` class

**Step 2:** Add large "Comply" wordmark above the heading in the left column:

```tsx
<motion.div {...fadeUp(0)}>
  <span className="font-display text-7xl font-semibold tracking-tight text-warm-grey-900 sm:text-8xl">
    Comply
  </span>
</motion.div>
```

**Step 3:** Update Badge component colors:
- `border-hunter-green-*` → `border-warm-brown-300`
- `bg-hunter-green-*` → `bg-warm-brown-100`
- `text-hunter-green-*` → `text-warm-brown-600`

**Step 4:** Update all hero text colors:
- `text-dust-grey-950` → `text-warm-grey-900`
- `text-dry-sage-700` → `text-warm-grey-600`
- `text-dry-sage-600` → `text-warm-grey-500`
- `text-dust-grey-400` → `text-warm-grey-400`
- `bg-fern-700` → `bg-warm-brown-500`
- `hover:bg-fern-800` → `hover:bg-warm-brown-600`

**Step 5:** Simplify DashboardMockup:
- Remove `style={{ transform: "perspective(1000px)..." }}`
- Replace all `dust-grey`, `dry-sage`, `hunter-green`, `fern` color classes with warm palette equivalents
- Remove `animate-pulse` from the agent workspace dot

**Step 6:** Reduce animation staggering — keep fadeUp but use shorter delays (0, 0.05, 0.1, 0.15 instead of 0, 0.1, 0.2, 0.3).

**Step 7:** Commit: `feat: redesign hero section with warm palette and centered logo`

---

### Task 6: Update HowItWorksSection

**Files:**
- Modify: `frontend/comply-landing/src/components/sections/HowItWorksSection.tsx`

**Step 1:** Update all color classes to warm palette:
- Section headings: `text-hunter-green-500` → `text-warm-brown-500`
- Card borders: `border-dust-grey-200` → `border-warm-grey-200`
- Card backgrounds: `bg-dust-grey-100/60` → `bg-warm-grey-50`
- Heading text: `text-dust-grey-950` → `text-warm-grey-900`
- Body text: `text-dry-sage-600` → `text-warm-grey-600`
- Detail text: `text-dust-grey-400` → `text-warm-grey-400`
- Icon backgrounds: use `bg-warm-brown-100`
- Step number color: `text-dust-grey-200` → `text-warm-grey-200`
- Connector lines: `hunter-green-300/40` → `warm-brown-300/40`
- Arrow icons: `hunter-green-*` → `warm-brown-*`
- Hover borders: `hover:border-hunter-green-300/60` → `hover:border-warm-brown-300/60`

**Step 2:** Remove the agent illustration strip entirely (the `agents` array and the bottom `motion.div` grid).

**Step 3:** Remove `animate-pulse` if any remain.

**Step 4:** Commit: `feat: update how-it-works section with warm palette`

---

### Task 7: Update FeaturesSection

**Files:**
- Modify: `frontend/comply-landing/src/components/sections/FeaturesSection.tsx`

**Step 1:** Remove the background gradient orb div.

**Step 2:** Update all color classes to warm palette (same mapping as Task 6).

**Step 3:** Remove the hover glow ring div at the bottom of each feature card.

**Step 4:** Replace `gradient-text` with `accent-text`.

**Step 5:** Update feature card badge styling to warm palette.

**Step 6:** Commit: `feat: update features section with warm palette`

---

### Task 8: Update SocialProofSection

**Files:**
- Modify: `frontend/comply-landing/src/components/sections/SocialProofSection.tsx`

**Step 1:** Remove the Zap icons and the "Hackathon-ready" quote block.

**Step 2:** Update colors:
- Section border: `border-dust-grey-200/60` → `border-warm-grey-200`
- Section background: `bg-dust-grey-50/40` → `bg-warm-grey-50`
- Stat values: `text-fern-700` → `text-warm-brown-500`
- Stat labels: `text-dry-sage-500` → `text-warm-grey-500`
- Tech stack label: `text-dust-grey-400` → `text-warm-grey-400`
- Tech chip borders/backgrounds: warm palette equivalents

**Step 3:** Remove Zap import.

**Step 4:** Commit: `feat: update social proof section with warm palette`

---

### Task 9: Update CtaSection

**Files:**
- Modify: `frontend/comply-landing/src/components/sections/CtaSection.tsx`

**Step 1:** Remove the gradient background div, the grid lines div, and the gradient orbs div.

**Step 2:** Replace with a clean subtle background:

```tsx
<div className="absolute inset-0 bg-warm-brown-50" />
```

**Step 3:** Update all color classes to warm palette:
- Icon box: `bg-hunter-green-200/50` → `bg-warm-brown-100`
- Icon: `text-hunter-green-700` → `text-warm-brown-500`
- Heading: warm-grey-900 + `accent-text`
- Body: `text-dry-sage-700` → `text-warm-grey-600`
- Button: `bg-fern-700` → `bg-warm-brown-500`
- Fine print: `text-dust-grey-400` → `text-warm-grey-400`

**Step 4:** Remove ShieldCheck icon, replace with simpler visual or just remove the icon entirely.

**Step 5:** Commit: `feat: update CTA section with warm palette`

---

### Task 10: Update FooterSection

**Files:**
- Modify: `frontend/comply-landing/src/components/sections/FooterSection.tsx`

**Step 1:** Replace logo with text-only wordmark (matching navbar).

**Step 2:** Update all color classes to warm palette.

**Step 3:** Remove ShieldCheck import.

**Step 4:** Commit: `feat: update footer with warm palette`

---

### Task 11: Verify build

**Step 1:** Run `npm run build` in `frontend/comply-landing` to verify no errors.

**Step 2:** Run `npm run dev` and visually verify:
- Cormorant Garamond renders for logo + headings
- Warm brown palette throughout
- No gradient orbs, dot grids, pulse animations, or hover glows
- Dashboard mockup is flat (no perspective)
- Hero has large "Comply" wordmark

**Step 3:** Final commit if any cleanup needed.
