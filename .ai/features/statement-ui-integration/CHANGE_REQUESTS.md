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

## Approved Design Rules
1. **Form Hierarchy**: Primary selector/classifier fields that govern the entire document template (e.g. `Bank Name`) should span full width (`full: true`) at the top of fieldsets.
2. **Balanced 2-Column Grids**: When reordering or expanding fields in `.st-form-grid`, verify that remaining fields pair symmetrically without leaving unintended single-column holes.
3. **No Unscoped Leaks**: Form styles and field spans must remain strictly scoped within `.statement-root` to prevent bleeding into the Resume Builder or Candidate lists.

---

## Rejected Ideas & Anti-Patterns
*(Document rejected designs and approaches here with reasons why they failed to avoid repeating them.)*
