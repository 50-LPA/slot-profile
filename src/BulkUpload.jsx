import { useState } from 'react'
import { getDocs, doc, serverTimestamp, writeBatch } from 'firebase/firestore/lite'
import { db, withTimeout } from './firebase.js'
import { ICONS, Icon } from './icons.jsx'
import { Button, Card, CardHeader, Pill } from './ui.jsx'
import { SAMPLE_CSV, markDuplicates, readCandidates } from './bulk.js'
import { phaseLabel } from './options.js'

const th = 'border border-gray-200 px-3 py-2 font-bold text-gray-700'
const td = 'border border-gray-200 px-3 py-2'

function downloadSample() {
  const url = URL.createObjectURL(new Blob(['﻿' + SAMPLE_CSV], { type: 'text/csv' })) // BOM so Excel reads it as UTF-8
  Object.assign(document.createElement('a'), { href: url, download: 'candidates-sample.csv' }).click()
  URL.revokeObjectURL(url)
}

// "Phone: "123" is not valid…" → "Phone"; "Name is required" → "Name". Used to count failures per rule.
const ruleOf = (why) => why.match(/^([^:]+?)(?::| is required)/)?.[1] ?? 'Other'

// Shown after an import: success / failed counts, failures per rule, then both lists with the reason for each failed row.
function ImportResult({ name, ok, failed }) {
  const byRule = Object.entries(
    failed.flatMap((r) => [...new Set(r.why.map(ruleOf))]).reduce((m, k) => ({ ...m, [k]: (m[k] ?? 0) + 1 }), {}),
  ).sort((a, b) => b[1] - a[1])
  return (
    <div className="mt-4 space-y-4">
      <p className="text-sm text-gray-500">Import result for <span className="font-bold text-gray-800">{name}</span></p>
      <div className="grid grid-cols-2 gap-3 sm:max-w-md">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-2xl font-bold text-emerald-700">{ok.length}</p>
          <p className="text-xs font-bold text-emerald-700">Successful entries</p>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-3">
          <p className="text-2xl font-bold text-red-700">{failed.length}</p>
          <p className="text-xs font-bold text-red-700">Failed entries</p>
        </div>
      </div>

      {byRule.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-bold text-gray-600">Failed rows by rule</p>
          <div className="flex flex-wrap gap-1.5">
            {byRule.map(([rule, n]) => <span key={rule} className="rounded-full border border-red-200 bg-white px-2.5 py-0.5 text-xs text-red-700">{rule} · <b>{n}</b></span>)}
          </div>
        </div>
      )}

      {failed.length > 0 && (
        <div>
          <p className="mb-1.5 text-sm font-bold text-red-700">Failed entries ({failed.length})</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] border-collapse text-left text-[13px] text-gray-800">
              <thead className="bg-gray-50"><tr>{['Row', 'Name', 'Phone', 'Why it failed'].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
              <tbody>
                {failed.map((r) => (
                  <tr key={r.line}>
                    <td className={`${td} w-12 text-center`}>{r.line}</td>
                    <td className={td}>{r.record.name || '-'}</td>
                    <td className={td}>{r.record.phone || '-'}</td>
                    <td className={td}><ul className="list-disc pl-4 text-red-600">{r.why.map((w) => <li key={w}>{w}</li>)}</ul></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-1.5 text-xs text-gray-500">Fix these rows in the file and upload it again; rows already saved will show as duplicates and be skipped.</p>
        </div>
      )}

      {ok.length > 0 && (
        <div>
          <p className="mb-1.5 text-sm font-bold text-emerald-700">Successful entries ({ok.length}) · <a href="#/candidates" className="underline">Open candidate list</a></p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] border-collapse text-left text-[13px] text-gray-800">
              <thead className="bg-gray-50"><tr>{['Row', 'Name', 'Phone', 'Phase', 'Career Technology'].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
              <tbody>
                {ok.map((r) => (
                  <tr key={r.line}>
                    <td className={`${td} w-12 text-center`}>{r.line}</td>
                    <td className={td}>{r.record.name}</td>
                    <td className={td}>{r.record.phone || '-'}</td>
                    <td className={td}>{phaseLabel(r.record)}</td>
                    <td className={td}>{r.record.tech.join(', ') || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// Upload a CSV of existing (paper) candidates: every row is checked like the profile form, then the good ones are saved together.
// `candidates` is the Firestore collection; `onImported` runs after a save so the list re-fetches.
export default function BulkUpload({ candidates, onImported }) {
  const [file, setFile] = useState(null) // { name, error } or { name, rows, unknown }
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(0)
  const [result, setResult] = useState(null) // after an import: { name, ok: rows, failed: rows with `why` }

  const pick = async (f) => {
    if (!f) return
    setBusy(true); setDone(0); setResult(null)
    try {
      const result = readCandidates(await f.text())
      if (result.rows) {
        markDuplicates(result.rows, (await withTimeout(getDocs(candidates))).docs.map((d) => d.data()))
      }
      setFile({ name: f.name, ...result })
    } catch (err) {
      setFile({ name: f.name, error: 'Could not read the file: ' + err.message })
    }
    setBusy(false)
  }

  const ready = file?.rows?.filter((r) => !r.errors.length && !r.duplicate) ?? []
  const bad = file?.rows?.filter((r) => r.errors.length).length ?? 0
  const dupes = file?.rows?.filter((r) => r.duplicate).length ?? 0

  const save = async () => {
    setBusy(true)
    let saved = 0, saveError = ''
    try {
      for (let i = 0; i < ready.length; i += 400) { // Firestore allows 500 writes per batch
        const batch = writeBatch(db)
        for (const { record } of ready.slice(i, i + 400)) {
          batch.set(doc(candidates), { ...record, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
        }
        await withTimeout(batch.commit())
        saved = Math.min(i + 400, ready.length)
        setDone(saved)
      }
    } catch (err) {
      saveError = 'Not saved: ' + err.message
    }
    if (saved) onImported()
    // Rows left out (bad cells, duplicate phone) or not reached because saving stopped, each with why.
    const failed = file.rows
      .filter((r) => r.errors.length || r.duplicate || ready.indexOf(r) >= saved)
      .map((r) => ({ ...r, why: r.errors.length ? r.errors : r.duplicate ? [`Duplicate: ${r.duplicate}`] : [saveError] }))
    setResult({ name: file.name, ok: ready.slice(0, saved), failed })
    setFile(null)
    setBusy(false)
  }

  return (
    <Card>
      <CardHeader
        onBack={() => history.back()}
        title="Bulk Upload"
        actions={<Button variant="dark" icon={ICONS.download} onClick={downloadSample}>Sample CSV</Button>}
      />

      <label className={`mt-4 flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-purple-200 bg-purple-50/40 px-4 py-8 text-center hover:border-purple-400 ${busy ? 'pointer-events-none opacity-60' : ''}`}
        onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files[0]) }}>
        <Icon d={ICONS.upload} className="h-8 w-8 text-purple-500" />
        <span className="text-sm font-bold text-gray-800">{busy ? 'Working…' : file ? `${file.name} · choose another file` : 'Choose a CSV file or drop it here'}</span>
        <span className="text-xs text-gray-500">Excel: File → Save As → “CSV UTF-8”. Use the sample CSV for the exact column headings.</span>
        <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => { pick(e.target.files[0]); e.target.value = '' }} />
      </label>

      {result && <ImportResult {...result} />}
      {file?.error && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-600">{file.error}</p>}

      {file?.rows && (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
            <Pill tone="green">{ready.length} ready</Pill>
            {bad > 0 && <Pill tone="red">{bad} with errors</Pill>}
            {dupes > 0 && <Pill tone="amber">{dupes} duplicate</Pill>}
            {file.unknown.length > 0 && <span className="text-xs text-gray-500">Ignored columns: {file.unknown.join(', ')}</span>}
            <Button className="ml-auto" icon={ICONS.upload} disabled={busy || !ready.length} onClick={save}>
              {busy && done ? `Saving… ${done}/${ready.length}` : `Import ${ready.length} candidates`}
            </Button>
          </div>
          {(bad > 0 || dupes > 0) && <p className="mt-2 text-xs text-gray-500">Rows with errors or duplicates (same phone, or same name when there is no phone) are skipped. Fix them in the file and upload again, or import the ready ones now.</p>}
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[800px] border-collapse text-left text-[13px] text-gray-800">
              <thead className="bg-gray-50">
                <tr>{['Row', 'Name', 'Phone', 'Phase', 'Career Technology', 'Status'].map((h) => <th key={h} className={th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {file.rows.map((r) => (
                  <tr key={r.line} className={r.errors.length ? 'bg-red-50/60' : r.duplicate ? 'bg-amber-50/60' : ''}>
                    <td className={`${td} w-12 text-center`}>{r.line}</td>
                    <td className={td}>{r.record.name || '-'}</td>
                    <td className={td}>{r.record.phone || '-'}</td>
                    <td className={td}>{phaseLabel(r.record)}</td>
                    <td className={td}>{r.record.tech.join(', ') || '-'}</td>
                    <td className={td}>
                      {r.errors.length ? <ul className="list-disc pl-4 text-red-600">{r.errors.map((e) => <li key={e}>{e}</li>)}</ul>
                        : r.duplicate ? <span className="text-amber-700">Skipped: {r.duplicate}</span>
                        : <span className="font-bold text-emerald-700">Ready</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

    </Card>
  )
}
