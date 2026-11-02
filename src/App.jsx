import { Suspense, lazy, useCallback, useEffect, useState } from 'react'
import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, orderBy, query, serverTimestamp, setDoc, where,
} from 'firebase/firestore/lite'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { auth, db, loginEmail, withTimeout } from './firebase.js'
// Profile page (form, timeline, signature pad) loads in its own file; fetched in the background right after login.
const loadForm = () => import('./ProfileForm.jsx')
const ProfileForm = lazy(loadForm)
import { ICONS, Icon } from './icons.jsx'
import Header from './Header.jsx'
import { Button, Card, CardHeader, CircleButton, FilterSelect, IconAction, Loading, Page, Pill, Segmented, SearchInput, SearchSelect } from './ui.jsx'
import { ADVANCE_STATUS, PHASES, TECH, advance } from './options.js'
import { totalMonths } from './career.js'

const candidates = collection(db, 'candidates')

// In-memory copy of the list: pages open instantly from it; saves/deletes keep it current; cleared on logout.
let cache = null
const cacheUpsert = (id, data) => { if (cache) cache = [{ id, ...data, updatedAt: { toDate: () => new Date() } }, ...cache.filter((r) => r.id !== id)] }
const cacheRemove = (id) => { if (cache) cache = cache.filter((r) => r.id !== id) }

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
    cacheRemove(id)
    return true
  } catch (err) {
    alert('Could not delete: ' + err.message)
    return false
  }
}


// Login is checked by Firebase Auth (no password in this code); firestore.rules only lets the admin account in.
const logout = () => { cache = null; signOut(auth) }
const LOGIN_ERRORS = {
  'auth/invalid-credential': 'Wrong mobile number or password.',
  'auth/invalid-email': 'Wrong mobile number or password.',
  'auth/too-many-requests': 'Too many attempts. Please wait a few minutes and try again.',
  'auth/network-request-failed': 'No internet connection. Please check and try again.',
}


const loginInput = 'w-full rounded-xl border-2 border-indigo-100 bg-indigo-50/50 py-3 pl-11 pr-4 text-gray-800 placeholder:text-gray-400 outline-none focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100'

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

        <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-fuchsia-600 py-3.5 disabled:opacity-60 font-bold text-white shadow-lg shadow-indigo-300 ">
          {busy ? 'Logging in…' : <>Log in <Icon d={ICONS.arrow} /></>}
        </button>
        <p className="text-center text-xs text-gray-400">Admin access only</p>
      </form>
    </div>
  )
}

const th = 'border border-gray-200 px-3 py-2 font-bold text-gray-700'
const td = 'border border-gray-200 px-3 py-2'

// 1000000 → "10 LPA", 1050000 → "10.5 LPA" (list only; the form keeps the full number).
const lpa = (v) => (Number(v) ? `${+(Number(v) / 1e5).toFixed(1)} LPA` : '-')
// Experience in months: from company dates when present (live for "Present" jobs), else the typed years/months.
const expMonths = (r) => totalMonths(r.companies) ?? (Number(r.expYears) || 0) * 12 + (Number(r.expMonths) || 0)
const years = (r) => expMonths(r) / 12
const expLabel = (r) => {
  const m = expMonths(r)
  return m ? [Math.floor(m / 12) && `${Math.floor(m / 12)} yrs`, m % 12 && `${m % 12} mos`].filter(Boolean).join(' ') : '-'
}
// Advance column: coloured text (no badge) — dark green Fully Paid · dark amber Partial (due on hover) · dark red Unpaid.
function AdvanceText({ r }) {
  const a = advance(r)
  if (a.status === 'paid') return <span className="inline-flex items-center gap-1 font-bold text-emerald-700"><Icon d={ICONS.checkCircle} className="h-4 w-4" /> Fully Paid</span>
  if (a.status === 'unpaid') return <span className="font-bold text-red-700">Unpaid</span>
  return <span className="font-bold text-amber-700" title={`₹ ${a.due.toLocaleString('en-IN')} due`}>Partial · ₹ {a.paid.toLocaleString('en-IN')}</span>
}

const EXP = { all: [0, Infinity], '0-2': [0, 2], '2-5': [2, 5], '5+': [5, Infinity] }
const EXP_OPTIONS = [['all', 'All Experience'], ['0-2', '0 – 2 yrs'], ['2-5', '2 – 5 yrs'], ['5+', '5+ yrs']]

function CandidateList() {
  const [rows, setRows] = useState(cache)
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
      .then((snap) => { cache = snap.docs.map((d) => ({ id: d.id, ...d.data() })); setRows(cache); setError('') })
      .catch((err) => setError(err.message)), [])
  useEffect(() => { if (!cache) load() }, [load]) // from cache when we have it; the refresh button re-fetches
  const refresh = () => { setRefreshing(true); load().finally(() => setRefreshing(false)) }

  const references = [...new Set((rows ?? []).map((r) => r.reference?.trim()).filter(Boolean))].sort()
  const q = search.trim().toLowerCase()
  const [lo, hi] = EXP[exp]
  const shown = (rows ?? []).filter((r) =>
    [r.name, r.phone, r.reference].some((v) => v?.toLowerCase().includes(q)) &&
    (paid === 'all' || advance(r).status === paid) &&
    (!tech || r.tech?.includes(tech)) &&
    (!ref || r.reference?.trim() === ref) &&
    (!phase || (r.phase ?? 'inquiry') === phase) &&
    years(r) >= lo && years(r) < hi,
  )

  return (
    <Page crumbs={[['Candidates']]}>
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

        {/* Count + filters */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="mr-auto">
            <p className="text-base font-bold leading-tight text-gray-900">{rows ? shown.length : '–'}</p>
            <p className="text-xs text-gray-500">{!rows || shown.length === rows.length ? 'Total Candidates' : `of ${rows.length} Candidates`}</p>
          </div>
          <Segmented label="Advance payment" value={paid} onChange={setPaid} options={[['all', 'All'], ...ADVANCE_STATUS]} />
          <FilterSelect label="Phase" value={phase} onChange={setPhase} placeholder="All Phases" options={PHASES} className="sm:w-32" />
          <FilterSelect label="Career technology" value={tech} onChange={setTech} placeholder="All Technologies" options={TECH} className="sm:w-44" />
          <FilterSelect label="Experience" value={exp} onChange={setExp} options={EXP_OPTIONS} className="sm:w-36" />
          <SearchSelect label="Reference name" value={ref} onChange={setRef} placeholder="All References" options={references} className="sm:w-44" />
          <SearchInput label="Search candidates" value={search} onChange={setSearch} placeholder="Name, phone or reference..." className="sm:w-52" />
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
                  <tr key={r.id} className="hover:bg-purple-50/30">
                    <td className={td}>{i + 1}</td>
                    <td className={`${td} text-left`}>{r.name || '-'}</td>
                    <td className={td}>{r.phone || '-'}</td>
                    <td className={td}>{r.visitDate || '-'}</td>
                    <td className={td}>{r.reference || '-'}</td>
                    <td className={td}>
                      <span className="flex flex-wrap justify-center gap-1">
                        {r.tech?.length ? r.tech.map((t) => <Pill key={t} tone="purple">{t}</Pill>) : '-'}
                      </span>
                    </td>
                    <td className={td}>{expLabel(r)}</td>
                    <td className={td}>{lpa(r.ctc)}</td>
                    <td className={td}>
                      {r.phase === 'confirmed' ? <Pill tone="green">Confirmed</Pill> : <Pill tone="gray">Inquiry</Pill>}
                    </td>
                    <td className={td}>
                      <AdvanceText r={r} />
                    </td>
                    <td className={td}>
                      <div className="flex justify-center gap-1.5">
                        <IconAction icon={ICONS.eye} tone="sky" label={`View ${r.name}`} onClick={() => go(`#/c/${r.id}/view`)} />
                        <IconAction icon={ICONS.pencil} tone="amber" label={`Update ${r.name}`} onClick={() => go(`#/c/${r.id}`)} />
                        <IconAction icon={ICONS.trash} tone="red" label={`Delete ${r.name}`}
                          onClick={async () => (await removeCandidate(r.id, r.name)) && setRows((rs) => rs.filter((x) => x.id !== r.id))} />
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
      </Card>
    </Page>
  )
}

// Loads a saved candidate (id) or starts a blank one (id undefined), and saves it.
function CandidatePage({ id, view }) {
  const [record, setRecord] = useState(() => (id ? cache?.find((r) => r.id === id) ?? null : undefined))
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id || record) return // already have it from the list
    withTimeout(getDoc(doc(candidates, id)))
      .then((d) => (d.exists() ? setRecord(d.data()) : setError('This candidate was not found.')))
      .catch((err) => setError(err.message))
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

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
      cacheUpsert(id, f)
    } else {
      const ref = await withTimeout(addDoc(candidates, { ...f, ...stamp, createdAt: serverTimestamp() }))
      cacheUpsert(ref.id, f)
      window.location.replace(`#/c/${ref.id}`)
    }
    return true
  }

  if (error) return <p className="p-6 font-lato text-red-600">{error} <a href="#/" className="underline">Back to list</a></p>
  if (record === null) return <Loading />
  const crumbs = [['Candidates', '#/'], ...(id ? [[record.name || 'Candidate', view ? undefined : `#/c/${id}/view`]] : []), ...(view ? [] : [[id ? 'Update' : 'New']])]
  return (
    <Page crumbs={crumbs}>
      <Suspense fallback={<Loading />}>
      <ProfileForm
        record={record}
        readOnly={view}
        onEdit={() => go(`#/c/${id}`)}
        onSave={save}
        onBack={() => go('#/')}
        onDelete={id && (async () => (await removeCandidate(id, record.name)) && go('#/'))}
      />
      </Suspense>
    </Page>
  )
}

export default function App() {
  const hash = useHash()
  const [user, setUser] = useState(undefined) // undefined = still checking, null = logged out
  useEffect(() => onAuthStateChanged(auth, setUser), [])
  useEffect(() => { if (user) loadForm() }, [user]) // warm the profile page so View/Update open instantly
  if (user === undefined) return <Loading />
  if (!user) return <Login />
  const [, id, view] = hash.match(/^#\/c\/([^/]+)(\/view)?/) ?? []
  return (
    <div className="min-h-screen">
      <Header user={user} onLogout={logout} />
      {id || hash === '#/new' ? <CandidatePage key={hash} id={id} view={!!view} /> : <CandidateList />}
    </div>
  )
}
