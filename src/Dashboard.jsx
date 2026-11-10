// Home page: the numbers at a glance. Every tile opens the candidate list already filtered to it.
import { ICONS, Icon } from './icons.jsx'
import { Button, CircleButton, Pill } from './ui.jsx'
import { ADVANCE_DUE, PHASE_TONE, phaseLabel } from './options.js'
import { stats } from './list.js'

const rupees = (n) => '₹ ' + n.toLocaleString('en-IN')
const DOT = { gray: 'bg-gray-400', sky: 'bg-sky-500', green: 'bg-emerald-500', amber: 'bg-amber-400', red: 'bg-red-500', purple: 'bg-purple-500' }

function Tile({ label, value, note, tone = 'purple', href }) {
  return (
    <a href={href} className="group rounded-2xl border border-gray-200 bg-white p-4 shadow-sm hover:border-purple-300">
      <p className="flex items-center gap-1.5 text-xs font-bold text-gray-500">
        <span className={`h-2 w-2 rounded-full ${DOT[tone]}`} /> {label}
      </p>
      <p className="mt-1.5 text-2xl font-bold leading-none text-gray-900">{value}</p>
      <p className="mt-1.5 flex items-center justify-between text-xs text-gray-400">
        <span>{note}</span>
        <Icon d={ICONS.chevron} className="h-3.5 w-3.5 text-gray-300 group-hover:text-purple-500" />
      </p>
    </a>
  )
}

const Section = ({ title, children }) => (
  <section className="mt-5">
    <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400">{title}</h2>
    {children}
  </section>
)

export default function Dashboard({ rows, error, refreshing, refresh }) {
  if (error) return <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">Could not load candidates: {error}</p>
  if (!rows) return <p className="p-6 text-center text-sm text-gray-500">Loading…</p>
  const s = stats(rows)
  const pct = (n) => (s.total ? `${Math.round((n / s.total) * 100)}% of all` : '—')
  const L = '#/candidates'
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-lg font-bold text-gray-900">Overview</h1>
        <CircleButton icon={ICONS.refresh} label="Refresh numbers" onClick={refresh} disabled={refreshing} dim={refreshing} />
        <Button icon={ICONS.plus} onClick={() => (window.location.hash = '#/new')}><span className="hidden sm:inline">Add Candidate</span></Button>
      </div>

      <Section title="Candidates">
        <div className="grid grid-cols-3 gap-3">
          <Tile label="Total" value={s.total} note={`${s.visits} visited this month`} href={`${L}?phase=all`} />
          <Tile label="Inquiry" value={s.byPhase.inquiry} note={pct(s.byPhase.inquiry)} tone="gray" href={`${L}?phase=inquiry`} />
          <Tile label="Confirmed" value={s.byPhase.confirmed} note={pct(s.byPhase.confirmed)} tone="green" href={`${L}?phase=confirmed`} />
        </div>
      </Section>

      <Section title={`Advance (${rupees(ADVANCE_DUE)} each)`}>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Tile label="Collected" value={rupees(s.advance.collected)} note={`${s.advance.paid} fully paid`} tone="green" href={`${L}?paid=paid`} />
          <Tile label="Pending" value={rupees(s.advance.pending)} note="from Confirmed" tone="amber" href={`${L}?sort=advance&dir=asc`} />
          <Tile label="Partially paid" value={s.advance.partial} note="candidates" tone="amber" href={`${L}?paid=partial`} />
          <Tile label="Unpaid" value={s.advance.unpaid} note="candidates" tone="red" href={`${L}?paid=unpaid`} />
        </div>
      </Section>

      <div className="grid gap-x-3 lg:grid-cols-2">
        <Section title="Top technologies">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            {s.topTech.length === 0 && <p className="text-sm text-gray-400">No technologies ticked yet.</p>}
            <ul className="space-y-2.5">
              {s.topTech.map(([t, n]) => (
                <li key={t}>
                  <a href={`${L}?tech=${encodeURIComponent(t)}`} className="block text-[13px] hover:text-purple-600">
                    <span className="flex justify-between"><span>{t}</span><b>{n}</b></span>
                    <span className="mt-1 block h-1.5 rounded-full bg-gray-100">
                      <span className="block h-full rounded-full bg-purple-400" style={{ width: `${(n / s.topTech[0][1]) * 100}%` }} />
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </Section>

        <Section title="Recently updated">
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
            {s.recent.length === 0 && <p className="p-4 text-sm text-gray-400">No candidates yet.</p>}
            <ul className="divide-y divide-gray-100">
              {s.recent.map((r) => (
                <li key={r.id}>
                  <a href={`#/c/${r.id}/view`} className="flex items-center justify-between gap-2 px-4 py-2.5 text-[13px] hover:bg-purple-50/40">
                    <span className="min-w-0">
                      <span className="block truncate font-bold text-gray-800">{r.name || '-'}</span>
                      <span className="block text-xs text-gray-400">{r.phone || 'No phone'}</span>
                    </span>
                    <Pill tone={PHASE_TONE[r.phase]}>{phaseLabel(r)}</Pill>
                  </a>
                </li>
              ))}
            </ul>
            <a href={`${L}?phase=all`} className="block border-t border-gray-100 px-4 py-2 text-center text-xs font-bold text-purple-600 hover:bg-purple-50/40">All candidates →</a>
          </div>
        </Section>
      </div>
    </div>
  )
}
