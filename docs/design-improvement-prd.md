# Design Improvement PRD — «Летопись Тео»

## Summary

- Modules audited: 12
- Findings: 16
- Critical: 2 · High: 6 · Medium: 6 · Low: 2
- Scope inspected: desktop Wiki, detailed Chronicle, long-form chapter reader, responsive CSS and all interactive states.
- Design direction: keep the warm archival fairy-tale character; improve Cyrillic typography, reading rhythm and mobile navigation without turning the Wiki into a generic dashboard.

## M1: Signifiers & Grouping

### M1.1 — Preserve section names on tablet and mobile

- **Current:** below `980px` navigation labels are hidden with `font-size: 0`; nine unexplained numbers remain.
- **Problem:** the primary information architecture loses meaning, especially for a child or first-time reader.
- **Target:** at `681–980px`, use a `184px` collapsible/sidebar rail or show 12px short labels; below `680px`, render five named destinations (`Главная`, `Мир`, `Герои`, `Хроника`, `Ещё`) in a five-column bottom bar, minimum touch target `48px`.
- **Severity:** CRITICAL

### M1.2 — Complete interaction signifiers

- **Current:** several text buttons and tabs have hover but no consistent pressed or keyboard-visible state.
- **Problem:** clicking and keyboard navigation do not always produce a clear response.
- **Target:** add `:active { transform: translateY(1px) scale(.99) }` and `:focus-visible { outline: 3px solid #3b82f6; outline-offset: 3px }` to every `button` and `a` control.
- **Severity:** MEDIUM

## M2: Visual Hierarchy

### M2.1 — Reduce oversized page headings

- **Current:** page H1 reaches `76px` at weight `400`; long titles dominate the first viewport and visually resemble a book cover on every section.
- **Problem:** hierarchy is top-heavy and pushes the first useful content below the fold.
- **Target:** page H1 `clamp(42px, 5vw, 64px)`, line-height `1.08`, weight `600`; reserve `72–84px` only for the home hero.
- **Severity:** HIGH

### M2.2 — Break up long character cards

- **Current:** portrait, up to seven canon bullets, arc and question form very tall equal-weight cards.
- **Problem:** the eye has no intermediate summary and comparison across characters is slow.
- **Target:** keep the image anchor; show 3 primary facts first, move remaining facts into an accessible `Подробнее` disclosure, keep arc in a tinted surface and question as the final pull quote.
- **Severity:** MEDIUM

## M3: Grids & Negative Space

### M3.1 — Normalize spacing to a 4px rhythm

- **Current:** CSS mixes `3, 7, 9, 10, 13, 14, 15, 18, 22, 25, 30, 35, 38, 42, 54, 62px` values.
- **Problem:** small misalignments accumulate across dense Wiki sections.
- **Target:** introduce `--space-4` through `--space-96`; normalize card gaps to `16px`, section gaps to `48/64px`, card padding to `24/32px`, and compact metadata gaps to `4/8/12px`.
- **Severity:** MEDIUM

### M3.2 — Limit prose line length

- **Current:** Chronicle summaries reach `830px` at `17px` and can exceed 90 characters per line.
- **Problem:** long lines reduce reading comfort and make it easier to lose one’s place.
- **Target:** `.episode-body { max-width: 760px }`, `.episode-body > p { max-width: 68ch }`, `.episode-details { max-width: 74ch }`; chapter body remains at `minmax(0, 680px)`.
- **Severity:** HIGH

## M4: Typography

### M4.1 — Load real Cyrillic font files

- **Current:** `Geist` is requested with `subsets: ["latin"]`; Russian UI therefore falls back to the operating-system font, while headings use Georgia.
- **Problem:** typography changes between machines and Cyrillic does not receive the intended font.
- **Target:** use `Manrope` with `subsets: ["cyrillic", "latin"]` for UI and `Literata` with `subsets: ["cyrillic", "latin"]` for story/display text; expose `--font-ui` and `--font-story` variables.
- **Severity:** CRITICAL

### M4.2 — Give headings deliberate weight

- **Current:** H1–H3 use Georgia at weight `400`.
- **Problem:** large headings look elegant but weak, and thin strokes lose clarity on lower-density screens.
- **Target:** Literata H1 `600`, H2 `600`, H3 `550`; letter-spacing `-.025em` above `32px`; line-height `1.08–1.18`.
- **Severity:** HIGH

### M4.3 — Collapse the type scale

- **Current:** the interface contains more than a dozen unrelated sizes from `8px` to `190px`.
- **Problem:** size is being used where weight, color or spacing should carry hierarchy.
- **Target:** content scale `64/42/32/22/17/13px`; allow `84px` home hero and the decorative `190px` numeral as non-semantic exceptions.
- **Severity:** MEDIUM

## M5: Color & Semantic Palette

### M5.1 — Formalize the existing story palette

- **Current:** rust, sage, gold and several one-off paper colors are used directly.
- **Problem:** the palette is attractive but difficult to tune consistently for hover, active and contrast states.
- **Target:** keep the visual identity, but define rust `50–900`, sage `100/500/700`, paper `50–300`, plus semantic blue focus `#3b82f6`; body text must meet WCAG AA on every paper surface.
- **Severity:** MEDIUM

## M6: Dark Mode

- **No violation:** the product is intentionally a paper-like reading surface and no dark theme was requested. Do not add one until reading preferences justify the extra maintenance.

## M7: Shadows & Depth

### M7.1 — Use one quiet elevation system

- **Current:** cover, world plate, search results and hover cards use different shadow color/blur formulas.
- **Problem:** depth feels authored per component rather than systemic.
- **Target:** `--shadow-sm: 0 2px 8px rgba(60,45,26,.05)`, `--shadow-md: 0 10px 32px rgba(60,45,26,.08)`, `--shadow-popover: 0 18px 48px rgba(36,31,23,.14)`.
- **Severity:** LOW

## M8: Icons

### M8.1 — Replace typographic symbols with a coherent icon set

- **Current:** search uses the `⌕` glyph, files use `◉`, arrows are text, and navigation relies on numbers.
- **Problem:** symbols differ by font/platform and do not share stroke weight.
- **Target:** use one local SVG/Lucide set at `20px` with `24px` line-height; keep Roman numerals as editorial markers, not as the only mobile navigation labels.
- **Severity:** MEDIUM

## M9: Button System

### M9.1 — Normalize geometry

- **Current:** primary, text, quick-link, route-tab and chapter-index controls each use unrelated padding.
- **Problem:** controls do not feel like one interaction system.
- **Target:** standard sizes: small `8px 16px`, default `10px 20px`, large `12px 24px`; minimum height `44px`, radius `6px` for utility UI while editorial cards remain square.
- **Severity:** MEDIUM

### M9.2 — Add full state coverage

- **Current:** default and hover exist widely; pressed, disabled and loading are not standardized.
- **Problem:** state feedback is incomplete.
- **Target:** define default/hover/active/focus-visible/disabled for all control variants; loading is required only for future async actions, not local section switches.
- **Severity:** LOW

## M10: Inputs & Feedback

### M10.1 — Strengthen search focus and empty results

- **Current:** focus uses a low-contrast gold border; empty search feedback is plain text inside the popover.
- **Problem:** focus visibility is weaker than the rest of the interface and results lack count/context.
- **Target:** blue `3px` focus ring with `2px` offset; show `Найдено: N` or `Ничего не найдено — попробуйте имя, место или артефакт`; keep the existing keyboard shortcut.
- **Severity:** HIGH

## M11: Micro-interactions

### M11.1 — Make section changes feel anchored

- **Current:** content switches immediately while only the sidebar highlight changes.
- **Problem:** on large pages it can be unclear whether navigation completed.
- **Target:** on section change, move focus to H1, update the URL hash, scroll to top, and animate content opacity/translate for `160ms`; disable under `prefers-reduced-motion`.
- **Severity:** HIGH

## M12: Image Overlays

- **No violation:** the home cover already places text on an opaque blurred caption surface; character and artifact images contain no overlaid text; the world caption sits below the image. Preserve this rule.

## Implementation Priority

1. Cyrillic font loading and semantic type scale (M4.1–M4.3).
2. Named mobile/tablet navigation and focus handling (M1.1, M11.1).
3. Reading width and spacing tokens (M3.1–M3.2).
4. Search/button states and coherent icons (M1.2, M8.1, M9, M10.1).
5. Character disclosure and depth/palette polish (M2.2, M5.1, M7.1).

Implementation begins only after approval of this PRD, per the design-audit workflow.
