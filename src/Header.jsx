import { useEffect, useRef, useState } from 'react'
import { ICONS, Icon } from './icons.jsx'

// Subheader tabs: add an entry here to add a tab everywhere.
const TABS = [['Candidates', '#/', ICONS.users]]

// Pink title bar with the profile menu on the far right, then the white subheader (tabs). Shown on every page after login.
export default function Header({ user, onLogout }) {
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
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-400 to-purple-500 text-sm font-bold text-white ring-2 ring-white/60 hover:ring-white">{initials}</span>
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
        <div className="flex gap-1 px-4 py-1.5 sm:px-5">
          {TABS.map(([label, href, icon]) => (
            <a key={href} href={href} className="flex items-center gap-1.5 rounded-full bg-purple-100 px-3.5 py-1.5 text-sm text-purple-600">
              <Icon d={icon} className="h-4 w-4" /> {label}
            </a>
          ))}
        </div>
      </nav>
    </header>
  )
}
