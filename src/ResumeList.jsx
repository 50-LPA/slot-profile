import { useState } from 'react'
import { ICONS } from './icons.jsx'
import { Button, Card, CardHeader, CircleButton, FilterSelect, Pill, SearchInput } from './ui.jsx'
import { PHASES, PHASE_TONE, phaseLabel, resumeSaved } from './options.js'
import { paginate } from './list.js'

const go = (hash) => (window.location.hash = hash)
const th = 'border border-gray-200 px-3 py-2 font-bold text-gray-700'
const td = 'border border-gray-200 px-3 py-2'
const STATUS = [['all', 'All resumes'], ['ready', 'Ready'], ['none', 'Not started']]

// Resumes tab: every candidate with their resume status; opening one builds or edits their resume (#/r/<id>).
export default function ResumeList({ rows, error, refreshing, refresh }) {
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('all')
  const [phase, setPhase] = useState('all')
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(25)
  const reset = (fn) => (v) => { fn(v); setPage(1) } // any filter change goes back to page 1
  const term = q.trim().toLowerCase()
  const shown = (rows ?? []).filter((r) =>
    (!term || r.name?.toLowerCase().includes(term) || r.phone?.includes(term)) &&
    (status === 'all' || (status === 'ready') === !!r.hasResume) &&
    (phase === 'all' || r.phase === phase))
  const pg = paginate(shown, page, size)
  const made = (rows ?? []).filter((r) => r.hasResume).length
  const badge = (r) => (r.hasResume ? <Pill tone="green">Ready</Pill> : <Pill tone="gray">Not started</Pill>)
  const open = (r) => <Button size="sm" variant={r.hasResume ? 'warning' : 'primary'} icon={r.hasResume ? ICONS.pencil : ICONS.plus} onClick={() => go(`#/r/${r.id}`)}>{r.hasResume ? 'Edit' : 'Build'}</Button>

  return (
    <Card>
      <CardHeader
        onBack={() => history.back()}
        title="Resume Builder"
        extra={<CircleButton icon={ICONS.refresh} label="Refresh list" onClick={refresh} disabled={refreshing} dim={refreshing} />}
      />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <p className="mr-auto text-xs text-gray-500"><b className="text-base text-gray-900">{made}</b> of {rows?.length ?? '–'} candidates have a resume</p>
        <FilterSelect label="Resume status" value={status} onChange={reset(setStatus)} options={STATUS} className="md:w-36" />
        <FilterSelect label="Phase" value={phase} onChange={reset(setPhase)} options={[['all', 'All Phases'], ...PHASES]} className="md:w-32" />
        <SearchInput label="Search candidates" value={q} onChange={reset(setQ)} placeholder="Name or phone..." className="md:w-52" />
      </div>

      {error && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-600">Could not load candidates: {error}</p>}
      {!rows && !error && <p className="mt-4 text-center text-sm text-gray-500">Loading…</p>}
      {rows && (
        <>
          <div className="mt-3 hidden overflow-x-auto md:block">
            <table className="w-full border-collapse text-center text-[13px] text-gray-800">
              <thead className="bg-gray-50">
                <tr>
                  <th className={`${th} w-10`}>Sr.</th>
                  <th className={`${th} text-left`}>Candidate Name</th>
                  <th className={th}>Phone</th>
                  <th className={th}>Career Technology</th>
                  <th className={th}>Phase</th>
                  <th className={th}>Resume</th>
                  <th className={th}>Last Saved</th>
                  <th className={th}>Action</th>
                </tr>
              </thead>
              <tbody>
                {pg.items.map((r, i) => (
                  <tr key={r.id} className="hover:bg-brand-50/30">
                    <td className={td}>{pg.first + i}</td>
                    <td className={`${td} text-left`}><a href={`#/c/${r.id}/view`} className="hover:text-brand-600 hover:underline">{r.name || '-'}</a></td>
                    <td className={td}>{r.phone || '-'}</td>
                    <td className={td}>{r.tech?.length ? r.tech.join(', ') : '-'}</td>
                    <td className={td}><Pill tone={PHASE_TONE[r.phase]}>{phaseLabel(r)}</Pill></td>
                    <td className={td}>{badge(r)}</td>
                    <td className={td}>{resumeSaved(r) || '-'}</td>
                    <td className={td}><div className="flex justify-center">{open(r)}</div></td>
                  </tr>
                ))}
                {shown.length === 0 && <tr><td colSpan={8} className={`${td} py-8 text-gray-500`}>{rows.length ? 'No candidate matches these filters.' : 'No candidates yet. Add one in the Candidates tab.'}</td></tr>}
              </tbody>
            </table>
          </div>
          <ul className="mt-3 space-y-2 md:hidden">
            {pg.items.map((r) => (
              <li key={r.id} className="flex items-center gap-2 rounded-xl border border-gray-200 p-3 text-[13px]">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-gray-900">{r.name || '-'}</p>
                  <p className="text-xs text-gray-500">{r.phone || 'No phone'}{r.tech?.length ? ` · ${r.tech.join(', ')}` : ''}</p>
                  {resumeSaved(r) && <p className="text-xs text-gray-400">Saved {resumeSaved(r)}</p>}
                </div>
                {badge(r)}
                {open(r)}
              </li>
            ))}
            {shown.length === 0 && <li className="py-8 text-center text-sm text-gray-500">{rows.length ? 'No candidate matches these filters.' : 'No candidates yet.'}</li>}
          </ul>

          {shown.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600">
              <span>Showing <b>{pg.first}–{pg.last}</b> of <b>{shown.length}</b></span>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5">
                  Per page
                  <select value={size} onChange={(e) => reset(setSize)(Number(e.target.value))} aria-label="Rows per page"
                    className="h-8 rounded-full border border-gray-200 bg-white px-2 text-[13px] outline-none">
                    {[25, 50, 100].map((n) => <option key={n}>{n}</option>)}
                  </select>
                </label>
                <CircleButton icon={ICONS.back} label="Previous page" disabled={pg.page <= 1} dim={pg.page <= 1} onClick={() => setPage(pg.page - 1)} />
                <span className="min-w-16 text-center">Page <b>{pg.page}</b> / {pg.pages}</span>
                <CircleButton icon={ICONS.arrow} label="Next page" disabled={pg.page >= pg.pages} dim={pg.page >= pg.pages} onClick={() => setPage(pg.page + 1)} />
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  )
}
