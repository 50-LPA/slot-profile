# Change Requests & Design Decisions Log

This document tracks all user change requests, visual refinements, design rules, and whether proposed ideas were approved or rejected. It serves as institutional memory so the system maintains consistency as the codebase evolves.

---

## Registry of Change Requests

### [CR-001] Full-Width Bank Name Selector & Next-Line Account Number
- **Date**: 2026-11-21
- **Component**: `src/statements/components/AccountForm.jsx`
- **User Request**: *"move the account number input field on next line and full width bank selection dropdown"*
- **Screenshot**: `uploaded_media_1795278307786.png`
- **Rationale / Rule**:
  - The Bank Name selector determines the template schema (Kotak vs. HDFC) and brand context for the entire statement. Making it full width (`full: true`) gives it primary visual hierarchy at the top of the form.
  - Moving `accountNumber` to the next line aligns all 6 secondary account fields into balanced 2-column pairs (`accountNumber` + `accountType`, `branch` + `accountStatus`, `nomination` + `currency`), eliminating orphan empty slots in the grid.
- **Status**: **APPROVED & IMPLEMENTED**
- **Changes**: Added `full: true` to field `bank` in `getGroups()`.

---

### [CR-002] Compact Transaction Seeder & Minimal Vertical Header
- **Date**: 2026-11-21
- **Components**: `src/statements/components/Editor.jsx`, `src/statements/components/TransactionSeeder.jsx`
- **User Request**: User manually stripped seeder container down to a compact button and commented out `<SummaryBar />`.
- **Rationale / Rule**:
  - **Screen Real Estate Optimization**: Eliminates vertical clutter above the left form column. Opening/closing metrics are already clearly visible in the preview pane and closing balance summary, making the separate SummaryBar redundant on desktop.
  - **Minimalist Action Triggers**: Converting the bulky seeder card/banner into a clean compact button (`btn btn-sm`) keeps random data generation quickly accessible without distracting from the main form inputs.
- **Status**: **APPROVED & IMPLEMENTED**
- **Changes**: Commented out `<SummaryBar>` in `Editor.jsx`; streamlined `TransactionSeeder.jsx` into a standalone action button.

---

### [CR-003] Zero-Emoji Policy: Replacement with Scalable Vector Icons
- **Date**: 2026-11-21
- **Components**: `src/icons.jsx`, `src/fields.jsx`, `src/Career.jsx`, `src/ProfileForm.jsx`, `src/ResumeEditor.jsx`, `src/statements/components/TransactionManager.jsx`, `src/statements/components/TransactionSeeder.jsx`
- **User Request**: *"replace all emojies with there replacement in fontawesome icons also check if any emojie missed , as we dont allows the emojies only fontawesome icons are allowed"*
- **Rationale / Rule**:
  - Emojis render inconsistently across different operating systems (macOS, Windows, Android, Linux), vary in color, size, baseline alignment, and lack brand consistency.
  - Scalable vector icons in `src/icons.jsx` match Tailwind color utilities, adhere to theme strokes, and align cleanly with text baselines.
- **Status**: **APPROVED & IMPLEMENTED**
- **Changes**:
  - Added vector icon definitions (`graduationCap`, `bolt`, `import`, `warning`, `star`) to `src/icons.jsx`.
  - Replaced all raw unicode emojis and checkmarks with `<Icon d={ICONS.xxx} />` and Tailwind dot badges.
  - Cleaned up emojis in documentation files to maintain clean regex compliance.

---

### [CR-004] Official FontAwesome Integration for Toolbar Icons (Lock & Document)
- **Date**: 2026-11-21
- **Components**: `package.json`, `index.html`, `src/main.jsx`, `src/icons.jsx`, `src/statements/components/Editor.jsx`, `src/statements/components/PdfPreview.jsx`
- **User Request**: *"this also count in emoji , plase replace all emojies with fontawesome icons !"*
- **Screenshot**: `uploaded_media_1795279226669.png` (zoomed into `55 pages · A4` and `Protect with password`)
- **Rationale / Rule**:
  - Standardized all application icons to authentic FontAwesome 6 glyphs (`@fortawesome/fontawesome-free`).
  - Updated universal icon renderer to resolve `fa-*` classes into FontAwesome icons (`fa-solid fa-lock`, `fa-solid fa-file-lines`, etc.).
- **Status**: **APPROVED & IMPLEMENTED**
- **Changes**: Installed `@fortawesome/fontawesome-free`; loaded styles in `main.jsx` and `index.html`; mapped `lock` and `document` to FontAwesome in `src/icons.jsx`.

---

### [CR-005] Synchronous Statement Persistence & Sub-Route Mounting Stability
- **Date**: 2026-11-21
- **Components**: `src/statements/App.jsx`, `src/App.jsx`, `src/statements/components/Dashboard.jsx`
- **User Request**: *"check why new statement btn at @slot-profile/src/statements/components/Dashboard.jsx:80-81 is not working , also ther is no log in console etc !"*
- **Root Cause & Diagnosis**:
  - In `src/App.jsx`, the parent route container had `<PageError key={hash}>{page}</PageError>`. Whenever the URL hash changed from `#/statements` to `#/statements/edit/<id>`, the `key={hash}` caused React to completely unmount and remount the `StatementsApp` component tree.
  - In `src/statements/App.jsx`, statement updates were persisted asynchronously via a debounced 500ms timer (`useEffect(() => saveAll(list), 500)`).
  - When the user clicked "New statement" (or "New from demo" / opened a JSON file), `create` called `onSave(st)` (which queued `upsert`) and immediately executed `go(st.id)`.
  - The instantaneous hash change triggered the unmount of `StatementsApp`, which immediately aborted the pending 500ms timer (`clearTimeout(t)`) before `saveAll` ever reached `localStorage`.
  - The freshly mounted `StatementsApp` instance initialized its list by calling `loadAll()` from `localStorage`, which still only held the old statement list without the new one.
  - On line 66 of `src/statements/App.jsx`, `if (route.id && !current) go(null)` checked for the existence of `current`. Because `current` was `null`, it immediately and silently redirected the URL back to `#/statements` without any console warnings or errors, making the button appear completely dead.
- **Status**: **APPROVED & IMPLEMENTED**
- **Changes**:
  - In `src/statements/App.jsx`: Updated `upsert` and `remove` to call `saveAll(updated)` synchronously so `localStorage` is guaranteed to be committed before URL navigation occurs.
  - In `src/App.jsx`: Updated `PageError` key to `key={hash.startsWith('#/statements') ? 'statements' : hash}` so sub-route navigation (`#/statements` to `#/statements/edit/:id`) does not destructively unmount the component tree.

---

## Approved Design Rules
1. **Form Hierarchy**: Primary selector/classifier fields that govern the entire document template (e.g. `Bank Name`) should span full width (`full: true`) at the top of fieldsets.
2. **Balanced 2-Column Grids**: When reordering or expanding fields in `.st-form-grid`, verify that remaining fields pair symmetrically without leaving unintended single-column holes.
3. **No Unscoped Leaks**: Form styles and field spans must remain strictly scoped within `.statement-root` to prevent bleeding into the Resume Builder or Candidate lists.
4. **Zero Emoji Invariant**: No raw unicode emojis (`🎓`, `⚡`, `📥`, `✓`, `●`, `★`, `⚠`) in UI buttons, chips, or labels. Always use scalable vector icons from `src/icons.jsx`.
5. **Atomic Navigation Persistence**: Any user interaction that creates, clones, or deletes an entity and immediately navigates via URL hash must commit changes to persistent storage synchronously rather than relying purely on debounced autosave effects.
6. **Sub-Route Error Boundary Stability**: Top-level route containers must key error boundaries by root application section rather than the full granular hash string to prevent unneeded tree unmounting during internal sub-route transitions.

---

## Rejected Ideas & Anti-Patterns
- **Anti-Pattern: Raw `key={hash}` on Parent Error Boundaries**:
  - *Why it failed*: Tearing down the entire application tree on every sub-route parameter change resets in-memory component state, drops active Web Workers, cancels in-flight debounce timers, and causes flickering.
- **Anti-Pattern: Purely Debounced Autosave for Route-Triggering Actions**:
  - *Why it failed*: Debouncing is essential while typing form inputs to avoid disk thrashing, but relying on it for action buttons that immediately transition route state causes race conditions with component unmounts.
