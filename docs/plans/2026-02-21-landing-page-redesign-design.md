# Landing Page Redesign — Design Document

**Date:** 2026-02-21
**Branch:** `landing-page-redesign`

## Goal

Replace the current AI-slop aesthetic with a refined, consulting-grade landing page using white + warm brown (Anthropic-inspired) palette and elegant serif typography.

## Color Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `warm-white` | `#FAFAF8` | Page background |
| `warm-brown-500` | `#B8845C` | Primary accent (buttons, highlights) |
| `warm-brown-600` | `#A0724D` | Button hover |
| `warm-brown-300` | `#D4C5B0` | Badges, secondary elements |
| `warm-brown-100` | `#F0EBE3` | Card backgrounds, subtle fills |
| `warm-grey-700` | `#6B6459` | Body text |
| `warm-grey-400` | `#A39E95` | Muted/secondary text |
| `warm-grey-200` | `#EDEBE6` | Borders, dividers |
| `warm-dark` | `#1A1612` | Headings, primary text |

## Typography

- **Display:** Cormorant Garamond (headings, logo, section titles)
- **Body:** Geist Sans (body text, buttons, nav, badges)
- **Mono:** Geist Mono (compliance tags, code-like elements)

## Hero Section

- Left column: large "Comply" wordmark in Cormorant Garamond, small badge, heading, description, CTA
- Right column: simplified dashboard mockup (flat, no perspective transform)
- Removed: gradient orbs, dot-grid, animated pulses

## Navbar

- Small "Comply" text wordmark (no shield icon box) + nav links + Sign In / Get Started

## AI Slop Removal

- All `blur-3xl` gradient orb backgrounds
- `dot-grid` background pattern
- `animate-pulse` effects
- `gradient-text` CSS class (replaced with solid brown accent)
- Perspective transforms
- Hover glow rings
- Excessive staggered motion animations (keep subtle fade-ups)

## Sections Kept (refined)

- How It Works: 3-step cards, remove agent strip, update colors
- Features: 6-feature grid, remove hover glow, update colors
- Social Proof: stats + tech stack, remove zap icons and hackathon quote
- CTA: centered layout, remove gradient/grid backgrounds
- Footer: update colors, keep structure
