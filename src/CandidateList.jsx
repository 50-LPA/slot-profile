import { useEffect, useState } from 'react'
import { ICONS, Icon } from './icons.jsx'
import { Button, Card, CardHeader, CircleButton, FilterSelect, IconAction, Pill, SearchInput, SearchSelect } from './ui.jsx'
import { ADVANCE_STATUS, PHASES, PHASE_TONE, TECH, advance, phaseLabel, visitsOf } from './options.js'
import { span } from './career.js'
import { DEFAULT_FILTERS, EXP_OPTIONS, GAP_OPTIONS, expMonths, filterRows, gapOf, lastVisit, paginate, sortRows } from './list.js'
import { removeCandidate, setPhase } from './data.js'

// Phase pill as a button: each click moves to the next phase (Inquiry ↔ Confirmed).
function PhaseButton({ r }) {
  const i = PHASES.findIndex(([v]) => v === r.phase)
  const [next, nextLabel] = PHASES[(i + 1) % PHASES.length]
  return (
    <button type="button" onClick={() => setPhase(r.id, next)} title={`Click to change to ${nextLabel}`}
      aria-label={`Phase ${phaseLabel(r)}, change to ${nextLabel}`}
      className="cursor-pointer select-none rounded-full transition hover:ring-2 hover:ring-purple-200 hover:ring-offset-1">
      <Pill tone={PHASE_TONE[r.phase]}>{phaseLabel(r)}</Pill>
    </button>
  )
}

const go = (hash) => (window.location.hash = hash)
const th = 'border border-gray-200 px-3 py-2 font-bold text-gray-700'
const td = 'border border-gray-200 px-3 py-2'
const dateInput = 'h-8 rounded-full border border-gray-200 bg-white px-3 text-[13px] text-gray-800 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100'

// 1000000 → "10 LPA", 1050000 → "10.5 LPA" (list only; the form keeps the full number).
const lpa = (v) => (Number(v) ? `${+(Number(v) / 1e5).toFixed(1)} LPA` : '-')
const expLabel = (r) => {
  const m = expMonths(r)
  return m ? [Math.floor(m / 12) && `${Math.floor(m / 12)} yrs`, m % 12 && `${m % 12} mos`].filter(Boolean).join(' ') : '-'
}
// Gap column: red when there is one, "-" for no gap or no career dates.
function GapText({ r }) {
  const g = gapOf(r)
  return g ? <span className="font-bold text-red-700">{span(g)}</span> : '-'
}
// Advance column: status only, coloured with an icon — green Fully Paid · amber Partial · red Unpaid.
const ADVANCE_LOOK = {
  paid: ['Fully Paid', 'text-emerald-700', ICONS.checkCircle],
  partial: ['Partial', 'text-amber-700', ICONS.clock],
  unpaid: ['Unpaid', 'text-red-700', ICONS.xCircle],
}
function AdvanceText({ r }) {
  const [label, color, icon] = ADVANCE_LOOK[advance(r).status]
  return <span className={`inline-flex items-center gap-1 font-bold ${color}`}><Icon d={icon} className="h-4 w-4" /> {label}</span>
}

// Last visit, plus how many visits in all when more than one ("05-NOV-2026 ×3"); every date on hover.
function VisitDate({ r }) {
  const all = visitsOf(r)
  return <span title={all.join(', ')}>{lastVisit(r) || '-'}{all.length > 1 && <span className="ml-1 text-xs font-bold text-purple-600">×{all.length}</span>}</span>
}

// Filters live in the URL (#/candidates?phase=confirmed&page=2): links from the home page set them, Back keeps them.
const readFilters = () => ({ ...DEFAULT_FILTERS, ...Object.fromEntries(new URLSearchParams(window.location.hash.split('?')[1])) })
function writeFilters(f) {
  const qs = new URLSearchParams(Object.entries(f).filter(([k, v]) => v !== DEFAULT_FILTERS[k])).toString()
  history.replaceState(null, '', '#/candidates' + (qs ? '?' + qs : ''))
}

const SORT_OPTIONS = [['updated', 'Recently updated'], ['name', 'Name'], ['visit', 'Last visit date'], ['exp', 'Experience'], ['ctc', 'CTC'], ['gap', 'Career gap'], ['advance', 'Advance paid'], ['phase', 'Phase']]

export default function CandidateList({ rows, error, refreshing, refresh }) {
  const [f, setF] = useState(readFilters)
  const [open, setOpen] = useState(false) // filter panel on phones
  useEffect(() => writeFilters(f), [f])
  // Any filter change goes back to page 1; paging itself keeps the filters.
  const set = (k) => (v) => setF((p) => ({ ...p, [k]: v, ...(k === 'page' ? {} : { page: '1' }) }))
  const sortBy = (key) => setF((p) => ({ ...p, sort: key, dir: p.sort === key && p.dir === 'asc' ? 'desc' : 'asc', page: '1' }))

  const references = [...new Set((rows ?? []).map((r) => r.reference?.trim()).filter(Boolean))].sort()
  const shown = sortRows(filterRows(rows ?? [], f), f.sort, f.dir)
  const pg = paginate(shown, Number(f.page) || 1, Number(f.size) || 25)
  const active = ['paid', 'tech', 'exp', 'ref', 'phase', 'gap'].filter((k) => f[k] !== DEFAULT_FILTERS[k]).length

  // Clickable column header: click sorts A→Z / low→high, click again reverses. ▲ / ▼ shows the current order.
  const sortTh = (k, label, className = '') => (
    <th className={`${th} ${className}`} aria-sort={f.sort === k ? (f.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
      <button type="button" onClick={() => sortBy(k)} className="inline-flex items-center gap-1 hover:text-purple-600" title={`Sort by ${label}`}>
        {label}<span className={`text-[10px] ${f.sort === k ? 'text-purple-600' : 'text-gray-300'}`}>{f.sort === k && f.dir === 'asc' ? '▲' : '▼'}</span>
      </button>
    </th>
  )
  const actions = (r) => (
    <div className="flex justify-center gap-1.5">
      <IconAction icon={ICONS.eye} tone="sky" label={`View ${r.name}`} onClick={() => go(`#/c/${r.id}/view`)} />
      <IconAction icon={ICONS.pencil} tone="amber" label={`Update ${r.name}`} onClick={() => go(`#/c/${r.id}`)} />
      <IconAction icon={ICONS.trash} tone="red" label={`Delete ${r.name}`} onClick={() => removeCandidate(r.id, r.name)} />
    </div>
  )

  return (
    <Card>
      <CardHeader
        onBack={() => history.back()}
        title="Candidate List"
        extra={<CircleButton icon={ICONS.refresh} label="Refresh list" onClick={refresh} disabled={refreshing} dim={refreshing} />}
        actions={
          <Button icon={ICONS.plus} onClick={() => go('#/new')}>
            <span className="hidden sm:inline">Add Candidate</span>
          </Button>
        }
      />

      {/* Count + filters. Phones: search + a "Filters" button that opens the rest in a 2-column grid. Desktop: one row. */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="mr-auto">
          <p className="text-base font-bold leading-tight text-gray-900">{rows ? shown.length : '–'}</p>
          <p className="text-xs text-gray-500">{!rows || shown.length === rows.length ? 'Total Candidates' : `of ${rows.length} Candidates`}</p>
        </div>
        <Button variant={active ? 'dark' : 'plain'} icon={ICONS.search} className="md:hidden" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          Filters{active ? ` (${active})` : ''}
        </Button>
        <div className={`${open ? 'grid' : 'hidden'} order-last w-full grid-cols-2 gap-2 md:contents`}>
          <FilterSelect label="Advance payment" value={f.paid} onChange={set('paid')} options={[['all', 'All Payments'], ...ADVANCE_STATUS]} className="md:w-32" />
          <FilterSelect label="Phase" value={f.phase} onChange={set('phase')} options={[['all', 'All Phases'], ...PHASES]} className="md:w-28" />
          <FilterSelect label="Career technology" value={f.tech} onChange={set('tech')} placeholder="All Technologies" options={TECH} className="md:w-36" />
          <FilterSelect label="Experience" value={f.exp} onChange={set('exp')} options={EXP_OPTIONS} className="md:w-32" />
          <FilterSelect label="Career gap" value={f.gap} onChange={set('gap')} placeholder="All Gaps" options={GAP_OPTIONS} className="md:w-28" />
          <SearchSelect label="Reference name" value={f.ref} onChange={set('ref')} placeholder="All References" options={references} className="md:w-36" />
          <span className="col-span-2 flex gap-2 md:hidden">
            <FilterSelect label="Sort by" value={f.sort} onChange={set('sort')} options={SORT_OPTIONS} />
            <FilterSelect label="Sort direction" value={f.dir} onChange={set('dir')} options={[['asc', 'Ascending ↑'], ['desc', 'Descending ↓']]} />
          </span>
          {active > 0 && (
            <button type="button" onClick={() => setF((p) => ({ ...DEFAULT_FILTERS, q: p.q, sort: p.sort, dir: p.dir, size: p.size }))}
              className="col-span-2 h-8 rounded-full px-2 text-xs font-bold text-purple-600 hover:bg-purple-50">Clear filters</button>
          )}
        </div>
        <SearchInput label="Search candidates" value={f.q} onChange={set('q')} placeholder="Name, phone or reference..." className="md:w-44" />
      </div>

      {error && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-600">Could not load candidates: {error}</p>}
      {!rows && !error && <p className="mt-4 text-center text-sm text-gray-500">Loading…</p>}
      {rows && (
        <>
          {/* Desktop / tablet: table */}
          <div className="mt-3 hidden overflow-x-auto md:block">
            <table className="w-full min-w-[1000px] border-collapse text-center text-[13px] text-gray-800">
              <thead className="bg-gray-50">
                <tr>
                  <th className={`${th} w-10`}>Sr.</th>
                  {sortTh('name', 'Candidate Name', 'text-left')}
                  {sortTh('visit', 'Last Visit Date')}
                  <th className={th}>Reference</th>
                  <th className={th}>Career Technology</th>
                  {sortTh('exp', 'Experience')}
                  {sortTh('gap', 'Gap')}
                  {sortTh('ctc', 'CTC')}
                  {sortTh('phase', 'Phase')}
                  {sortTh('advance', 'Advance')}
                  <th className={th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pg.items.map((r, i) => (
                  <tr key={r.id} className="hover:bg-purple-50/30">
                    <td className={td}>{pg.first + i}</td>
                    <td className={`${td} text-left`}><div className="flex items-center gap-2">{r.name || '-'}<span title={r.signature ? 'Signed' : 'Not signed'} aria-label={r.signature ? 'Signed' : 'Not signed'} className={`ml-auto shrink-0 ${r.signature ? 'text-emerald-600' : 'text-gray-300'}`}><Icon d={ICONS.signature} className="h-4 w-4" /></span></div></td>
                    <td className={td}><VisitDate r={r} /></td>
                    <td className={td}>{r.reference || '-'}</td>
                    <td className={td}>{r.tech?.length ? r.tech.join(', ') : '-'}</td>
                    <td className={td}>{expLabel(r)}</td>
                    <td className={td}><GapText r={r} /></td>
                    <td className={td}>{lpa(r.ctc)}</td>
                    <td className={td}><PhaseButton r={r} /></td>
                    <td className={td}><AdvanceText r={r} /></td>
                    <td className={td}>{actions(r)}</td>
                  </tr>
                ))}
                {shown.length === 0 && (
                  <tr>
                    <td colSpan={11} className={`${td} py-8 text-gray-500`}>
                      {rows.length ? 'No candidate matches these filters.' : 'No candidates yet. Click “Add Candidate”.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Phones: one card per candidate */}
          <ul className="mt-3 space-y-2 md:hidden">
            {pg.items.map((r) => (
              <li key={r.id} className="rounded-xl border border-gray-200 p-3 text-[13px] text-gray-700">
                <div className="flex items-start justify-between gap-2">
                  <button type="button" onClick={() => go(`#/c/${r.id}/view`)} className="flex flex-1 items-center gap-2 text-left text-sm font-bold text-gray-900">{r.name || '-'}<span title={r.signature ? 'Signed' : 'Not signed'} aria-label={r.signature ? 'Signed' : 'Not signed'} className={`ml-auto shrink-0 ${r.signature ? 'text-emerald-600' : 'text-gray-300'}`}><Icon d={ICONS.signature} className="h-4 w-4" /></span></button>
                  <PhaseButton r={r} />
                </div>
                <p className="mt-0.5 text-xs text-gray-500">
                  {r.phone ? <a href={`tel:${r.phone}`} className="text-purple-600">{r.phone}</a> : 'No phone'} · {lastVisit(r) ? <VisitDate r={r} /> : 'No visit date'}{r.reference ? ` · ${r.reference}` : ''}
                </p>
                {r.tech?.length > 0 && <p className="mt-1.5">{r.tech.join(', ')}</p>}
                <dl className="mt-2 grid grid-cols-3 gap-1 text-xs">
                  <div><dt className="text-gray-400">Experience</dt><dd>{expLabel(r)}</dd></div>
                  <div><dt className="text-gray-400">Gap</dt><dd><GapText r={r} /></dd></div>
                  <div><dt className="text-gray-400">CTC</dt><dd>{lpa(r.ctc)}</dd></div>
                </dl>
                <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-2 text-xs">
                  <AdvanceText r={r} />
                  {actions(r)}
                </div>
              </li>
            ))}
            {shown.length === 0 && (
              <li className="py-8 text-center text-sm text-gray-500">{rows.length ? 'No candidate matches these filters.' : 'No candidates yet. Tap “+” to add one.'}</li>
            )}
          </ul>

          {/* Pager */}
          {shown.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600">
              <span>Showing <b>{pg.first}–{pg.last}</b> of <b>{shown.length}</b></span>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5">
                  Per page
                  <select value={f.size} onChange={(e) => set('size')(e.target.value)} aria-label="Rows per page" className={`${dateInput} px-2`}>
                    {['25', '50', '100'].map((n) => <option key={n}>{n}</option>)}
                  </select>
                </label>
                <CircleButton icon={ICONS.back} label="Previous page" disabled={pg.page <= 1} dim={pg.page <= 1} onClick={() => set('page')(String(pg.page - 1))} />
                <span className="min-w-16 text-center">Page <b>{pg.page}</b> / {pg.pages}</span>
                <CircleButton icon={ICONS.arrow} label="Next page" disabled={pg.page >= pg.pages} dim={pg.page >= pg.pages} onClick={() => set('page')(String(pg.page + 1))} />
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  )
}
