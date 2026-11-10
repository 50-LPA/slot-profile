// Shared building blocks. Change a look here and every page that uses it follows.
import { useEffect, useRef, useState } from 'react'
import { ICONS, Icon } from './icons.jsx'

// Page body under the header: padding + breadcrumbs. crumbs: [label, href?][]; the last one is the current page.
export function Page({ crumbs, children }) {
  return (
    <main className="px-4 py-4 font-lato sm:px-6 sm:py-5">
      <Breadcrumbs items={crumbs} />
      {children}
    </main>
  )
}

function Breadcrumbs({ items }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-3 flex flex-wrap items-center gap-1 text-xs text-gray-500">
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

// The main white card.
export function Card({ children }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
      {children}
    </section>
  )
}

// Card title row: back button left · title centred (+ extra, e.g. refresh) · actions right. Wraps on small screens.
export function CardHeader({ onBack, backLabel = 'Go back', title, extra, actions }) {
  return (
    <div className="grid grid-cols-[auto_1fr] items-center gap-2 lg:grid-cols-[1fr_auto_1fr]">
      <div><CircleButton icon={ICONS.back} label={backLabel} onClick={onBack} /></div>
      <div className="flex items-center justify-center gap-2">
        <h1 className="text-center text-base font-bold text-purple-600">{title}</h1>
        {extra}
      </div>
      <div className="col-span-2 flex flex-wrap items-center justify-end gap-2 lg:col-span-1">{actions}</div>
    </div>
  )
}

const BUTTON = {
  primary: 'bg-emerald-500 text-white enabled:hover:bg-emerald-600',
  warning: 'bg-amber-400 text-white enabled:hover:bg-amber-500',
  dark: 'bg-gray-800 text-white enabled:hover:bg-gray-900',
  danger: 'border border-red-200 bg-white text-red-600 enabled:hover:bg-red-50',
  plain: 'border border-gray-200 bg-white text-gray-700 enabled:hover:bg-gray-50',
}
// Rounded pill button with an optional icon. variant: primary | warning | dark | danger | plain. size: md | sm.
export function Button({ variant = 'primary', size = 'md', icon, children, className = '', ...rest }) {
  const sz = size === 'sm' ? 'h-7 gap-1 px-3 text-xs' : 'h-8 gap-1.5 px-3.5 text-sm'
  return (
    <button type="button" className={`flex items-center rounded-full font-bold shadow-sm disabled:opacity-50 ${sz} ${BUTTON[variant]} ${className}`} {...rest}>
      {icon && <Icon d={icon} className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />}
      {children}
    </button>
  )
}

// Round outlined icon button (back, refresh).
export function CircleButton({ icon, label, dim, ...rest }) {
  return (
    <button type="button" aria-label={label} title={label} {...rest}
      className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-60">
      <Icon d={icon} className={`h-4 w-4 ${dim ? 'opacity-40' : ''}`} />
    </button>
  )
}

const ACTION = { sky: 'bg-sky-500', amber: 'bg-amber-400', red: 'bg-red-500' }
// Small square coloured badge with a white icon (table actions).
export function IconAction({ icon, label, tone, onClick }) {
  return (
    <button type="button" title={label} aria-label={label} onClick={onClick}
      className={`flex h-7 w-7 items-center justify-center rounded-md text-white shadow-sm hover:brightness-95 ${ACTION[tone]}`}>
      <Icon d={icon} className="h-4 w-4" />
    </button>
  )
}

// Segmented toggle. options: [value, label][]. activeClass(value) colours the selected segment.
// On phones the segments share the width equally.
export function Segmented({ label, options, value, onChange, disabled, className = '', activeClass = () => 'bg-purple-600 text-white', border = 'border-purple-500', idle = 'text-purple-600 enabled:hover:bg-purple-50' }) {
  return (
    <div role="group" aria-label={label} className={`flex h-8 overflow-hidden rounded-full border text-[13px] font-bold ${border} ${className}`}>
      {options.map(([v, text]) => (
        <button key={v} type="button" disabled={disabled} onClick={() => onChange(v)} aria-pressed={value === v}
          className={`whitespace-nowrap px-3 mobile:flex-1 mobile:px-1.5 ${value === v ? activeClass(v) : `bg-white ${idle}`}`}>
          {text}
        </button>
      ))}
    </div>
  )
}

const PILL = {
  green: 'bg-emerald-500 text-white',
  red: 'bg-red-500 text-white',
  gray: 'bg-gray-500 text-white',
  amber: 'bg-amber-400 text-white',
  sky: 'bg-sky-500 text-white',
  purple: 'bg-purple-100 text-purple-600',
}
// Small rounded status label. tone: green | red | gray | amber | sky | purple.
export function Pill({ tone, children }) {
  return <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${PILL[tone]}`}>{children}</span>
}

const FIELD = 'h-8 rounded-full border border-gray-200 bg-white px-3 text-[13px] text-gray-800 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100'
// Rounded filter dropdown. placeholder = the "All …" option (value '').
export function FilterSelect({ value, onChange, label, placeholder, options, className = '' }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} className={`${FIELD} w-full ${className}`}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => {
        const [v, text] = Array.isArray(o) ? o : [o, o]
        return <option key={v} value={v}>{text}</option>
      })}
    </select>
  )
}

export function SearchInput({ value, onChange, placeholder, label, className = '' }) {
  return (
    <label className={`relative w-full ${className}`}>
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400"><Icon d={ICONS.search} className="h-3.5 w-3.5" /></span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={label} className={`${FIELD} w-full pl-8`} />
    </label>
  )
}

// Dropdown with a search box inside: click to open, type to narrow, click (or ↑↓ + Enter) to pick. value '' = "All".
export function SearchSelect({ value, onChange, label, placeholder, options, className = '' }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [hi, setHi] = useState(0) // highlighted row
  const box = useRef(null)
  const list = useRef(null)
  const items = [['', placeholder], ...options.filter((o) => o.toLowerCase().includes(q.trim().toLowerCase())).map((o) => [o, o])]

  useEffect(() => {
    if (!open) return
    const close = (e) => !box.current.contains(e.target) && setOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])
  useEffect(() => { list.current?.children[hi]?.scrollIntoView({ block: 'nearest' }) }, [hi])

  const toggle = () => { setQ(''); setHi(0); setOpen((v) => !v) }
  const pick = (v) => { onChange(v); setOpen(false) }
  const key = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(h + 1, items.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); if (items[hi]) pick(items[hi][0]) }
    else if (e.key === 'Escape') setOpen(false)
  }

  return (
    <div ref={box} className={`relative w-full ${className}`}>
      <button type="button" onClick={toggle} aria-haspopup="listbox" aria-expanded={open} aria-label={label}
        className={`${FIELD} select-sm flex w-full items-center text-left ${value ? '' : 'text-gray-800'}`}>
        <span className="truncate">{value || placeholder}</span>
      </button>
      {open && (
        <div className="absolute left-0 z-30 mt-1 w-full min-w-56 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
          <div className="relative border-b border-gray-100 p-1.5">
            <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-gray-400"><Icon d={ICONS.search} className="h-3.5 w-3.5" /></span>
            <input autoFocus value={q} onChange={(e) => { setQ(e.target.value); setHi(0) }} onKeyDown={key} placeholder="Search…" aria-label={`Search ${label}`}
              className="h-8 w-full rounded-lg bg-gray-50 pl-8 pr-2 text-[13px] outline-none focus:bg-white focus:ring-2 focus:ring-purple-100" />
          </div>
          <ul ref={list} role="listbox" aria-label={label} className="max-h-60 overflow-y-auto py-1 text-[13px]">
            {items.map(([v, text], i) => (
              <li key={v || '__all'} role="option" aria-selected={value === v} onMouseEnter={() => setHi(i)} onMouseDown={(e) => { e.preventDefault(); pick(v) }}
                className={`flex cursor-pointer items-center justify-between px-3 py-1.5 ${i === hi ? 'bg-purple-50' : ''} ${value === v ? 'font-bold text-purple-600' : 'text-gray-800'} ${v ? '' : 'border-b border-gray-100'}`}>
                <span className="truncate">{text}</span>
                {value === v && <Icon d={ICONS.check} className="h-3.5 w-3.5 flex-none" />}
              </li>
            ))}
            {items.length === 1 && <li className="px-3 py-2 text-gray-400">No match for “{q}”</li>}
          </ul>
        </div>
      )}
    </div>
  )
}

export const Loading = () => <p className="p-6 text-center font-lato text-sm text-gray-500">Loading…</p>
