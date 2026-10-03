# HelpDesk AI Design System (existing UI)

## 1. Atmosphere & Identity

Operational support dashboard: quiet light surfaces, dense but readable ticket context, blue action affordances. Real support work stays visually distinct from sample Slack previews.

## 2. Color

Existing tokens in `apps/web/src/app.css`: `--ui-bg` #f5f7fb, `--ui-surface` #fff, `--ui-surface-subtle` #f8faff, `--ui-border` #e2e8f1, `--ui-text` #17213d, `--ui-muted` #53637d, `--ui-primary` #3158ed, `--ui-primary-soft` #eef2ff, `--ui-success` #148454, `--ui-warning` #ad7300, `--ui-danger` #d23c4c, with matching soft status tokens. No dark theme exists. Internal-note UI uses these, not new palette values.

## 3. Typography

Existing stack: Inter then system sans-serif. Ticket headings 16px bold; body and labels 14–16px; metadata 12px where already used. Notes use 14px minimum for body and the existing muted token for author/time.

## 4. Spacing & Layout

Existing dashboard panels use 12px gaps, 16px ticket-row padding, 8px form gaps. Main content scrolls in `.dashboard`; shared ticket history must remain in that scroll owner and wrap long text without horizontal overflow. One column on narrow viewports.

## 5. Components

### Support ticket panel

- **Structure:** Support ticket history section with ticket articles, separate Official replies from Slack and Internal notes subheadings, and scoped note forms.
- **Variants/states:** empty list has plain message; each ticket displays official Slack replies and internal notes separately; errors use `role="alert"`; success uses `role="status"`.
- **Accessibility:** ticket ID in heading, form input labelled by ID, keyboard-operable submit, visible focus inherited from existing controls.
- **Motion/layout:** no new motion; existing scroll container owns overflow. Existing `.ui-panel`/`.ui-button`/`.ui-field` are reused.

### Official reply history

- **Structure:** per-ticket `h4` labelled Official replies from Slack, followed by a chronological list. Each entry displays saved staff email, original Slack member/name, UTC source time in a `<time>` element, and body.
- **States:** plain empty-state text when no official Slack replies exist; show saved entries after persistence, without optimistic display.
- **Attribution:** display the recorded author independently of the current assignee or identity mapping. Internal notes remain under their own `h4` and keep their existing composer.
- **Layout:** reuse ticket and note-list styles, readable body text, muted metadata, and long-text wrapping. No new motion or nested decorative cards.

### Note composer

- **Structure:** label, textarea, submit button inside a ticket article; internal-only label and helper copy distinguish it from official Slack reply.
- **States:** empty/default, focus, validation error preserving body, save failure preserving body, successful submission with new entry. Native required/max-length browser validation supplements server validation.
- **Spacing:** existing 8px form gap and 16px ticket-row padding. No new reusable component abstraction.

### AI answer history

- **Structure:** two read-only `.ui-panel` sections above the central queue. `AI answer history` contains confirmed `sent` deliveries only; `AI delivery attention` contains `sending`, `failed`, and `uncertain` deliveries only. Neither section includes claim, assignee, retry, or resend controls.
- **Provenance:** every confirmed answer displays the immutable approved SOP title, version ID, procedure snapshot, full answer body, owner, source workspace/channel/thread, and persisted `sentAt` UTC value in a `<time>` element. Delivery creation time is not presented as answer time.
- **Truthful states:** status is always written in words. In-flight and uncertain delivery says `Delivery not confirmed`; failed and uncertain rows point staff to the existing central queue without inventing recovery actions. No non-`sent` state uses answered or success language.
- **Layout:** reuse `.ui-panel`, `.ui-badge`, `--ui-border`, `--ui-surface-subtle`, and the existing 8/12/16px scale. Body text is at least 14px, preserves whitespace, and wraps unbroken content. Rows remain one column so 375px layouts need no horizontal scrolling.
- **Accessibility:** semantic section headings and lists expose counts and grouping without relying on color. Empty states use plain text. Read-only content has no decorative motion or hidden disclosure dependency.

## 6. Motion & Interaction

### SOP review workspace

- **Structure:** saved SOP list beside draft editor; semantic status metadata, immutable approved snapshot and chronological actor/time lifecycle history. Replace sample tickets, fake confidence and preview publishing with persisted facts.
- **States:** empty/new draft, saved draft, approved active version, saved edits awaiting approval, withdrawn, pending submit, validation/conflict/database/transport failure. Approved content stays distinct from editable draft content.
- **Controls:** staff save drafts; admin approve saved content or withdraw active version. Save edits before moderating; no optimistic lifecycle success. Every input labelled, visible focus, status expressed in text, errors announced with `role="alert"` and submitted fields retained.
- **Layout:** reuse `.ui-panel`, `.ui-button`, `.ui-field`, `.ui-badge`; 8/12/16px gaps/padding, 14–16px readable body and 12px metadata. Main content owns scrolling; list/editor stack on narrow viewports, long content wraps. Existing status colors only, no new motion or dependencies.

No animation needed for append-only notes. Native submit and server feedback reflect actual saved state; no optimistic display before persistence. Respect existing focus styles and reduced-motion behavior.

## 7. Depth & Surface

Mixed existing style: `--ui-border` delineates panel and ticket rows, `--ui-shadow` provides subtle panel depth, `--ui-surface-subtle` differentiates secondary information. Notes reuse these without nested decorative cards.

## 8. Accessibility Constraints & Accepted Debt

Target WCAG 2.2 AA for new UI: labelled fields, semantic headings, readable note text, keyboard access, visible errors, no color-only status. Existing sample dashboard uses sub-14px metadata and hard-coded artwork colors; out of scope for this functional issue, not endorsed for new notes UI. No new debt accepted.
