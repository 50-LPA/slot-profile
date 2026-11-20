import { useEffect, useRef, useState } from 'react'
import { ICONS, Icon } from './icons.jsx'

// Subheader tabs: add an entry here to add a tab everywhere.
const TABS = [
  ['Home', '#/', ICONS.home],
  ['Candidates', '#/candidates', ICONS.users],
  ['Resumes', '#/resumes', ICONS.document],
  ['Statements', '#/statements', ICONS.statement],
]

// Soft indigo title bar with the profile menu on the far right, then the white subheader (underlined tabs). Shown on every page after login.
export default function Header({ user, onLogout }) {
  const name = user.displayName || 'Admin'
  const phone = user.email?.split('@')[0]
  const initials = name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()
  const [open, setOpen] = useState(false)
  // App re-renders on hash change. Candidate pages (#/c/…, #/new) belong to the Candidates tab, resume pages (#/r/…) to Resumes, statements to Statements.
  const hash = window.location.hash || '#/'
  const active = hash === '#/' ? '#/'
    : /^#\/(resumes|r\/)/.test(hash) ? '#/resumes'
    : /^#\/statements/.test(hash) ? '#/statements'
    : '#/candidates'
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const close = (e) => (e.key === 'Escape' || (e.type === 'mousedown' && !ref.current.contains(e.target))) && setOpen(false)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close) }
  }, [open])

  return (
    <header className="font-lato print:hidden">
      <div className="border-b border-brand-100 bg-brand-50">
        <div className="flex h-14 items-center px-4 sm:px-6">
          <a href="#/" className="flex items-center gap-2 text-base font-bold tracking-tight text-slate-800">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-600 text-xs text-white">SP</span>
            Slot Profile
          </a>
          <div ref={ref} className="relative ml-auto">
            <button onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open} aria-label="Profile menu" className="flex items-center gap-2.5 text-right">
              <span className="hidden sm:block">
                <span className="block text-sm font-bold leading-tight text-slate-800">{name}</span>
                <span className="block text-xs text-slate-400">Admin</span>
              </span>
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-sm font-bold text-brand-600 ring-1 ring-brand-200 hover:ring-brand-400">{initials}</span>
            </button>
            {open && (
              <div role="menu" className="absolute right-0 z-30 mt-2 w-52 overflow-hidden rounded-xl border border-gray-100 bg-white text-left shadow-lg">
                <div className="border-b border-gray-100 px-3.5 py-3">
                  <p className="text-sm font-bold text-gray-900">{name}</p>
                  <p className="text-xs text-gray-500">Admin · {phone}</p>
                </div>
                <button role="menuitem" onClick={onLogout} className="flex w-full items-center gap-2 px-3.5 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50">
                  <Icon d={ICONS.logout} className="h-4 w-4" /> Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      <nav className="border-b border-gray-200 bg-white">
        <div className="flex gap-5 overflow-x-auto px-4 sm:px-6">
          {TABS.map(([label, href, icon]) => (
            <a key={href} href={href} aria-current={href === active ? 'page' : undefined}
              className={`-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 py-3 text-sm ${href === active ? 'border-brand-600 font-bold text-brand-600' : 'border-transparent text-slate-500 hover:text-slate-900'}`}>
              <Icon d={icon} className="h-4 w-4" /> {label}
            </a>
          ))}
        </div>
      </nav>
    </header>
  )
}
