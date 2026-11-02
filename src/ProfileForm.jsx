import { useEffect, useRef, useState } from 'react'
import { applySalary } from './salary.js'
import { PHASES, TECH } from './options.js'
import { ICONS, Icon, circleBtn } from './icons.jsx'
import { CareerFields, CareerTimeline } from './Career.jsx'
import { totalMonths } from './career.js'
import SignaturePad from './SignaturePad.jsx'

const DOC_CHARGES = [
  ['Documentation', '', '12,000  /  Yr.'],
  ['PF', '(1800 + 1800 + 400)', '4000  /  Mo.'],
  ['Form 16', '', '4000  /  Qtr'],
  ['Sal. Rotation', '(< 60,000)', '3000  /  Mo.'],
  ['Sal. Rotation', '(> 60,000)', '5000  /  Mo.'],
]

const ROUNDS = [
  ['< 7  Rounds', 'Rs. 80,000/-'],
  ['7 - 15  Rounds', 'Rs. 1,00,000/-'],
  ['15 - 20  Rounds', 'Rs. 1,30,000/-'],
  ['> 20  Rounds', 'Rs. 1,50,000/-'],
]

const TERMS = [
  ['No Post-Placement Support:', 'No job, technical, or other support after placement.'],
  ['Min. 1 Mock Interview:', 'Mandatory before live interviews.'],
  ['₹20,000 Advance:', 'Non-refundable, even if no interview is attended.'],
  ['Resume:', 'Prepared by us; Naukri profile will only be consulted & reviewed only, not created from our end.'],
  ['₹20,000 = 7 Interview rounds:', 'Pay another ₹20,000 for the next 5 interview rounds.'],
  ['Advance is Separate:', 'It is not part of the final payment and works as an interview recharge for each 7 interview rounds.'],
  [
    'Final Payment:',
    <>Must be paid within <u>7 days of receiving the offer letter</u>. Cannot be delayed until salary or joining.</>,
  ],
]

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
const fmtDate = (d) => `${String(d.getDate()).padStart(2, '0')}-${MONTHS[d.getMonth()]}-${d.getFullYear()}`

// One object holds the whole form; this is exactly what gets saved as a record.
const newForm = (today = fmtDate(new Date())) => ({
  name: '', phone: '', visitDate: today, reference: '',
  parentsNo: '', parentsRel: '', spouseNo: '', spouseRel: '',
  tech: [], expYears: '', expMonths: '',
  ctc: '', varPay: '', fixPay: '', inHand: '',
  advancePaid: false,
  phase: 'inquiry', // 'inquiry' | 'confirmed'
  passOut: '', // 'YYYY-MM'
  companies: [], // { name, from: 'YYYY-MM', to: 'YYYY-MM', present: bool }
  signature: '', // PNG data URL drawn on the signature pad
  signedAt: '', // ISO time the candidate saved the signature
  signDate: today,
})

const digits = (s) => s.replace(/\D/g, '')

function Field({ label, children }) {
  return (
    <label className="flex items-baseline gap-[1.5mm] font-bold">
      <span className="whitespace-nowrap">{label} :</span>
      {children}
    </label>
  )
}

function Text({ value, onChange, ...rest }) {
  return <input className="field" value={value} onChange={(e) => onChange(e.target.value)} {...rest} />
}

// "03-NOV-2026" <-> "2026-11-03" for the native date picker.
const toIso = (v) => {
  const m = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(v.trim())
  const mi = m ? MONTHS.indexOf(m[2].toUpperCase()) : -1
  return mi < 0 ? '' : `${m[3]}-${String(mi + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`
}

// Text date (still typeable) plus a calendar button that opens the browser's date picker; the button doesn't print.
function DateText({ value, onChange }) {
  const picker = useRef(null)
  return (
    <>
      <Text value={value} onChange={onChange} />
      <span className="no-print relative flex-none self-center">
        <button type="button" tabIndex={-1} aria-label="Pick a date" title="Pick a date"
          onClick={() => (picker.current.showPicker ? picker.current.showPicker() : picker.current.click())}
          className="flex h-[6mm] w-[6mm] items-center justify-center rounded text-gray-400 hover:bg-purple-50 hover:text-purple-600">
          <Icon d={ICONS.calendar} className="h-[4mm] w-[4mm]" />
        </button>
        <input ref={picker} type="date" tabIndex={-1} aria-hidden="true" value={toIso(value)}
          onChange={(e) => e.target.value && onChange(fmtDate(new Date(e.target.value + 'T00:00')))}
          className="pointer-events-none absolute inset-0 opacity-0" />
      </span>
    </>
  )
}

// Digits only, max 10; pasted "+91 98765 43210" / "098765..." are trimmed to 10.
function Phone({ value, onChange }) {
  const short = value.length > 0 && value.length < 10
  return (
    <>
      <input
        type="tel"
        inputMode="numeric"
        value={value}
        onChange={(e) => {
          const d = digits(e.target.value)
          onChange((d.length > 10 ? d.replace(/^(91|0)/, '') : d).slice(0, 10))
        }}
        className={`field ${short ? 'border-solid! border-red-500! print:border-transparent!' : ''}`}
      />
      {short && <span className="no-print text-[8pt] font-normal text-red-500">{value.length}/10</span>}
    </>
  )
}

// Small "Relation" line under a family number; hidden on paper if left empty.
function Relation({ value, onChange, options }) {
  return (
    <label className={`mt-[1mm] flex gap-[1.5mm] text-[9.5pt] ${value ? '' : 'print:hidden'}`}>
      <span className="text-gray-500">Relation :</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`cursor-pointer appearance-none bg-transparent outline-none ${value ? '' : 'text-gray-400'}`}
      >
        <option value="">Select ▾</option>
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </label>
  )
}

function SmallNum({ value, onChange, max }) {
  return (
    <input
      inputMode="numeric"
      value={value}
      onChange={(e) => {
        const d = digits(e.target.value).slice(0, 2)
        if (d === '' || Number(d) <= max) onChange(d)
      }}
      className="field w-[9mm] flex-none text-center"
    />
  )
}

// Shows "₹ 6,50,000" with a unit line under it: "6.5 LPA" (or "80K" below a lakh) for yearly amounts, "per month" for in-hand.
// A small number (e.g. 6.5) is read as LPA and turned into rupees when leaving the box.
function Money({ value, onChange, monthly = false }) {
  const n = Number(value)
  const shown = value === '' ? '' : '₹ ' + (value.includes('.') ? value : n.toLocaleString('en-IN'))
  const rupees = n < 100 ? n * 100000 : n
  const unit =
    !value || isNaN(n) ? '' : monthly ? 'per month'
    : rupees < 100000 ? `${Number((rupees / 1000).toFixed(1))}K` // 80,000 → 80K
    : `${Number((rupees / 100000).toFixed(2))} LPA`
  return (
    <div className="flex h-full flex-col justify-center">
      <input
        inputMode="decimal"
        placeholder={monthly ? '₹ / month' : '₹ or LPA'}
        value={shown}
        onChange={(e) => {
          const v = e.target.value.replace(/[^\d.]/g, '')
          if (/^\d*\.?\d*$/.test(v)) onChange(v)
        }}
        onBlur={() => {
          if (value && n > 0 && n < 100) onChange(String(Math.round(rupees)))
          else if (value.endsWith('.')) onChange(value.slice(0, -1))
        }}
        className={cellInput}
      />
      {unit && <span className="text-[8.5pt] leading-none text-gray-500">{unit}</span>}
    </div>
  )
}

// Enter jumps to the next field instead of doing nothing.
function nextOnEnter(e) {
  if (e.key !== 'Enter' || !['INPUT', 'SELECT'].includes(e.target.tagName)) return
  e.preventDefault()
  const els = [...e.currentTarget.querySelectorAll('input, select')]
  els[els.indexOf(e.target) + 1]?.focus()
}

const cellInput = 'w-full bg-transparent text-[10.5pt] text-center outline-none placeholder:text-[9pt] placeholder:text-gray-300'

const btn = 'flex h-8 items-center gap-1.5 rounded-full px-3.5 text-sm font-bold shadow-sm transition disabled:opacity-50'

// Companies drive Total Experience (years + months); with no dated company the typed values stay.
// Also run on open, so a "Present" job keeps counting up month by month.
function withExperience(form) {
  const m = totalMonths(form.companies)
  return m === null ? form : { ...form, expYears: String(Math.floor(m / 12)), expMonths: String(m % 12) }
}

// `record` is a saved candidate (or undefined for a new one). `onSave(form)` resolves true when saved.
export default function ProfileForm({ record, readOnly: viewOnly, onEdit, onSave, onPhase, onBack, onDelete }) {
  // A signed record is frozen exactly as signed (no experience recount either).
  const [f, setF] = useState(() => (record?.signedAt ? { ...newForm(), ...record } : withExperience({ ...newForm(), ...record })))
  const [saved, setSaved] = useState(f)
  const [saving, setSaving] = useState(false)
  const [signing, setSigning] = useState(false)
  // Locked once a signed profile is saved; only the phase can still change (saved straight away).
  const locked = !!saved.signedAt
  const readOnly = viewOnly || locked
  const dirty = JSON.stringify(f) !== JSON.stringify(saved)
  const set = (k) => (v) => setF((p) => ({ ...p, [k]: v }))
  const setSalary = (k) => (v) => setF((p) => applySalary(p, k, v))
  const setCompanies = (companies) => setF((p) => withExperience({ ...p, companies }))
  const toggleTech = (t) => set('tech')(f.tech.includes(t) ? f.tech.filter((x) => x !== t) : [...f.tech, t])

  // Warn before closing / refreshing the tab with unsaved changes.
  useEffect(() => {
    if (!dirty) return
    const warn = (e) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const save = async () => {
    if (!f.name.trim()) return alert('Please enter the candidate name before saving.')
    if (f.signedAt && !confirm('This profile is signed. After saving it will be locked and cannot be edited again.\n\nSave and lock now?')) return
    setSaving(true)
    try {
      if (await onSave(f)) setSaved(f)
    } catch (err) {
      alert('Could not save: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5 print:rounded-none print:border-0 print:p-0 print:shadow-none">
      {/* One row: back · title · phase · save state · delete · save/update · print */}
      <div className="no-print grid grid-cols-[auto_1fr] items-center gap-2 lg:grid-cols-[1fr_auto_1fr]">
        <div>
        <button
          onClick={() => (!dirty || confirm('You have unsaved changes. Leave without saving?')) && onBack()}
          aria-label="Back to all candidates" title="All candidates" className={circleBtn}
        >
          <Icon d={ICONS.back} className="h-4 w-4" />
        </button>
        </div>
        <h1 className="text-center text-base font-bold text-purple-600">
          {readOnly ? 'View Candidate' : record ? 'Update Candidate' : 'New Candidate'}
        </h1>
        <div className="col-span-2 flex flex-wrap items-center justify-end gap-2 lg:col-span-1">
        <div role="group" aria-label="Profile phase" className="flex h-8 overflow-hidden rounded-full border border-gray-300 text-[13px] font-bold">
          {PHASES.map(([v, label]) => (
            <button key={v} type="button" disabled={readOnly && !locked} aria-pressed={f.phase === v}
              onClick={async () => {
                if (!locked) return set('phase')(v)
                try {
                  await onPhase(v)
                  setF((p) => ({ ...p, phase: v }))
                  setSaved((p) => ({ ...p, phase: v }))
                } catch (err) {
                  alert('Could not change phase: ' + err.message)
                }
              }}
              className={`px-3 transition ${f.phase === v ? (v === 'confirmed' ? 'bg-emerald-500 text-white' : 'bg-gray-500 text-white') : 'bg-white text-gray-500 enabled:hover:bg-gray-50'}`}>
              {label}
            </button>
          ))}
        </div>
        {locked ? (
          <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700" title="Signed by the candidate; the profile can no longer be edited">
            <Icon d={ICONS.lock} className="h-3.5 w-3.5" /> Signed &amp; locked
          </span>
        ) : (
          <span className="px-1 text-xs text-gray-500">{readOnly ? 'View only' : dirty ? '● Unsaved changes' : record ? '✓ Saved' : ''}</span>
        )}
        {onDelete && (
          <button onClick={onDelete} className={`${btn} border border-red-200 bg-white text-red-600 hover:bg-red-50`}>
            <Icon d={ICONS.trash} className="h-4 w-4" /> Delete
          </button>
        )}
        {locked ? null : readOnly ? (
          <button onClick={onEdit} className={`${btn} bg-amber-400 text-white hover:bg-amber-500`}>
            <Icon d={ICONS.pencil} className="h-4 w-4" /> Update
          </button>
        ) : (
          <button onClick={save} disabled={saving || !dirty} className={`${btn} bg-emerald-500 text-white enabled:hover:bg-emerald-600`}>
            <Icon d={ICONS.check} className="h-4 w-4" /> {saving ? 'Saving…' : 'Save'}
          </button>
        )}
        <button onClick={() => window.print()} className={`${btn} bg-gray-800 text-white hover:bg-gray-900`}>
          <Icon d={ICONS.print} className="h-4 w-4" /> Print / PDF
        </button>
        </div>
      </div>

      {/* A4 sheet on a gray desk; scrolls sideways on small screens. */}
      {/* A4 sheet on the left, divider, career fields on the right (stacked on smaller screens). */}
      <div className="mt-4 flex flex-col gap-4 rounded-xl bg-gray-100 p-3 sm:p-4 xl:flex-row xl:items-start print:m-0 print:block print:rounded-none print:bg-transparent print:p-0">
      <div className="overflow-x-auto xl:shrink-0 print:overflow-visible">
      <form
        onKeyDown={nextOnEnter}
        onSubmit={(e) => e.preventDefault()}
        inert={readOnly}
        className="sheet mx-auto xl:mx-0 flex h-[297mm] w-[210mm] flex-col justify-between overflow-hidden bg-white p-[6mm] font-lato text-[11.5pt] leading-tight text-black shadow-lg"
      >
        {/* Candidate details */}
        <section className="grid grid-cols-[102mm_minmax(0,1fr)] gap-y-[4.5mm] text-[11.5pt]">
          <Field label="CANDIDATE NAME">
            <Text value={f.name} onChange={set('name')} autoFocus />
          </Field>
          <Field label="PHONE / CONTACT">
            <Phone value={f.phone} onChange={set('phone')} />
          </Field>
          <Field label="LAST VISIT DATE">
            <DateText value={f.visitDate} onChange={set('visitDate')} />
          </Field>
          <Field label="REFERENCE NAME">
            <Text value={f.reference} onChange={set('reference')} />
          </Field>
          <div>
            <Field label="PARENTS NUMBER">
              <Phone value={f.parentsNo} onChange={set('parentsNo')} />
            </Field>
            <Relation value={f.parentsRel} onChange={set('parentsRel')} options={['Father', 'Mother']} />
          </div>
          <div>
            <Field label="SPOUSE / SIBLINGS NUMBER">
              <Phone value={f.spouseNo} onChange={set('spouseNo')} />
            </Field>
            <Relation value={f.spouseRel} onChange={set('spouseRel')} options={['Spouse', 'Brother', 'Sister']} />
          </div>
        </section>

        {/* Former free space (41mm): now the career timeline */}
        <CareerTimeline passOut={f.passOut} companies={f.companies} />

        {/* Technology + Experience */}
        <section className="flex">
          <div className="w-[78mm]">
            <h2 className="mb-[2.6mm] font-bold underline underline-offset-2">CAREER TECHNOLOGY</h2>
            <ul className="space-y-[2.6mm]">
              {TECH.map((t) => (
                <li key={t}>
                  <label className="flex items-center gap-[2mm]">
                    <input
                      type="checkbox"
                      checked={f.tech.includes(t)}
                      onChange={() => toggleTech(t)}
                      className="h-[3.4mm] w-[3.4mm] accent-black"
                    />
                    {t}
                  </label>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex-1">
            <h2 className="mb-[2.6mm] font-bold underline underline-offset-2">EXPERIENCE SUMMARY</h2>
            <div className="flex items-baseline gap-[1.5mm]">
              Total Experience :
              <SmallNum value={f.expYears} onChange={set('expYears')} max={50} /> Yrs
              <SmallNum value={f.expMonths} onChange={set('expMonths')} max={11} /> Months
            </div>

            <table className="mt-[3.5mm] w-[120mm] table-fixed border-collapse border-[1.5px] border-black text-center">
              <colgroup>
                <col className="w-[32mm]" />
                <col className="w-[23mm]" />
                <col className="w-[24mm]" />
                <col />
              </colgroup>
              <tbody>
                <tr className="h-[14.5mm]">
                  <td className="border border-black"><Money value={f.ctc} onChange={setSalary('ctc')} /></td>
                  <td className="border-y border-l border-black border-r border-r-gray-400 [border-right-style:dashed]"><Money value={f.varPay} onChange={setSalary('varPay')} /></td>
                  <td className="border-y border-r border-black"><Money value={f.fixPay} onChange={setSalary('fixPay')} /></td>
                  <td className="border border-black"><Money value={f.inHand} onChange={setSalary('inHand')} monthly /></td>
                </tr>
                <tr className="h-[9mm]">
                  <td className="border border-black">CTC</td>
                  <td className="border-y border-l border-black border-r border-r-gray-400 [border-right-style:dashed]">VAR Pay</td>
                  <td className="border-y border-r border-black">FIX Pay</td>
                  <td className="border border-black">inHand</td>
                </tr>
              </tbody>
            </table>

            <div className="mt-[9mm] w-[120mm] text-center">
              <p className="text-[12pt]">Rs. 20,000/-&nbsp; Advance</p>
              <p className="mt-[3mm] text-[14pt] font-bold">NON REFUNDABLE</p>
              <label className="mt-[2mm] inline-flex items-center gap-[1.2mm] text-[10pt]">
                <input
                  type="checkbox"
                  checked={f.advancePaid}
                  onChange={(e) => set('advancePaid')(e.target.checked)}
                  className="h-[3.4mm] w-[3.4mm] accent-black"
                />
                Paid
              </label>
            </div>
          </div>
        </section>

        {/* Charges tables */}
        <section className="flex justify-between">
          <div>
            <h2 className="mb-[5mm] text-center font-bold underline underline-offset-2">DOCUMENTATION&nbsp; CHARGES</h2>
            <table className="w-[97mm] table-fixed border-collapse border border-gray-400">
              <colgroup>
                <col className="w-[56mm]" />
                <col />
              </colgroup>
              <tbody>
                {DOC_CHARGES.map(([name, note, price], i) => (
                  <tr key={i} className="h-[10.2mm]">
                    <td className="border border-gray-400 px-[1.8mm]">
                      {name} {note && <span className="text-[9.5pt] text-gray-600">{note}</span>}
                    </td>
                    <td className="whitespace-pre border border-gray-400 text-center">{price}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <h2 className="mb-[5mm] text-center font-bold underline underline-offset-2">INTERVIEW&nbsp; ROUNDS</h2>
            <table className="w-[94mm] table-fixed border-collapse border border-gray-400 text-center">
              <colgroup>
                <col className="w-[48mm]" />
                <col />
              </colgroup>
              <thead>
                <tr className="h-[7.5mm] font-bold">
                  <td className="border border-gray-400">ROUND</td>
                  <td className="border border-gray-400">PAYMENT</td>
                </tr>
              </thead>
              <tbody>
                {ROUNDS.map(([r, p]) => (
                  <tr key={r} className="h-[9.8mm] align-top">
                    <td className="whitespace-pre border border-gray-400 pt-[1mm]">{r}</td>
                    <td className="border border-gray-400 pt-[1mm]">{p}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-[0.5mm] -ml-[0.6mm] text-[10pt] text-gray-600">- These are interview rounds &amp; not company.</p>
          </div>
        </section>

        {/* Terms & conditions */}
        <ol className="list-decimal pl-[5mm] text-[11pt] leading-[5.6mm] marker:font-normal">
          {TERMS.map(([title, text], i) => (
            <li key={i} className="pl-[2.2mm]">
              <b>{title}</b> {text}
            </li>
          ))}
        </ol>

        {/* Signature */}
        <section className="grid grid-cols-[102mm_minmax(0,1fr)] items-end text-[11.5pt]">
          <div className="flex items-end gap-[1.5mm] font-bold">
            <span className="whitespace-nowrap">CANDIDATE SIGNATURE :</span>
            <div className="relative flex h-[13mm] min-w-0 flex-1 items-end border-b border-dashed border-gray-300 print:border-transparent">
              {f.signature.startsWith('data:image') ? (
                <img src={f.signature} alt="Candidate signature" className="h-full max-w-full object-contain object-left" />
              ) : (
                f.signature && <span className="font-normal">{f.signature}</span> // older records: typed text
              )}
              {f.signedAt && (
                <span className="absolute -bottom-[3.6mm] left-0 whitespace-nowrap text-[7pt] font-normal text-gray-500">
                  Signed {new Date(f.signedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                </span>
              )}
              {!readOnly && (
                <button type="button" onClick={() => setSigning(true)}
                  className="no-print absolute right-0 bottom-[1mm] flex items-center gap-1 rounded-full border border-purple-300 bg-white px-2.5 py-1 font-lato text-[9pt] text-purple-600 shadow-sm hover:bg-purple-50">
                  <Icon d={ICONS.signature} className="h-3.5 w-3.5" /> {f.signature ? 'Re-sign' : 'Sign here'}
                </button>
              )}
            </div>
          </div>
          <Field label="DATE OF SIGNATURE">
            <DateText value={f.signDate} onChange={set('signDate')} />
          </Field>
        </section>

        <p className="text-center font-arial text-[10pt] text-gray-500">
          Attach candidate <b>Aadhar card</b>, <b>Bank Passbook</b> Hard copy.
        </p>
      </form>
      </div>
      <div className="no-print hidden w-px self-stretch bg-gray-300 xl:block" />
      <aside inert={readOnly} className="no-print min-w-0 flex-1 xl:sticky xl:top-4">
        <CareerFields passOut={f.passOut} companies={f.companies} onPassOut={set('passOut')} onCompanies={setCompanies} />
      </aside>
      </div>
      {signing && (
        <SignaturePad
          onClose={() => setSigning(false)}
          onSave={(png) => {
            setF((p) => ({ ...p, signature: png, signedAt: new Date().toISOString(), signDate: fmtDate(new Date()) }))
            setSigning(false)
          }}
        />
      )}
    </section>
  )
}
