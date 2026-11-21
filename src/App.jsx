import { Component, Suspense, lazy, useEffect, useState } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { auth, loginEmail } from './firebase.js'
// Profile page (form, timeline, signature pad) loads in its own file; fetched in the background right after login.
const loadForm = () => import('./ProfileForm.jsx')
const ProfileForm = lazy(loadForm)
const ResumeEditor = lazy(() => import('./ResumeEditor.jsx')) // resume builder: own file, loaded on first open
const StatementsApp = lazy(() => import('./statements/App.jsx')) // bank statement builder: own file
import { ICONS, Icon } from './icons.jsx'
import Header from './Header.jsx'
import CandidateList from './CandidateList.jsx'
import Dashboard from './Dashboard.jsx'
import ResumeList from './ResumeList.jsx'
import { Loading, Page } from './ui.jsx'
import { Toaster, ask, toast } from './toast.jsx'
import { titleCase } from './options.js'
import { leaveFreely, mayLeave, navigated } from './unsaved.js'
import { DRAFT, cached, clearCache, findByPhone, firstSyncDone, getCandidate, getResume, removeCandidate, saveCandidate, saveResume, synced, useCandidates } from './data.js'

// Pages live in the URL hash: #/ (home), #/candidates[?filters], #/new, #/c/<id> (edit), #/c/<id>/view, #/resumes, #/r/<id> (resume)
const go = (hash) => (window.location.hash = hash)
// A page change away from unsaved edits asks first (unsaved.js); "Stay" puts the old address back.
function useHash() {
  const [hash, setHash] = useState(window.location.hash || '#/')
  useEffect(() => {
    let current = window.location.hash || '#/'
    const on = async () => {
      const next = window.location.hash || '#/'
      if (next === current) return
      if (!(await mayLeave())) return history.replaceState(null, '', current)
      navigated()
      current = next
      setHash(next)
    }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return hash
}

// Pages load their code in separate files. After a new deploy an open tab may ask for files that no longer exist,
// and any render error would otherwise leave a blank screen: show a message with a Reload button instead.
class PageError extends Component {
  state = { error: null }
  static getDerivedStateFromError(error) { return { error } }
  render() {
    const { error } = this.state
    if (!error) return this.props.children
    const updated = /dynamically imported module|module script|Loading chunk/i.test(error.message)
    return (
      <div role="alert" className="mx-auto mt-10 max-w-md rounded-2xl border border-gray-200 bg-white p-6 text-center font-lato shadow-sm">
        <p className="text-base font-bold text-gray-900">{updated ? 'The app was updated' : 'Something went wrong on this page'}</p>
        <p className="mt-1 text-sm text-gray-500">{updated ? 'Reload to get the latest version.' : error.message}</p>
        <button type="button" onClick={() => window.location.reload()} className="mt-4 h-9 rounded-full bg-gray-800 px-5 text-sm font-bold text-white hover:bg-gray-900">Reload</button>
      </div>
    )
  }
}

// Login is checked by Firebase Auth (no password in this code); firestore.rules only lets the admin account in.
const logout = () => { clearCache(); signOut(auth) }
const LOGIN_ERRORS = {
  'auth/invalid-credential': 'Wrong mobile number or password.',
  'auth/invalid-email': 'Wrong mobile number or password.',
  'auth/too-many-requests': 'Too many attempts. Please wait a few minutes and try again.',
  'auth/network-request-failed': 'No internet connection. Please check and try again.',
}


const loginInput = 'w-full rounded-xl border-2 border-brand-100 bg-brand-50/50 py-3 pl-11 pr-4 text-gray-800 placeholder:text-gray-400 outline-none focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-100'

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
      <form onSubmit={submit} className="w-full max-w-md space-y-6 rounded-3xl bg-white p-8 shadow-2xl shadow-brand-200/60 sm:p-10">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-fuchsia-500 text-white shadow-lg shadow-brand-300">
            <Icon d={ICONS.user} className="h-8 w-8" />
          </div>
          <h1 className="bg-gradient-to-r from-brand-600 to-fuchsia-600 bg-clip-text text-4xl font-bold text-transparent">Slot Profile</h1>
          <p className="mt-2 text-gray-500">Welcome back! Please log in to continue.</p>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-sm font-bold text-gray-700">Mobile number</span>
          <span className="relative block">
            <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-brand-400"><Icon d={ICONS.phone} /></span>
            <input name="phone" type="tel" inputMode="numeric" autoComplete="username" placeholder="Enter your 10-digit mobile number" required autoFocus className={loginInput} />
          </span>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-bold text-gray-700">Password</span>
          <span className="relative block">
            <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-brand-400"><Icon d={ICONS.lock} /></span>
            <input name="password" type={show ? 'text' : 'password'} autoComplete="current-password" placeholder="Enter your password" required className={`${loginInput} pr-12`} />
            <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? 'Hide password' : 'Show password'}
              className="absolute inset-y-0 right-2 my-auto flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-brand-50 hover:text-brand-600">
              <Icon d={show ? ICONS.eyeOff : ICONS.eye} />
            </button>
          </span>
        </label>

        {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</p>}

        <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-fuchsia-600 py-3.5 disabled:opacity-60 font-bold text-white shadow-lg shadow-brand-300 ">
          {busy ? 'Logging in…' : <>Log in <Icon d={ICONS.arrow} /></>}
        </button>
        <p className="text-center text-xs text-gray-400">Admin access only</p>
      </form>
    </div>
  )
}

// Loads a saved candidate (id) or starts a blank one (id undefined), and saves it.
function CandidatePage({ id, view }) {
  const [record, setRecord] = useState(() => (id ? (firstSyncDone() && cached(id)) || null : undefined))
  const [error, setError] = useState('')

  // From the synced copy (no read); fetched on its own only when the copy doesn't have it (e.g. the sync failed).
  useEffect(() => {
    if (!id || record) return
    synced()
      .then(() => cached(id) ?? getCandidate(id))
      .then((r) => (r ? setRecord(r) : setError('This candidate was not found.')))
      .catch((err) => setError(err.message))
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Resolves true when saved (the form then shows "Saved"), false when the user chose something else.
  const save = async (f) => {
    // Same phone number already saved for someone else? Offer to open that record instead.
    const other = f.phone && (await findByPhone(f.phone, id))
    if (other) {
      const choice = await ask({
        title: 'Phone number already saved',
        message: `${other.name || 'Another candidate'} is already saved with phone ${f.phone}.`,
        buttons: [{ label: 'Open that record', value: 'open' }, { label: 'Save anyway', value: 'save', tone: 'plain' }, { label: 'Cancel', value: null, tone: 'plain' }],
      })
      if (choice === 'open') go(`#/c/${other.id}`)
      if (choice !== 'save') return false
    }
    const newId = await saveCandidate(id, f)
    toast(`${titleCase(f.name)} saved.`)
    if (!id) { leaveFreely(); window.location.replace(`#/c/${newId}`) }
    return true
  }

  if (error) return <p className="p-6 font-lato text-red-600">{error} <a href="#/candidates" className="underline">Back to list</a></p>
  if (record === null) return <Loading />
  const crumbs = [['Candidates', '#/candidates'], ...(id ? [[record.name || 'Candidate', view ? undefined : `#/c/${id}/view`]] : []), ...(view ? [] : [[id ? 'Update' : 'New']])]
  return (
    <Page crumbs={crumbs}>
      <Suspense fallback={<Loading />}>
      <ProfileForm
        record={record}
        readOnly={view}
        onEdit={() => go(`#/c/${id}`)}
        onSave={save}
        onBack={() => history.length > 1 ? history.back() : go('#/candidates')}
        onDelete={id && (async () => { if (await removeCandidate(id, record.name)) { leaveFreely(); go('#/candidates') } })}
        onResume={id && (() => go(`#/r/${id}`))}
      />
      </Suspense>
    </Page>
  )
}

// A candidate's resume: the candidate comes from the synced copy; the resume is read only if one was saved.
function ResumePage({ id }) {
  const { rows } = useCandidates()
  const [data, setData] = useState(null) // { candidate, resume }
  const [error, setError] = useState('')
  useEffect(() => {
    synced()
      .then(() => cached(id) ?? getCandidate(id))
      .then(async (candidate) => (candidate ? setData({ candidate, resume: candidate.hasResume ? await getResume(id) : null }) : setError('This candidate was not found.')))
      .catch((err) => setError(err.message))
  }, [id])
  if (error) return <p className="p-6 font-lato text-red-600">{error} <a href="#/resumes" className="underline">Back to resumes</a></p>
  if (!data) return <Loading />
  return (
    <Page crumbs={[['Resumes', '#/resumes'], [data.candidate.name || 'Candidate', `#/c/${id}/view`], ['Resume']]}>
      <Suspense fallback={<Loading />}>
        <ResumeEditor candidate={data.candidate} resume={data.resume} onSave={(r) => saveResume(id, r)} draftKey={DRAFT + id}
          others={(rows ?? []).filter((r) => r.hasResume && r.id !== id).map((r) => ({ id: r.id, name: r.name }))} loadResume={getResume}
          onBack={() => (history.length > 1 ? history.back() : go('#/resumes'))} />
      </Suspense>
    </Page>
  )
}

// Home, candidate list and resume list share one copy of the records (useCandidates), so numbers and rows always agree.
function ListPages({ page }) {
  const data = useCandidates()
  if (page === 'resumes') return <Page crumbs={[['Resumes']]}><ResumeList {...data} /></Page>
  return page === 'home'
    ? <Page crumbs={[]}><Dashboard {...data} /></Page>
    : <Page crumbs={[['Candidates']]}><CandidateList {...data} /></Page>
}

export default function App() {
  const hash = useHash()
  const [user, setUser] = useState(undefined) // undefined = still checking, null = logged out
  useEffect(() => onAuthStateChanged(auth, setUser), [])
  useEffect(() => { if (user) { synced(); loadForm() } }, [user]) // sync once per session; warm the profile page
  if (user === undefined) return <Loading />
  if (!user) return <Login />
  const [, id, view] = hash.match(/^#\/c\/([^/]+)(\/view)?/) ?? []
  const [, resumeId] = hash.match(/^#\/r\/([^/?]+)/) ?? []
  const page = hash.startsWith('#/statements') ? (
    <Suspense fallback={<Loading />}>
      <StatementsApp />
    </Suspense>
  )
    : resumeId ? <ResumePage key={hash} id={resumeId} />
    : id || hash === '#/new' ? <CandidatePage key={hash} id={id} view={!!view} />
    : <ListPages page={hash.startsWith('#/candidates') ? 'candidates' : hash.startsWith('#/resumes') ? 'resumes' : 'home'} />
  return (
    <div className="min-h-screen">
      <Header user={user} onLogout={logout} />
      <PageError key={hash.startsWith('#/statements') ? 'statements' : hash}>{page}</PageError>
      <Toaster />
    </div>
  )
}
