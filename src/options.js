// Order = 6×2 grid on the sheet, filled column by column (first 6 left, last 6 right).
export const TECH = ['Python', 'JAVA', '.NET', 'Node.JS', 'PHP', 'ReactJS', 'Cyber Security', 'DevOps (AWS, GCP, AZURE)', 'Tech Supp', 'BA', 'Data Engg', 'UI/UX']
export const PHASES = [['inquiry', 'Inquiry'], ['confirmed', 'Confirmed']]

// Advance payment: the amount paid decides the status. Older records only had a "Paid" tick (advancePaid) = fully paid.
export const ADVANCE_DUE = 20000
export const ADVANCE_STATUS = [['paid', 'Fully Paid'], ['partial', 'Partially Paid'], ['unpaid', 'Unpaid']]
export function advance(r) {
  const paid = r.advanceAmount != null && r.advanceAmount !== '' ? Number(r.advanceAmount) || 0 : r.advancePaid ? ADVANCE_DUE : 0
  const status = paid >= ADVANCE_DUE ? 'paid' : paid > 0 ? 'partial' : 'unpaid'
  return { paid, due: Math.max(ADVANCE_DUE - paid, 0), status }
}
