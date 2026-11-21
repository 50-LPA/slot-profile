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

## 13-Change Backlog (Batch Tracking)

This section collects and documents the batch of 13 upcoming change requests with their component context, problem analysis, proposed solution, and category. These items are strictly documented first without premature implementation, allowing review and bulk execution by category.

### [CR-006] (Item 1/13): Convert Account Status to Native Select Dropdown
- **Component**: `src/statements/components/AccountForm.jsx`
- **User Request**: *"make suer this element is dropdown as its acc status"*
- **Screenshot**: `uploaded_media_1795281220398.png` (red circle around `Account status: Active`)
- **Category**: Form Fields & UX
- **Context**:
  - In `AccountForm.jsx`, `accountStatus` is currently configured as a text `<input>` with `<datalist id="acc-accountStatus-list">`:
    ```javascript
    { k: 'accountStatus', label: 'Account status', datalist: ACCOUNT_STATUSES, placeholder: 'Active / Dormant' }
    ```
  - Text inputs with datalists do not present a persistent dropdown chevron across all browsers and allow arbitrary unvalidated text entry.
- **Proposed Solution**:
  - Update `accountStatus` in `getGroups()` in `src/statements/components/AccountForm.jsx` from `datalist: ACCOUNT_STATUSES` to `select: ACCOUNT_STATUSES`:
    ```javascript
    { k: 'accountStatus', label: 'Account status', select: ACCOUNT_STATUSES }
    ```
  - Options (`ACCOUNT_STATUSES` from `src/statements/lib/model.js`): `['Active', 'Regular', 'Dormant', 'Inactive', 'Frozen']`.
  - Ensures a native `<select>` dropdown with consistent UI, keyboard navigation, and prevents invalid status strings.
- **Status**: **APPROVED & IMPLEMENTED (Batch 1)**

### [CR-007] (Item 2/13): Convert Nominee Registered to Toggle Button
- **Component**: `src/statements/components/AccountForm.jsx`
- **User Request**: *"make it toggle btn"*
- **Screenshot**: `uploaded_media_1795281258465.png` (red circle around `Nominee registered: Yes`)
- **Category**: Form Fields & UX
- **Context**:
  - In `AccountForm.jsx`, `nomination` is currently configured as a text input with datalist (`NOMINATION_OPTIONS = ['Yes', 'No']`):
    ```javascript
    { k: 'nomination', label: 'Nominee registered', datalist: NOMINATION_OPTIONS, placeholder: 'Yes / No' }
    ```
  - For a strictly binary Yes/No field, a text input is inconvenient, requires manual typing or opening the datalist, and allows invalid string entry.
- **Proposed Solution**:
  - Implement a toggle button control for `nomination` in `AccountForm.jsx`:
    - Option 1 (Segmented Yes/No Toggle): A 2-segment pill toggle (`[ Yes | No ]`) using `.seg` / `.seg-opt` (matching transaction Debit/Credit toggle) or `<Segmented />` from `src/ui.jsx`.
    - Option 2 (Switch Toggle): A boolean switch or styled toggle button that flips between "Yes" and "No".
  - Stores `'Yes'` or `'No'` into `account.nomination`, ensuring full backward compatibility with statement models, test assertions, and PDF templates.
- **Status**: **APPROVED & IMPLEMENTED (Batch 1)**

### [CR-008] (Item 3/13): Remove Currency Selector from Bank & Account Form
- **Component**: `src/statements/components/AccountForm.jsx`
- **User Request**: *"remove currency from this"*
- **Screenshot**: `uploaded_media_1795281299832.png` (red circle around `Currency: INR`)
- **Category**: Form Fields & UX / Simplification
- **Context**:
  - In `AccountForm.jsx`, `currency` is exposed as an explicit `<select>` dropdown (`CURRENCIES = ['INR', 'USD', 'EUR', 'GBP']`).
  - All statements generated in this application are for domestic Indian bank accounts (Kotak Mahindra Bank & HDFC Bank) denominated in Indian Rupee (INR).
  - Exposing an explicit Currency selector adds unnecessary form clutter and leaves an awkward slot in the grid.
- **Proposed Solution**:
  - Remove `{ k: 'currency', label: 'Currency', select: CURRENCIES }` from `getGroups()` in `src/statements/components/AccountForm.jsx`.
  - Preserve `account.currency = 'INR'` as an immutable default in `blankAccount()` and `normalizeStatement()` in `src/statements/lib/model.js`.
  - Financial calculations (`calc.js`), PDF document headers (`StatementDocument.jsx`, `HdfcStatementDocument.jsx`), and formatting (`format.js`) will continue seamlessly relying on `account.currency || 'INR'`.
  - Re-align remaining `Bank & Account` fields (`Nominee registered`, etc.) to maintain a clean 2-column layout.
- **Status**: **APPROVED & IMPLEMENTED (Batch 1)**

### [CR-009] (Item 4/13): Conditionally Display Customer Title for HDFC Bank Only
- **Component**: `src/statements/components/AccountForm.jsx`
- **User Request**: *"this title of mr or mrs should show based on the pdf template as kotak is dont have so hide it and hdfc have to show when hdfc selected !"*
- **Screenshot**: `uploaded_media_1795281402988.png` (red circle around `Title: Mr / Ms / Dr`)
- **Category**: Form Fields & UX / Dynamic Templating
- **Context**:
  - Kotak Mahindra Bank statements print customer names directly without title prefixes; `src/statements/pdf/StatementDocument.jsx` never reads or renders `account.title`.
  - HDFC Bank statements explicitly format and render customer titles (`src/statements/pdf/HdfcStatementDocument.jsx:354`: `<Text style={s.custTitle}>{pdfText((a.title || 'MR').toUpperCase())}</Text>`).
  - Rendering the `Title` input field when Kotak is active adds unnecessary friction and creates confusion since the value does not appear anywhere on Kotak PDFs.
- **Proposed Solution**:
  - In `getGroups()` in `src/statements/components/AccountForm.jsx`, conditionally include the `title` field only when `account.bank === 'HDFC Bank'`:
    ```javascript
    ...(account.bank === 'HDFC Bank' ? [
      { k: 'title', label: 'Title', select: TITLES, placeholder: 'Mr / Ms / Dr' }
    ] : []),
    ```
  - When Kotak is selected, omit `title` and adjust `holderName` (`Customer name *`) layout (e.g. full width or paired with CRN) so the form grid remains balanced.
  - When switching banks, preserve any existing `title` in state in case the user toggles back to HDFC.
- **Status**: **APPROVED & IMPLEMENTED (Batch 1)**

### [CR-010] (Item 5/13): Convert Residential Address to Single-Line "Street Name" Input
- **Component**: `src/statements/components/AccountForm.jsx`
- **User Request**: *"Residential address remoe text area and make it normal input and rename lable to street name !"*
- **Screenshot**: `uploaded_media_1795281534171.png` (red circle around `Residential address` textarea)
- **Category**: Form Fields & UX
- **Context**:
  - In `AccountForm.jsx`, `address` is currently rendered as a 2-row `<textarea>` with the label "Residential address":
    ```javascript
    { k: 'address', label: 'Residential address', textarea: true, full: true, placeholder: 'House / street, area' }
    ```
  - Since separate input fields already handle `City`, `PIN code`, `State`, and `Country`, a multi-row textarea is overkill, takes excessive vertical height, and invites awkward manual newlines.
- **Proposed Solution**:
  - In `getGroups()` in `src/statements/components/AccountForm.jsx`, remove `textarea: true` and rename the label to "Street name":
    ```javascript
    { k: 'address', label: 'Street name', full: true, placeholder: 'e.g. Flat No, Street / Area' }
    ```
  - Keep the underlying property key as `k: 'address'` to preserve total compatibility with database persistence, validation schemas (`validate.js`), and PDF renderers (`StatementDocument.jsx`, `HdfcStatementDocument.jsx`).
- **Status**: **APPROVED & IMPLEMENTED (Batch 1)**

### [CR-011] (Item 6/13): Add Visual Separator after Customer Address (State & Country)
- **Component**: `src/statements/components/AccountForm.jsx`
- **User Request**: *"add seperator after city country"*
- **Screenshot**: `uploaded_media_1795281674084.png` (red circle around `State`, `Country`, `MICR`, and `IFSC code`)
- **Category**: Form Fields & UX / Visual Structure
- **Context**:
  - In `AccountForm.jsx`, the "Customer" fieldset lists address fields (`Street name`, `City`, `PIN code`, `State`, `Country`) followed directly by `MICR` and `IFSC code`.
  - `MICR` and `IFSC` are banking clearing and branch routing codes, whereas the preceding fields are the customer's postal address.
  - Currently, there is no divider separating the geographic address block from the bank routing identifiers.
- **Proposed Solution**:
  - Add a dedicated full-width divider line or sub-group separator in `AccountForm.jsx` right after `State` and `Country` (before `MICR` and `IFSC code`).
  - Spans full width (`grid-column: 1 / -1`) with subtle margin and border (`border-t border-gray-200`), cleanly delineating postal address details from bank branch routing codes.
- **Status**: **APPROVED & IMPLEMENTED (Batch 1)**

### [CR-012] (Item 7/13): Remove Country Input & Always Use "India" in Statement PDFs
- **Component**: `src/statements/components/AccountForm.jsx`, `src/statements/pdf/StatementDocument.jsx`
- **User Request**: *"always add india in pdf remove country dropdown !"*
- **Screenshot**: `uploaded_media_1795281820556.png` (red circle around `Country: India`)
- **Category**: Form Fields & UX / Simplification
- **Context**:
  - All statements generated in this tool are for domestic accounts within India.
  - The `Country` input field in `AccountForm.jsx` is redundant since domestic statements never alter the destination country.
- **Proposed Solution**:
  - Remove `{ k: 'country', label: 'Country', placeholder: 'e.g. India' }` from `getGroups()` in `src/statements/components/AccountForm.jsx`.
  - In `src/statements/pdf/StatementDocument.jsx`, ensure the printed address block always defaults or renders "India" (e.g. `join(' - ', a.state, 'India')`).
  - Retain `country: 'India'` as a default invariant in `src/statements/lib/model.js` (`blankAccount`, `normalizeStatement`) so data models and existing statements remain intact.
  - Reorganize the address fields (`Street name`, `City`, `State`, `PIN code`) into a balanced 2-column layout.
- **Status**: **APPROVED & IMPLEMENTED (Batch 1)**

### [CR-013] (Item 8/13): Remove Unwanted Dashed Separator Lines in "Add Transaction" Section
- **Components**: `src/statements/components/TransactionManager.jsx`, `src/statements/styles.css`
- **User Request**: *"remove seperate from add transaction section !"*
- **Screenshot**: `uploaded_media_1795281972766.png` (red circle around dashed line under Transaction date & Value date)
- **Category**: Form Fields & UX / CSS Cleanup
- **Context**:
  - In `src/index.css`, a global utility class `.field` specifies `border-b border-dashed border-gray-300` for Candidate Profile inputs.
  - This global rule leaks into `src/statements/` sub-components, applying an unintended bottom dashed border to `.field` containers.
  - In the "ADD TRANSACTION" section of `TransactionManager.jsx`, this manifests as an unsightly horizontal dashed separator cutting right beneath the `Transaction date` and `Value date` fields.
- **Proposed Solution**:
  - In `src/statements/styles.css`, add `border-bottom: none;` to `.statement-root .field` and `.tx-grid .field` to neutralize the inherited dashed border.
  - Ensure `.tx-grid` and the entire "ADD TRANSACTION" section renders cleanly without unwanted dashed horizontal separator lines.
- **Status**: **APPROVED & IMPLEMENTED (Batch 2)**

### [CR-014] (Item 9/13): Rename "Reference no." Label to "Chq/Ref. No."
- **Component**: `src/statements/components/TransactionManager.jsx`
- **User Request**: *"rename referecne no -> Chq/Ref. No. lable"*
- **Screenshot**: `uploaded_media_1795282452928.png` (red circle around `Reference no.` input)
- **Category**: Form Fields & UX / Label Consistency
- **Context**:
  - In `TransactionManager.jsx`, the reference field is labeled `<label htmlFor="tx-reference">Reference no.</label>`.
  - On both Kotak and HDFC bank statement PDFs, this transaction column is titled `Chq/Ref. No.` (`src/statements/pdf/StatementDocument.jsx:54`: `['Chq/Ref. No.', W.ref]`).
- **Proposed Solution**:
  - In `src/statements/components/TransactionManager.jsx`, change `<label htmlFor="tx-reference">Reference no.</label>` to `<label htmlFor="tx-reference">Chq/Ref. No.</label>`.
  - Retain the internal key `draft.reference` and input `id="tx-reference"` so data structures, seeder generators, and validation stay completely intact.
- **Status**: **APPROVED & IMPLEMENTED (Batch 2)**

### [CR-015] (Item 10/13): Redesign and Reset Debit / Credit Type Toggle Buttons
- **Components**: `src/statements/components/TransactionManager.jsx`, `src/statements/styles.css`
- **User Request**: *"reset debt credit btns"*
- **Screenshot**: `uploaded_media_1795282693589.png` (red circle around Type `[ Debit | Credit ]` segmented buttons)
- **Category**: Form Fields & UX / Component Standardization
- **Context**:
  - The transaction Type selector currently uses legacy custom CSS (`.seg`, `.seg-opt`, `.seg-opt.debit.on`) with radio inputs.
  - The buttons appear faded and visually disconnected from the rest of the application's UI design system (which uses `<Segmented />` and Tailwind rounded tabs), while also inheriting an unwanted dashed bottom border from `index.css`.
- **Proposed Solution**:
  - Refactor the Type selector in `TransactionManager.jsx` to use the unified `<Segmented />` component from `src/ui.jsx` or clean Tailwind pill tabs.
  - Provide crisp, modern active and hover states:
    - Active Debit: High-contrast red badge (`bg-rose-600 text-white font-semibold` or `bg-rose-50 text-rose-700 border-rose-300`).
    - Active Credit: High-contrast green badge (`bg-emerald-600 text-white font-semibold` or `bg-emerald-50 text-emerald-700 border-emerald-300`).
  - Strip the leaking dashed bottom border and ensure height/alignment matches the neighboring "Add transaction" action button.
- **Status**: **APPROVED & IMPLEMENTED (Batch 2)**

### [CR-016] (Item 11/13): Generate Both Debits and Credits in Random Seeder Engines
- **Components**: `src/statements/lib/seeder.js`, `src/statements/components/TransactionSeeder.jsx`, `src/statements/components/TransactionManager.jsx`
- **User Request**: *"make sure random data should generate debt and creds both ! check random generation logic in all random btns"*
- **Screenshot**: `uploaded_media_1795282881560.png` (red circle around `Fill gaps with random` and seeder actions)
- **Category**: Data Generation & Seeder Engine
- **Context**:
  - In `src/statements/lib/seeder.js`, `fillTransactionGaps()` strictly produces debits (`newDebits`), never generating any incoming credit transactions.
  - `generateSeedTransactions()` only generates a single monthly salary credit, with all remaining daily transactions (~150-300 items) forced as debits.
  - Authentic Indian bank statements consistently feature auxiliary incoming credits such as P2P UPI transfers (friends/family reimbursements), merchant refunds (Amazon, Flipkart), cashbacks, and quarterly bank interest credits.
- **Proposed Solution**:
  - Enhance `seeder.js` with realistic secondary credit transaction generators:
    - **P2P UPI Received**: Payments received from individuals via UPI (`₹300 - ₹5,000`).
    - **E-Commerce Refunds / Cashbacks**: Reversals from Amazon, Swiggy, Flipkart (`₹150 - ₹2,500`).
    - **Bank Savings Interest**: Quarterly interest credits (`INT.PD` / `1.5% - 3.5% p.a.`).
  - In `fillTransactionGaps()`: Allocate ~5–12% of generated gap items to realistic incoming credits, naturally replenishing the account's liquidity and preventing low-balance throttling.
  - In `generateSeedTransactions()`: Intersperse 2–4 auxiliary incoming credits per month alongside the main corporate salary credit.
  - Invariant: Keep integer paise financial calculations exact (`toPaise` / `plainAmount`) and guarantee closing balances remain strictly positive.
- **Status**: **APPROVED & IMPLEMENTED (Batch 2)**

### [CR-017] (Item 12/13): Separate Transactions into Dedicated Card with Header `+` / `−` Controls
- **Components**: `src/statements/components/TransactionManager.jsx`, `src/statements/components/Editor.jsx`
- **User Request**: *"make this section into card seperate and on right side top add + - btn to add each new entry manually"*
- **Screenshot**: `uploaded_media_1795283009008.png` (red circle around transaction section header & actions)
- **Category**: Form Layout & UX / Card Architecture
- **Context**:
  - `TransactionManager.jsx` currently renders as an embedded panel attached below `AccountForm` without clear card container boundaries.
  - All 6 transaction input fields sit statically in an open fieldset, lacking standard card elevation and quick manual entry manipulation buttons.
- **Proposed Solution**:
  - Encapsulate the Transaction section into a standalone, styled `<Card>` component matching the Slot Profile design language.
  - Implement a dedicated card header featuring:
    - **Header Title**: "Transactions" with transaction count badge.
    - **Top-Right Action Controls**:
      - `+` (Add entry) and `−` (Remove entry / clear draft) icon buttons using `ICONS.plus` and `ICONS.minus` for quick manual manipulation.
      - Existing batch actions: `Import JSON` and `Fill gaps with random`.
  - Provides clear spatial separation between Account metadata and Transaction ledger management.
- **Status**: **APPROVED & IMPLEMENTED (Batch 2)**

### [CR-018] (Item 13a/13): Remove "Load .json" and "Save .json" Header Action Buttons
- **Component**: `src/statements/components/Editor.jsx`
- **User Request**: *"red : remove btns"*
- **Screenshot**: `uploaded_media_1795283363259.png` (red circle around `Load .json` and `Save .json` in editor header)
- **Category**: Top Header & Toolbar Simplification
- **Context**:
  - In `Editor.jsx` (lines 140-141), `Load .json` and `Save .json` action buttons sit in the top-right header actions beside `Load demo` and `Reset`.
  - Auto-saving to `localStorage` is already robust and instantaneous (CR-005), and dedicated JSON transaction import is available inside the Transactions card. Having manual JSON file dump buttons in the primary header adds visual noise.
- **Proposed Solution**:
  - Remove `<Button size="sm" variant="plain" onClick={() => fileRef.current?.click()}>Load .json</Button>` and `<Button size="sm" variant="plain" onClick={saveFile}>Save .json</Button>` from `Editor.jsx`.
  - Keep `Reset` and `Load demo` (or move export to an explicit secondary menu if needed later).
- **Status**: **DOCUMENTED (Ready for implementation)**

---

### [CR-019] (Item 13b/13): Client-Side "Import PDF" with Intelligent Bank Auto-Detection (Kotak / HDFC)
- **Components**: `src/statements/components/AccountForm.jsx`, `src/statements/lib/pdfParser.js` (new), `src/statements/components/Editor.jsx`
- **User Request**: *"green : add a import pdf btn there lets think how can we detct user uploload pdf is hdfc or kotak and make sure import from pdf as how json works !"*
- **Screenshot**: `uploaded_media_1795283363259.png` (green circle at top right of "Bank & Account" section)
- **Category**: PDF Ingestion & Intelligent OCR/Text Parser
- **Context**:
  - Users frequently obtain existing authentic bank statements as PDF files from Kotak Mahindra Bank or HDFC Bank.
  - Currently, statements can only be entered manually, seeded from random generators, or imported via specialized JSON files.
  - Users want a 1-click **"Import PDF"** button situated right at the top of the "Bank & Account" form that ingests an authentic bank statement PDF, detects whether it is Kotak or HDFC, extracts customer metadata and transactions, and populates the entire statement editor automatically.
- **Proposed Architecture & Solution**:
  1. **Placement**: Add an `[ Import PDF ]` action button with `<Icon d={ICONS.import} />` in the header / legend of the "Bank & Account" fieldset (as shown in the green circle).
  2. **Zero-Backend Client-Side Parsing via `pdfjs-dist`**:
     - `pdfjs-dist` is already bundled in the project (`pdfjs.getDocument(...)`).
     - When a user selects a `.pdf`, read array buffer and load document via `pdfjs`.
     - Extract raw text streams and line layout positions across all pages.
  3. **Heuristic Bank Auto-Detection**:
     - Search page 1 text for distinguishing signature tokens:
       - **Kotak Mahindra Bank**: Matches `/kotak/i`, `/kkbk/i`, `kotak 811`, `CRN :`, `KKBK0\d{6}`.
       - **HDFC Bank**: Matches `/hdfc/i`, `We understand your world`, `Cust ID :`, `HDFC0\d{6}`.
  4. **Entity Extraction (Regex & Layout Patterns)**:
     - **Account Info**: Account number, Account type, Branch, Customer ID / CRN, IFSC.
     - **Period & Balances**: Start date, End date, Opening balance, Closing balance.
     - **Transactions Table**:
       - Parse line by line using tabular column anchors (Date regex `\d{2}[-/]\w{3}[-/]\d{2,4}` or `\d{2}/\d{2}/\d{4}`).
       - Extract: Transaction Date, Value Date, Narration / Description, Cheque / Reference No, Withdrawal (Debit), Deposit (Credit), Running Balance.
  5. **State Ingestion**:
     - Call `normalizeStatement()` on the parsed payload and update the statement state atomically (updating both `account` and `transactions` via `onUpdateStatement`).
     - Display a success toast notification: `"Successfully imported X transactions and account details from Kotak/HDFC statement."`
- **Status**: **DOCUMENTED (Ready for implementation)**

### [CR-020] (Item 14): Rename "Reset" Header Button Label to "Clear"
- **Component**: `src/statements/components/Editor.jsx`
- **User Request**: *"rename reset label to clear"*
- **Screenshot**: `uploaded_media_1795283552165.png` (red circle around `Reset` button in editor header)
- **Category**: Top Header & Toolbar Simplification
- **Context**:
  - In `Editor.jsx` (line 141), the button that resets statement fields back to a blank template is labeled "Reset":
    ```jsx
    <Button size="sm" variant="danger" onClick={resetForm}>Reset</Button>
    ```
  - "Clear" is more intuitive and user-friendly for emptying or clearing all filled form entries.
- **Proposed Solution**:
  - Update the button label from "Reset" to "Clear":
    ```jsx
    <Button size="sm" variant="danger" onClick={resetForm}>Clear</Button>
    ```
  - Keep the confirmation prompt (`"Clear all account details and transactions in this statement? This cannot be undone."`) and resetting logic intact.
- **Status**: **DOCUMENTED (Ready for implementation)**

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
