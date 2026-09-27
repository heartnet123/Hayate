# HelpDesk AI Design System (existing UI)

## 1. Atmosphere & Identity

Operational support dashboard: quiet light surfaces, dense but readable ticket context, blue action affordances. Real support work stays visually distinct from sample Slack previews.

## 2. Color

Existing tokens in `apps/web/src/app.css`: `--ui-bg` #f5f7fb, `--ui-surface` #fff, `--ui-surface-subtle` #f8faff, `--ui-border` #e2e8f1, `--ui-text` #17213d, `--ui-muted` #53637d, `--ui-primary` #3158ed, `--ui-primary-soft` #eef2ff, `--ui-success` #148454, `--ui-warning` #ad7300, `--ui-danger` #d23c4c, with matching soft status tokens. No dark theme exists. Internal-note UI uses these, not new palette values.

## 3. Typography

Existing stack: Inter then system sans-serif. Ticket headings 16px bold; body and labels 14–16px; metadata 12px where already used. Notes use 14px minimum for body and the existing muted token for author/time.

## 4. Spacing & Layout

Existing dashboard panels use 12px gaps, 16px ticket-row padding, 8px form gaps. Main content scrolls in `.dashboard`; shared notes must remain in that scroll owner and wrap long text without horizontal overflow. One column on narrow viewports.

## 5. Components

### Support ticket panel
- **Structure:** semantic section with heading, ticket articles, and scoped forms.
- **Variants/states:** empty list has plain message; selected work displays notes; errors use `role="alert"`; success uses `role="status"`.
- **Accessibility:** ticket ID in heading, form input labelled by ID, keyboard-operable submit, visible focus inherited from existing controls.
- **Motion/layout:** no new motion; existing scroll container owns overflow. Existing `.ui-panel`/`.ui-button`/`.ui-field` are reused.

### Note composer
- **Structure:** label, textarea, submit button inside a ticket article; internal-only label and helper copy distinguish it from official Slack reply.
- **States:** empty/default, focus, validation error preserving body, save failure preserving body, successful submission with new entry. Native required/max-length browser validation supplements server validation.
- **Spacing:** existing 8px form gap and 16px ticket-row padding. No new reusable component abstraction.

## 6. Motion & Interaction

No animation needed for append-only notes. Native submit and server feedback reflect actual saved state; no optimistic display before persistence. Respect existing focus styles and reduced-motion behavior.

## 7. Depth & Surface

Mixed existing style: `--ui-border` delineates panel and ticket rows, `--ui-shadow` provides subtle panel depth, `--ui-surface-subtle` differentiates secondary information. Notes reuse these without nested decorative cards.

## 8. Accessibility Constraints & Accepted Debt

Target WCAG 2.2 AA for new UI: labelled fields, semantic headings, readable note text, keyboard access, visible errors, no color-only status. Existing sample dashboard uses sub-14px metadata and hard-coded artwork colors; out of scope for this functional issue, not endorsed for new notes UI. No new debt accepted.
