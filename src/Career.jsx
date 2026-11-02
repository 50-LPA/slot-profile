import { layout, monthLabel, span, toIdx } from './career.js'
import { ICONS, Icon } from './icons.jsx'
import { Button } from './ui.jsx'

const COLORS = [
  'border-purple-400 bg-purple-50 text-purple-900',
  'border-sky-400 bg-sky-50 text-sky-900',
  'border-emerald-400 bg-emerald-50 text-emerald-900',
  'border-amber-400 bg-amber-50 text-amber-900',
  'border-rose-400 bg-rose-50 text-rose-900',
]

// Drawn on the A4 sheet, in the 41mm free space: company blocks sitting on a line, years and pass-out under it.
export function CareerTimeline({ passOut, companies }) {
  const t = layout(passOut, companies)
  return (
    <div className="relative h-[40mm] shrink-0 [print-color-adjust:exact]">
      {t ? (
        <>
          {/* track area, inset so edge labels don't spill off the page */}
          <div className="absolute inset-x-[6mm] top-[7mm] bottom-0">
            {/* Pass-out marker: dashed purple guide down to the line (behind the company blocks) */}
            {t.passOut && (
              <div className="absolute top-0 h-[14mm] -translate-x-1/2 border-l-[0.4mm] border-dashed border-purple-500" style={{ left: `${t.passOut.left}%` }} />
            )}
            {t.jobs.map((j, i) => (
              <div
                key={i}
                title={`${j.name} · ${monthLabel(j.from)} – ${j.present ? 'Present' : monthLabel(j.to)}`}
                className={`absolute top-0 flex h-[13mm] min-w-[3mm] flex-col justify-center overflow-hidden rounded-[1.5mm] border px-[1.5mm] text-center leading-tight ${COLORS[i % COLORS.length]}`}
                style={{ left: `${j.left}%`, width: `${j.width}%` }}
              >
                <span className="truncate text-[8.5pt] font-bold">{j.name || 'Company'}</span>
                <span className="truncate text-[6.5pt]">
                  {monthLabel(j.from).replace(/ \d\d(\d\d)$/, " '$1")} – {j.present ? 'Present' : monthLabel(j.to).replace(/ \d\d(\d\d)$/, " '$1")}
                </span>
                <span className="truncate text-[6.5pt] opacity-70">{span(j.months)}</span>
              </div>
            ))}

            {/* the line */}
            <div className="absolute inset-x-0 top-[14mm] h-[0.5mm] rounded bg-gray-800" />
            {t.years.map((y) => (
              <div key={y.year} className="absolute top-[14mm] -translate-x-1/2 text-center" style={{ left: `${y.left}%` }}>
                <div className="mx-auto h-[1.8mm] w-[0.3mm] bg-gray-800" />
                <span className="text-[7pt] text-gray-600">{y.year}</span>
              </div>
            ))}

            {t.passOut && (
              <div className="absolute top-[12.2mm] z-10 -translate-x-[2mm]" style={{ left: `${t.passOut.left}%` }}>
                <div className="h-[4mm] w-[4mm] rounded-full border-[0.8mm] border-white bg-purple-600 shadow-[0_0_0_0.5mm_theme(colors.purple.600),0_0_0_1.4mm_theme(colors.purple.200)]" />
                <span className="mt-[4mm] block whitespace-nowrap text-[7.5pt] font-bold leading-tight text-purple-700">🎓 Pass-out</span>
                <span className="mt-[0.6mm] inline-block whitespace-nowrap rounded-full bg-purple-600 px-[1.8mm] py-[0.3mm] text-[7.5pt] font-bold text-white">{t.passOut.label}</span>
              </div>
            )}
          </div>
        </>
      ) : (
        <p className="no-print flex h-full items-center justify-center text-[9pt] text-gray-300">
          Add pass-out and company details on the right to draw the career timeline here.
        </p>
      )}
    </div>
  )
}

const input = 'h-8 w-full rounded-lg border border-gray-200 bg-white px-2.5 text-[13px] text-gray-800 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 disabled:bg-gray-50 disabled:text-gray-400'
// Narrow: "# name ×" then "joining exit present" below. Wide (@xl): # · name · joining · exit · present · ×.
const row = 'grid grid-cols-[20px_minmax(0,1fr)_minmax(0,1fr)_24px] items-center gap-1.5 @xl:grid-cols-[20px_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_44px_24px]'

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
const YEARS = Array.from({ length: new Date().getFullYear() - 2010 + 1 }, (_, i) => String(2010 + i)) // 2010 → this year

// Month dropdown then year dropdown, stored as "YYYY-MM" (half-filled stays "YYYY-" / "-MM" and is ignored by the timeline).
function MonthYear({ value = '', onChange, label, disabled, invalid }) {
  const [y = '', m = ''] = value.split('-')
  const put = (yy, mm) => onChange(yy || mm ? `${yy}-${mm}` : '')
  const cls = `${input} select-sm px-1.5 ${invalid ? 'border-red-400 text-red-600' : ''}`
  return (
    <span className="grid grid-cols-2 gap-1" title={invalid ? 'Exit date is before the joining date' : undefined}>
      <select value={disabled ? '' : m} disabled={disabled} onChange={(e) => put(y, e.target.value)} aria-label={`${label} month`} className={cls}>
        <option value="">{disabled ? '—' : 'Month'}</option>
        {MONTHS.map((name, i) => <option key={name} value={String(i + 1).padStart(2, '0')}>{name}</option>)}
      </select>
      <select value={disabled ? '' : y} disabled={disabled} onChange={(e) => put(e.target.value, m)} aria-label={`${label} year`} className={cls}>
        <option value="">{disabled ? '—' : 'Year'}</option>
        {YEARS.map((yr) => <option key={yr}>{yr}</option>)}
      </select>
    </span>
  )
}

// Side panel next to the sheet: pass-out month + any number of companies.
export function CareerFields({ passOut, companies, onPassOut, onCompanies }) {
  const update = (i, patch) => onCompanies(companies.map((c, j) => (j === i ? { ...c, ...patch } : c)))
  // Only one company can be the current one; clicking the selected radio again clears it.
  const setPresent = (i) => onCompanies(companies.map((c, j) => ({ ...c, present: j === i ? !c.present : false })))
  return (
    <div className="space-y-4 font-lato">
      <div className="flex items-center gap-3">
        <span className="whitespace-nowrap text-xs font-bold text-gray-600">Pass-out month &amp; year</span>
        <span className="flex-1"><MonthYear value={passOut} onChange={onPassOut} label="Pass-out" /></span>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-gray-600">Company details ({companies.length})</span>
        <Button size="sm" icon={ICONS.plus} onClick={() => onCompanies([...companies, { name: '', from: '', to: '', present: false }])}>Add company</Button>
      </div>

      {companies.length === 0 && <p className="py-2 text-xs text-gray-400">No companies yet. Click “Add company”.</p>}

      {/* One compact row per company; column labels shown once. Falls back to three lines when the panel is narrow. */}
      {companies.length > 0 && (
        <div className="@container">
          <div className={`${row} hidden border-b border-gray-200 pb-1 text-[11px] font-bold text-gray-500 @xl:grid`}>
            <span>#</span><span>Company name</span><span>Joining</span><span>Exit</span><span className="text-center">Present</span><span />
          </div>
          <div>
            {companies.map((c, i) => {
              const badExit = !c.present && toIdx(c.to) !== null && toIdx(c.from) !== null && toIdx(c.to) < toIdx(c.from)
              return (
                <div key={i} className={`${row} border-b border-gray-100 py-2 ${badExit ? 'bg-red-50' : ''}`}>
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-purple-100 text-[11px] font-bold text-purple-600">{i + 1}</span>
                  <input value={c.name} onChange={(e) => update(i, { name: e.target.value })} placeholder="Company name" aria-label={`Company ${i + 1} name`} className={`${input} col-span-2 @xl:col-span-1`} />
                  <span className="col-span-2 col-start-1 row-start-2 @xl:col-span-1 @xl:col-auto @xl:row-auto">
                    <span className="mb-0.5 block text-[11px] font-bold text-gray-500 @xl:hidden">Joining</span>
                    <MonthYear value={c.from} onChange={(v) => update(i, { from: v })} label={`Company ${i + 1} joining`} />
                  </span>
                  <span className="col-span-2 col-start-3 row-start-2 @xl:col-span-1 @xl:col-auto @xl:row-auto">
                    <span className="mb-0.5 block text-[11px] font-bold text-gray-500 @xl:hidden">Exit</span>
                    <MonthYear value={c.to} onChange={(v) => update(i, { to: v })} label={`Company ${i + 1} exit`} disabled={c.present} invalid={badExit} />
                  </span>
                  <label className="col-span-3 col-start-2 row-start-3 @xl:col-span-1 @xl:col-auto @xl:row-auto flex items-center gap-1 @xl:justify-center text-[11px] text-gray-600" title="Currently working here">
                    <input type="radio" name="present-company" checked={!!c.present} onChange={() => {}} onClick={() => setPresent(i)} className="accent-purple-600" />
                    <span className="@xl:hidden">Currently working here (Present)</span>
                  </label>
                  <button type="button" aria-label={`Remove company ${i + 1}`} title="Remove"
                    onClick={() => onCompanies(companies.filter((_, j) => j !== i))}
                    className="col-start-4 row-start-1 @xl:col-auto @xl:row-auto flex h-6 w-6 items-center justify-center justify-self-end rounded-md border border-red-500 bg-white text-red-500 hover:bg-red-50">
                    <Icon d={ICONS.trash} className="h-3.5 w-3.5" />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
