# AI Engineering Rules & Operational Manual: Slot Profile

This file is the mandatory entry point for any AI agent working on this repository (`slot-profile`). Read this file completely before inspecting other files, proposing changes, or writing code.

---

## 1. System Overview & Core Pillars
`slot-profile` integrates three core operational tools under a single authenticated dashboard:
1. **Candidate Profile & Intake Agreement**:
   - Location: `src/ProfileForm.jsx`, `src/Career.jsx`, `src/CandidateList.jsx`, `src/Dashboard.jsx`, `src/SignaturePad.jsx`.
   - Backend: Cloud Firestore (`firestore.rules`) with admin-only auth.
2. **Resume Builder**:
   - Location: `src/ResumeEditor.jsx`, `src/ResumeList.jsx`, `src/resume.js`, `src/resumeData.js`, `src/resume.css`.
   - Capabilities: Pre-filling from candidate profile & tech stack, DOM-measured live A4 pagination, multi-page print-to-PDF styles, local draft caching.
3. **Statement Builder**:
   - Location: `src/statements/` (`components/`, `lib/`, `pdf/`, `styles.css`).
   - Capabilities: Kotak Mahindra & HDFC authentic bank statement templates, Web Worker off-thread rendering (`pdf.worker.js`), integer paise financial math (`calc.js`), Indian merchant transaction seeder (`seeder.js`), encrypted PDF exports (`encrypt.js`).

---

## 2. Understand Before Coding
- **Read First**: Always read `AGENTS.md` and relevant knowledge records in `.ai/` before inspecting or modifying code.
- **Understand the Existing Architecture**: Check `.ai/knowledge/ARCHITECTURE.md`, `.ai/knowledge/PROJECT_CONTEXT.md`, and `.ai/knowledge/SYSTEM_INVARIANTS.md`.
- **Search Before Creating**: Look for existing utilities (e.g. `src/statements/lib/calc.js`, `src/resume.js`, `src/data.js`) before introducing new functions or libraries.
- **Never Assume Undocumented Requirements**: If a requirement or styling detail is ambiguous, ask for clarification.

---

## 3. Respect Historical Decisions
- **Check Accepted & Rejected History**: Read `.ai/decisions/` and `.ai/history/rejected/` before proposing or making architectural changes.
- **Never Repeat a Rejected Approach**: Check `.ai/history/rejected/` to ensure your proposed solution was not already tried, evaluated, and declined.
- **No Silent Overrides**: Never silently override or undo accepted architectural decisions (ADRs).
- **Proposing Changes**: If an accepted decision must be superseded due to new requirements, document a new ADR with status `PROPOSED` and link to the superseded decision.

---

## 4. Make Minimal & Precise Changes
- **Scope Discipline**: Change only what the current user request explicitly asks for.
- **Zero Unrelated Refactoring**: Do not reformat, rename, or reorganize code outside the scope of the immediate task.
- **No Unnecessary Dependencies**: Use the standard library and existing project dependencies before proposing new packages.
- **Fix Root Causes**: Address underlying structural or mathematical bugs rather than applying surface-level patches or hacky coordinate overrides.

---

## 5. Non-Negotiable System Invariants
- **Integer Paise Arithmetic**: All financial calculations in `src/statements/lib/calc.js` must be integer paise (`Math.round(amount * 100)`). No floating-point operations for money.
- **Strict ISO Dates in State**: State and JSON must store dates as `YYYY-MM-DD`. Formatted presentation strings (e.g., `01-Nov-2026`) must only be produced at the UI/render boundary.
- **Vite Web Worker Isolation**: Fast Refresh in `vite.config.js` must exclude `/pdf/` files so React DOM runtime is not injected into the Web Worker.
- **DOM-Measured Resume Pagination**: Resume pagination in `src/ResumeEditor.jsx` must measure actual page content overflow in the DOM; do not guess heights mathematically.
- **Candidate Firestore Security**: Only the designated admin account is authorized in `firestore.rules`.
- **Sub-App CSS Isolation & Zero Leaks**: All stylesheets imported by submodules (e.g. `src/statements/styles.css`) must be strictly scoped under their root container (`.statement-root`). Never define unscoped classes matching Tailwind utilities (`.grid`, `.flex`) or compound tag resets (`.root button { color: inherit }`) that overpower Tailwind utility classes like `text-white` or `w-32`.
- **Symmetrical CardHeader & Action Alignment**: Card headers in `src/ui.jsx` must enforce `lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]` so titles are dead-center and action buttons are pinned right with `justify-end`. Primary buttons must always render emerald green with bold white text.

---

## 6. Testing and Verification Rules
- **Non-Negotiable Execution**: Run `npm test` after modifying any calculation, validation, formatting, resume logic, or data models.
- **Build Verification**: Run `npm run build` after UI, Tailwind, or React-PDF component changes to ensure Vite production bundling succeeds cleanly.
- **Lint Verification**: Run `npm run lint` (`oxlint`) to ensure zero errors.
- **Never Fabricate Test Results**: Never claim tests passed or build succeeded without executing the command in the session.
