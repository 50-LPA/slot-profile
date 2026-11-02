// Month math for the career timeline. Dates are "YYYY-MM" strings (what <input type="month"> gives).
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export const toIdx = (ym) => (/^\d{4}-\d{2}$/.test(ym ?? '') ? Number(ym.slice(0, 4)) * 12 + Number(ym.slice(5)) - 1 : null)
export const nowIdx = (d = new Date()) => d.getFullYear() * 12 + d.getMonth()
export const monthLabel = (i) => `${MON[i % 12]} ${Math.floor(i / 12)}`
export const span = (months) =>
  [Math.floor(months / 12) && `${Math.floor(months / 12)}y`, months % 12 && `${months % 12}m`].filter(Boolean).join(' ') || '0m'

// Turns the form's passOut + companies into positioned pieces (left/width in %) for drawing.
export function layout(passOut, companies = [], now = nowIdx()) {
  const jobs = companies
    .map((c) => {
      const from = toIdx(c.from)
      const to = c.present ? now : toIdx(c.to) ?? from
      return from === null ? null : { ...c, from, to: Math.max(to, from) }
    })
    .filter(Boolean)
  const p = toIdx(passOut)
  const points = [p, ...jobs.flatMap((j) => [j.from, j.to])].filter((x) => x !== null)
  if (!points.length) return null
  const start = Math.min(...points)
  const end = Math.max(...points, start + 12) // at least a year wide
  const pct = (i) => ((i - start) / (end - start)) * 100
  const step = end - start > 15 * 12 ? 2 : 1
  const years = []
  for (let y = Math.ceil(start / 12); y * 12 <= end; y += step) years.push({ year: y, left: pct(y * 12) })
  return {
    passOut: p === null ? null : { label: monthLabel(p), left: pct(p) },
    jobs: jobs.map((j) => ({ ...j, left: pct(j.from), width: pct(j.to) - pct(j.from), months: j.to - j.from })),
    years,
  }
}

// Total months worked across companies; overlapping jobs are counted once. null when no company has a joining date.
export function totalMonths(companies = [], now = nowIdx()) {
  const spans = companies
    .map((c) => [toIdx(c.from), c.present ? now : toIdx(c.to)])
    .filter(([a, b]) => a !== null && b !== null && b > a)
    .sort((x, y) => x[0] - y[0])
  if (!companies.some((c) => toIdx(c.from) !== null)) return null
  let total = 0, end = -Infinity
  for (const [a, b] of spans) {
    if (b <= end) continue
    total += b - Math.max(a, end)
    end = b
  }
  return total
}
