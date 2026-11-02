import { useCallback, useEffect, useRef, useState } from 'react'
import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, orderBy, query, serverTimestamp, setDoc, updateDoc, where,
} from 'firebase/firestore'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { auth, db, loginEmail, withTimeout } from './firebase.js'
import ProfileForm from './ProfileForm.jsx'
import { ICONS, Icon, circleBtn } from './icons.jsx'
import { PHASES, TECH } from './options.js'
import { totalMonths } from './career.js'

const candidates = collection(db, 'candidates')

// Pages live in the URL hash: #/ (list), #/new, #/c/<id> (edit), #/c/<id>/view
const go = (hash) => (window.location.hash = hash)
function useHash() {
  const [hash, setHash] = useState(window.location.hash || '#/')
  useEffect(() => {
    const on = () => setHash(window.location.hash || '#/')
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return hash
}

// Asks first, then deletes. Resolves true if the record was deleted.
async function removeCandidate(id, name) {
  if (!confirm(`Delete ${name || 'this candidate'}'s record permanently?\n\nThis cannot be undone.`)) return false
  try {
    await withTimeout(deleteDoc(doc(candidates, id)))
    return true
  } catch (err) {
    alert('Could not delete: ' + err.message)
    return false
  }
}


// Login is checked by Firebase Auth (no password in this code); firestore.rules only lets the admin account in.
const logout = () => signOut(auth)
const LOGIN_ERRORS = {
  'auth/invalid-credential': 'Wrong mobile number or password.',
  'auth/invalid-email': 'Wrong mobile number or password.',
  'auth/too-many-requests': 'Too many attempts. Please wait a few minutes and try again.',
  'auth/network-request-failed': 'No internet connection. Please check and try again.',
}


const loginInput = 'w-full rounded-xl border-2 border-indigo-100 bg-indigo-50/50 py-3 pl-11 pr-4 text-gray-800 placeholder:text-gray-400 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100'

function Login() {
  const [error, setError] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const submit = async (e) => {
    e.preventDefault()
    const { phone, password } = Object.fromEntries(new FormData(e.target))
    setBusy(true); setError('')
    try {
      await signInWithEmailAndPassword(auth, loginEmail(phone), password) // App switches pages via onAuthStateChanged
    } catch (err) {
      setError(LOGIN_ERRORS[err.code] ?? 'Could not log in: ' + err.message)
      setBusy(false)
    }
  }
  return (
    <div className="flex min-h-screen items-center justify-center p-4 font-lato">
      <form onSubmit={submit} className="w-full max-w-md space-y-6 rounded-3xl bg-white p-8 shadow-2xl shadow-indigo-200/60 sm:p-10">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white shadow-lg shadow-indigo-300">
            <Icon d={ICONS.user} className="h-8 w-8" />
          </div>
          <h1 className="bg-gradient-to-r from-indigo-600 to-fuchsia-600 bg-clip-text text-4xl font-bold text-transparent">Candidate Profile</h1>
          <p className="mt-2 text-gray-500">Welcome back! Please log in to continue.</p>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-sm font-bold text-gray-700">Mobile number</span>
          <span className="relative block">
            <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-indigo-400"><Icon d={ICONS.phone} /></span>
            <input name="phone" type="tel" inputMode="numeric" autoComplete="username" placeholder="Enter your 10-digit mobile number" required autoFocus className={loginInput} />
          </span>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-bold text-gray-700">Password</span>
          <span className="relative block">
            <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-indigo-400"><Icon d={ICONS.lock} /></span>
            <input name="password" type={show ? 'text' : 'password'} autoComplete="current-password" placeholder="Enter your password" required className={`${loginInput} pr-12`} />
            <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? 'Hide password' : 'Show password'}
              className="absolute inset-y-0 right-2 my-auto flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-indigo-50 hover:text-indigo-600">
              <Icon d={show ? ICONS.eyeOff : ICONS.eye} />
            </button>
          </span>
        </label>

        {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</p>}

        <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-fuchsia-600 py-3.5 disabled:opacity-60 font-bold text-white shadow-lg shadow-indigo-300 transition hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0">
          {busy ? 'Logging in…' : <>Log in <Icon d={ICONS.arrow} /></>}
        </button>
        <p className="text-center text-xs text-gray-400">Admin access only</p>
      </form>
    </div>
  )
}

// Pink title bar with the profile menu on the far right, then the white nav row.
function Header({ user }) {
  const name = user.displayName || 'Admin'
  const phone = user.email?.split('@')[0]
  const initials = name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const close = (e) => (e.key === 'Escape' || (e.type === 'mousedown' && !ref.current.contains(e.target))) && setOpen(false)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close) }
  }, [open])

  return (
    <header className="no-print font-lato">
      <div className="bg-pink-100">
        <div className="flex h-14 items-center px-4 sm:px-6">
          <a href="#/" className="text-lg font-bold text-gray-900">Candidate Profile</a>
          <div ref={ref} className="relative ml-auto">
            <button onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open} aria-label="Profile menu" className="flex items-center gap-2.5 text-right">
              <span className="hidden sm:block">
                <span className="block text-sm font-bold leading-tight text-gray-900">{name}</span>
                <span className="block text-xs text-gray-500">Admin</span>
              </span>
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-400 to-purple-500 text-sm font-bold text-white ring-2 ring-white/60 transition hover:ring-white">{initials}</span>
            </button>
            {open && (
              <div role="menu" className="absolute right-0 z-30 mt-2 w-52 overflow-hidden rounded-xl border border-gray-100 bg-white text-left shadow-lg">
                <div className="border-b border-gray-100 px-3.5 py-3">
                  <p className="text-sm font-bold text-gray-900">{name}</p>
                  <p className="text-xs text-gray-500">Admin · {phone}</p>
                </div>
                <button role="menuitem" onClick={logout} className="flex w-full items-center gap-2 px-3.5 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50">
                  <Icon d={ICONS.logout} className="h-4 w-4" /> Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      <nav className="border-b border-gray-200 bg-white">
        <div className="flex gap-1 px-4 py-1.5 sm:px-5">
          <a href="#/" className="flex items-center gap-1.5 rounded-full bg-purple-100 px-3.5 py-1.5 text-sm text-purple-600">
            <Icon d={ICONS.users} className="h-4 w-4" /> Candidates
          </a>
        </div>
      </nav>
    </header>
  )
}

// items: [label, href?][]; the last one is the current page.
function Breadcrumbs({ items, className = '' }) {
  return (
    <nav aria-label="Breadcrumb" className={`no-print flex flex-wrap items-center gap-1 font-lato text-xs text-gray-500 ${className}`}>
      <a href="#/" className="flex items-center gap-1 hover:text-purple-600"><Icon d={ICONS.home} className="h-3.5 w-3.5" /> Home</a>
      {items.map(([label, href], i) => (
        <span key={i} className="flex items-center gap-1">
          <Icon d={ICONS.chevron} className="h-3 w-3 text-gray-400" />
          {href ? <a href={href} className="hover:text-purple-600">{label}</a> : <span aria-current="page" className="font-bold text-gray-800">{label}</span>}
        </span>
      ))}
    </nav>
  )
}

const actionBtn = 'flex h-7 w-7 items-center justify-center rounded-md text-white shadow-sm transition hover:brightness-95'
const select = 'h-8 rounded-full border border-gray-200 bg-white px-3 text-[13px] text-gray-800 outline-none transition focus:border-purple-400 focus:ring-2 focus:ring-purple-100'
const th = 'border border-gray-200 px-3 py-2 font-bold text-gray-700'
const td = 'border border-gray-200 px-3 py-2'

// 1000000 → "10 LPA", 1050000 → "10.5 LPA" (list only; the form keeps the full number).
const lpa = (v) => (Number(v) ? `${+(Number(v) / 1e5).toFixed(1)} LPA` : '-')
// Experience in months: from company dates when present (live for "Present" jobs), else the typed years/months.
const expMonths = (r) => (r.signedAt ? null : totalMonths(r.companies)) ?? (Number(r.expYears) || 0) * 12 + (Number(r.expMonths) || 0)
const years = (r) => expMonths(r) / 12
const expLabel = (r) => {
  const m = expMonths(r)
  return m ? [Math.floor(m / 12) && `${Math.floor(m / 12)} yrs`, m % 12 && `${m % 12} mos`].filter(Boolean).join(' ') : '-'
}
const EXP = { all: [0, Infinity], '0-2': [0, 2], '2-5': [2, 5], '5+': [5, Infinity] }

function CandidateList() {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [paid, setPaid] = useState('all')
  const [tech, setTech] = useState('')
  const [exp, setExp] = useState('all')
  const [ref, setRef] = useState('')
  const [phase, setPhase] = useState('')

  // Fetches the records only; the table keeps showing the old rows until the new ones arrive.
  // ponytail: loads every record and filters in the browser; fine for a few thousand, paginate beyond that.
  const load = useCallback(() =>
    withTimeout(getDocs(query(candidates, orderBy('updatedAt', 'desc'))))
      .then((snap) => { setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); setError('') })
      .catch((err) => setError(err.message)), [])
  useEffect(() => { load() }, [load])
  const refresh = () => { setRefreshing(true); load().finally(() => setRefreshing(false)) }

  const references = [...new Set((rows ?? []).map((r) => r.reference?.trim()).filter(Boolean))].sort()
  const q = search.trim().toLowerCase()
  const [lo, hi] = EXP[exp]
  const shown = (rows ?? []).filter((r) =>
    [r.name, r.phone, r.reference].some((v) => v?.toLowerCase().includes(q)) &&
    (paid === 'all' || !!r.advancePaid === (paid === 'paid')) &&
    (!tech || r.tech?.includes(tech)) &&
    (!ref || r.reference?.trim() === ref) &&
    (!phase || (r.phase ?? 'inquiry') === phase) &&
    years(r) >= lo && years(r) < hi,
  )

  return (
    <main className="px-4 py-4 font-lato sm:px-6 sm:py-5">
      <Breadcrumbs items={[['Candidates']]} className="mb-3" />
      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
        {/* Title row: back · centred title + refresh · add */}
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
          <button onClick={() => history.back()} aria-label="Go back" className={circleBtn}><Icon d={ICONS.back} className="h-4 w-4" /></button>
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-base font-bold text-purple-600">Candidate List</h1>
            <button onClick={refresh} disabled={refreshing} aria-label="Refresh list" title="Refresh" className={circleBtn}>
              <Icon d={ICONS.refresh} className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <button onClick={() => go('#/new')} className="flex items-center gap-1.5 rounded-full bg-emerald-500 px-2 py-1.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-600 sm:px-3.5">
            <Icon d={ICONS.plus} className="h-4 w-4" />
            <span className="hidden sm:inline">Add Candidate</span>
          </button>
        </div>

        {/* Count + filters */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="mr-auto">
            <p className="text-base font-bold leading-tight text-gray-900">{rows ? shown.length : '–'}</p>
            <p className="text-xs text-gray-500">{!rows || shown.length === rows.length ? 'Total Candidates' : `of ${rows.length} Candidates`}</p>
          </div>
          <div role="group" aria-label="Advance payment" className="flex h-8 overflow-hidden rounded-full border border-purple-500">
            {[['all', 'All'], ['paid', 'Advance Paid'], ['unpaid', 'Not Paid']].map(([v, label]) => (
              <button key={v} onClick={() => setPaid(v)} aria-pressed={paid === v}
                className={`px-3 text-[13px] font-bold transition ${paid === v ? 'bg-purple-600 text-white' : 'text-purple-600 hover:bg-purple-50'}`}>
                {label}
              </button>
            ))}
          </div>
          <select value={phase} onChange={(e) => setPhase(e.target.value)} aria-label="Phase" className={`${select} w-full sm:w-32`}>
            <option value="">All Phases</option>
            {PHASES.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
          </select>
          <select value={tech} onChange={(e) => setTech(e.target.value)} aria-label="Career technology" className={`${select} w-full sm:w-44`}>
            <option value="">All Technologies</option>
            {TECH.map((t) => <option key={t}>{t}</option>)}
          </select>
          <select value={exp} onChange={(e) => setExp(e.target.value)} aria-label="Experience" className={`${select} w-full sm:w-36`}>
            <option value="all">All Experience</option>
            <option value="0-2">0 – 2 yrs</option>
            <option value="2-5">2 – 5 yrs</option>
            <option value="5+">5+ yrs</option>
          </select>
          <select value={ref} onChange={(e) => setRef(e.target.value)} aria-label="Reference name" className={`${select} w-full sm:w-40`}>
            <option value="">All References</option>
            {references.map((r) => <option key={r}>{r}</option>)}
          </select>
          <label className="relative w-full sm:w-52">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400"><Icon d={ICONS.search} className="h-3.5 w-3.5" /></span>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, phone or reference..." aria-label="Search candidates"
              className={`${select} w-full pl-8`} />
          </label>
        </div>

        {error && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-600">Could not load candidates: {error}</p>}
        {!rows && !error && <p className="mt-4 text-center text-sm text-gray-500">Loading…</p>}
        {rows && (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[1000px] border-collapse text-center text-[13px] text-gray-800">
              <thead className="bg-gray-50">
                <tr>
                  <th className={`${th} w-10`}>Sr.</th>
                  <th className={`${th} text-left`}>Candidate Name</th>
                  {['Phone', 'Last Visit Date', 'Reference', 'Career Technology', 'Experience', 'CTC', 'Phase', 'Advance', 'Actions'].map((h) => <th key={h} className={th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {shown.map((r, i) => (
                  <tr key={r.id} className="transition hover:bg-purple-50/30">
                    <td className={td}>{i + 1}</td>
                    <td className={`${td} text-left`}>{r.name || '-'}</td>
                    <td className={td}>{r.phone || '-'}</td>
                    <td className={td}>{r.visitDate || '-'}</td>
                    <td className={td}>{r.reference || '-'}</td>
                    <td className={td}>
                      <span className="flex flex-wrap justify-center gap-1">
                        {r.tech?.length ? r.tech.map((t) => <span key={t} className="rounded-full bg-purple-100 px-2 py-0.5 text-[11px] font-bold text-purple-600">{t}</span>) : '-'}
                      </span>
                    </td>
                    <td className={td}>{expLabel(r)}</td>
                    <td className={td}>{lpa(r.ctc)}</td>
                    <td className={td}>
                      {r.phase === 'confirmed'
                        ? <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-[11px] font-bold text-purple-700">Confirmed</span>
                        : <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-700">Inquiry</span>}
                    </td>
                    <td className={td}>
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold text-white ${r.advancePaid ? 'bg-emerald-500' : 'bg-red-500'}`}>{r.advancePaid ? 'Paid' : 'Not Paid'}</span>
                    </td>
                    <td className={td}>
                      <div className="flex justify-center gap-1.5">
                        <button title="View" aria-label={`View ${r.name}`} onClick={() => go(`#/c/${r.id}/view`)} className={`${actionBtn} bg-sky-500`}>
                          <Icon d={ICONS.eye} className="h-4 w-4" />
                        </button>
                        {r.signedAt ? (
                          <span title="Signed by the candidate — locked" aria-label={`${r.name} is signed and locked`} className={`${actionBtn} cursor-default bg-gray-300 hover:translate-y-0`}>
                            <Icon d={ICONS.lock} className="h-4 w-4" />
                          </span>
                        ) : (
                          <button title="Update" aria-label={`Update ${r.name}`} onClick={() => go(`#/c/${r.id}`)} className={`${actionBtn} bg-amber-400`}>
                            <Icon d={ICONS.pencil} className="h-4 w-4" />
                          </button>
                        )}
                        <button title="Delete" aria-label={`Delete ${r.name}`}
                          onClick={async () => (await removeCandidate(r.id, r.name)) && setRows((rs) => rs.filter((x) => x.id !== r.id))}
                          className={`${actionBtn} bg-red-500`}>
                          <Icon d={ICONS.trash} className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
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
        )}
      </section>
    </main>
  )
}

// Loads a saved candidate (id) or starts a blank one (id undefined), and saves it.
function CandidatePage({ id, view }) {
  const [record, setRecord] = useState(id ? null : undefined)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    withTimeout(getDoc(doc(candidates, id)))
      .then((d) => (d.exists() ? setRecord(d.data()) : setError('This candidate was not found.')))
      .catch((err) => setError(err.message))
  }, [id])

  const save = async (f) => {
    // Same phone number already saved for someone else? Offer to open that record instead.
    if (f.phone) {
      const dupes = await withTimeout(getDocs(query(candidates, where('phone', '==', f.phone))))
      const other = dupes.docs.find((d) => d.id !== id)
      if (other && confirm(`${other.data().name} is already saved with phone ${f.phone}.\n\nOK = open that record\nCancel = save this one anyway`)) {
        go(`#/c/${other.id}`)
        return false
      }
    }
    const stamp = { updatedAt: serverTimestamp() }
    if (id) {
      await withTimeout(setDoc(doc(candidates, id), { ...f, ...stamp }))
    } else {
      const ref = await withTimeout(addDoc(candidates, { ...f, ...stamp, createdAt: serverTimestamp() }))
      window.location.replace(`#/c/${ref.id}`)
    }
    return true
  }

  if (error) return <p className="p-6 font-lato text-red-600">{error} <a href="#/" className="underline">Back to list</a></p>
  if (record === null) return <p className="p-6 font-lato text-gray-500">Loading…</p>
  if (record?.signedAt) view = true // signed profiles are locked: always view
  const crumbs = [['Candidates', '#/'], ...(id ? [[record.name || 'Candidate', view ? undefined : `#/c/${id}/view`]] : []), ...(view ? [] : [[id ? 'Update' : 'New']])]
  return (
    <main className="px-4 py-4 font-lato sm:px-6 sm:py-5 print:p-0">
      <Breadcrumbs items={crumbs} className="mb-3" />
      <ProfileForm
        record={record}
        readOnly={view}
        onEdit={() => go(`#/c/${id}`)}
        onSave={save}
        onPhase={(phase) => withTimeout(updateDoc(doc(candidates, id), { phase, updatedAt: serverTimestamp() }))}
        onBack={() => go('#/')}
        onDelete={id && (async () => (await removeCandidate(id, record.name)) && go('#/'))}
      />
    </main>
  )
}

export default function App() {
  const hash = useHash()
  const [user, setUser] = useState(undefined) // undefined = still checking, null = logged out
  useEffect(() => onAuthStateChanged(auth, setUser), [])
  if (user === undefined) return <p className="p-6 text-center font-lato text-sm text-gray-500">Loading…</p>
  if (!user) return <Login />
  const [, id, view] = hash.match(/^#\/c\/([^/]+)(\/view)?/) ?? []
  return (
    <div className="min-h-screen">
      <Header user={user} />
      {id || hash === '#/new' ? <CandidatePage key={hash} id={id} view={!!view} /> : <CandidateList />}
    </div>
  )
}
