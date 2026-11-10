// Order = 7×2 grid on the sheet, filled column by column (first 7 left, rest right).
export const TECH = ['Python', 'JAVA', '.NET', 'Node.JS', 'PHP', 'ReactJS', 'Cyber Security', 'Other', 'Tech Supp', 'BA', 'Data Engg', 'UI/UX', 'DevOps (AWS, GCP, AZURE)']
export const PHASES = [['inquiry', 'Inquiry'], ['confirmed', 'Confirmed']]
export const phaseOf = (r) => (r.phase === 'confirmed' ? 'confirmed' : 'inquiry') // older records: no phase, or the dropped 'selected'
export const phaseLabel = (r) => PHASES.find(([v]) => v === phaseOf(r))?.[1] ?? 'Inquiry'
export const PHASE_TONE = { inquiry: 'gray', confirmed: 'green' } // Pill tones
// Visit dates ("03-NOV-2026"), as entered. Older records saved one `visitDate` string.
export const visitsOf = (r) => (r.visitDates ?? [r.visitDate]).filter(Boolean)

// Advance payment: the amount paid decides the status. Older records only had a "Paid" tick (advancePaid) = fully paid.
export const ADVANCE_DUE = 20000
export const ADVANCE_STATUS = [['paid', 'Fully Paid'], ['partial', 'Partially Paid'], ['unpaid', 'Unpaid']]
export function advance(r) {
  const paid = r.advanceAmount != null && r.advanceAmount !== '' ? Number(r.advanceAmount) || 0 : r.advancePaid ? ADVANCE_DUE : 0
  const status = paid >= ADVANCE_DUE ? 'paid' : paid > 0 ? 'partial' : 'unpaid'
  return { paid, due: Math.max(ADVANCE_DUE - paid, 0), status }
}
