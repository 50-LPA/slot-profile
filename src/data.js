// Candidate records in Firestore, plus one local copy shared by every page.
//
// Fewer reads: the copy is kept in localStorage, so a reload or a new session doesn't re-read every record.
// A sync (once per session after login, and on Refresh) fetches only records changed since the last sync,
// plus a count of all records (1 read). Deletes made on another device don't show up as changes, so a count
// that doesn't match the copy triggers one full reload; a full reload also runs once a day as a safety net.
// Cost per sync: 2 reads + 1 per changed record (was: 1 per record, on every page load and every Refresh).
import { useEffect, useState } from 'react'
import {
  Timestamp, addDoc, collection, deleteDoc, doc, getCount, getDoc, getDocs, orderBy, query, serverTimestamp, setDoc, where,
} from 'firebase/firestore/lite'
import { db, withTimeout } from './firebase.js'
import { confirmAsk, toast } from './toast.jsx'
import { mergeRows } from './list.js'

const candidates = collection(db, 'candidates')
const KEY = 'slot-profile:candidates'
const FULL_EVERY = 24 * 60 * 60 * 1000 // full reload at least this often (ms)

// lastSync = newest updatedAt the server has sent us (server time, so device clocks don't matter).
// Local saves are stamped with the device time and don't move it, so the next sync re-reads them from the server.
let { rows: cache = null, lastSync = null, lastFull = 0 } = restore()
let state = { rows: cache, refreshing: false, error: '' }
const subscribers = new Set()
const emit = (patch) => { state = { ...state, ...patch }; subscribers.forEach((fn) => fn(state)) }
const publish = (rows) => { cache = rows; persist(); emit({ rows }) }
export const cached = (id) => cache?.find((r) => r.id === id)

// Timestamps are stored as { seconds, nanoseconds } and turned back into Timestamps on load.
function restore() {
  try {
    return JSON.parse(localStorage.getItem(KEY), (_k, v) => (v?.seconds != null && v?.nanoseconds != null ? new Timestamp(v.seconds, v.nanoseconds) : v)) ?? {}
  } catch { return {} }
}
// ponytail: localStorage (~5 MB) holds a few hundred signed records; move to IndexedDB if it ever fills.
// When it's full or blocked, saving the copy is skipped and the app reloads everything per session, as before.
function persist() {
  try { localStorage.setItem(KEY, JSON.stringify({ rows: cache, lastSync, lastFull })) } catch { /* see above */ }
}
export function clearCache() { // on logout: the copy holds candidate details, so it doesn't stay on the device
  cache = lastSync = null; lastFull = 0; firstSync = null; firstDone = false
  state = { rows: null, refreshing: false, error: '' }
  try { localStorage.removeItem(KEY) } catch { /* nothing stored */ }
}

const toRow = (d) => ({ id: d.id, ...d.data() })
const newest = (rows, since) => rows.reduce((m, r) => (r.updatedAt && (!m || r.updatedAt.valueOf() > m.valueOf()) ? r.updatedAt : m), since)

async function full() {
  const rows = (await withTimeout(getDocs(query(candidates, orderBy('updatedAt', 'desc'))))).docs.map(toRow)
  lastSync = newest(rows, null); lastFull = Date.now()
  publish(rows)
}
async function delta() {
  const [snap, count] = await withTimeout(Promise.all([getDocs(query(candidates, where('updatedAt', '>', lastSync))), getCount(candidates)]))
  const changed = snap.docs.map(toRow)
  const rows = mergeRows(cache, changed) // merged into the current copy, so a save made meanwhile isn't lost
  if (rows.length !== count.data().count) return full() // deleted (or added) somewhere the change list can't show
  lastSync = newest(changed, lastSync)
  if (changed.length) publish(rows); else persist()
}

// One sync at a time; callers share the one in flight.
let running = null
export function sync() {
  running ??= (async () => {
    emit({ refreshing: true })
    try {
      await (cache && lastSync && Date.now() - lastFull < FULL_EVERY ? delta() : full())
      emit({ error: '' })
    } catch (err) {
      emit({ error: err.message })
      throw err
    } finally {
      running = null
      emit({ refreshing: false })
    }
  })()
  return running
}
// The session's first sync: started after login; candidate pages wait for it so they never edit an out-of-date copy.
let firstSync = null
let firstDone = false
export const synced = () => (firstSync ??= sync().catch(() => {}).finally(() => { firstDone = true }))
export const firstSyncDone = () => firstDone

// { rows, error, refreshing, refresh }: rows are null only before the very first load on this device.
export function useCandidates() {
  const [s, setS] = useState(state)
  useEffect(() => {
    subscribers.add(setS)
    setS(state)
    return () => subscribers.delete(setS)
  }, [])
  return { ...s, refresh: () => sync().catch(() => {}) }
}

export const getCandidate = (id) => withTimeout(getDoc(doc(candidates, id))).then((d) => (d.exists() ? d.data() : null))

// Another saved candidate with this phone, or null. Checked in the synced copy (no read); queried only without one.
export async function findByPhone(phone, exceptId) {
  if (cache && firstDone) return cache.find((r) => r.phone === phone && r.id !== exceptId) ?? null
  const snap = await withTimeout(getDocs(query(candidates, where('phone', '==', phone))))
  const other = snap.docs.find((d) => d.id !== exceptId)
  return other ? { id: other.id, ...other.data() } : null
}

// Saves the form. Only form fields are written: the list's `id` and the timestamps are never copied into the record.
// merge keeps createdAt. Resolves the record's id.
export async function saveCandidate(id, form) {
  const { id: _id, createdAt: _c, updatedAt: _u, ...data } = form
  const now = Timestamp.now()
  if (id) {
    await withTimeout(setDoc(doc(candidates, id), { ...data, updatedAt: serverTimestamp() }, { merge: true }))
  } else {
    id = (await withTimeout(addDoc(candidates, { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }))).id
  }
  if (cache) {
    const old = cached(id)
    publish([{ ...old, ...data, id, createdAt: old?.createdAt ?? now, updatedAt: now }, ...cache.filter((r) => r.id !== id)])
  }
  return id
}

// Asks, deletes, then offers Undo for a few seconds (puts the same record back under the same id).
// Resolves true if deleted.
export async function removeCandidate(id, name) {
  if (!(await confirmAsk({ title: `Delete ${name || 'this candidate'}?`, message: 'The record is removed for good. You can undo for a few seconds after.', ok: 'Delete', danger: true }))) return false
  let row
  try {
    row = cached(id) ?? { ...(await getCandidate(id)), id } // kept for Undo
    await withTimeout(deleteDoc(doc(candidates, id)))
  } catch (err) {
    toast('Could not delete: ' + err.message, { tone: 'error' })
    return false
  }
  if (cache) publish(cache.filter((r) => r.id !== id))
  toast(`Deleted ${name || 'candidate'}.`, {
    action: {
      label: 'Undo',
      run: async () => {
        const { id: _id, ...data } = row
        try {
          await withTimeout(setDoc(doc(candidates, id), { ...data, createdAt: data.createdAt ?? serverTimestamp(), updatedAt: serverTimestamp() }))
          if (cache) publish(mergeRows(cache, [{ ...row, updatedAt: Timestamp.now() }]))
          toast(`${name || 'Candidate'} restored.`)
        } catch (err) {
          toast('Could not restore: ' + err.message, { tone: 'error' })
        }
      },
    },
  })
  return true
}

// Phase button in the list: the pill changes at once, and the phase is written once clicks stop for a moment, so
// rapid clicks make one save. The row keeps its place on screen (cache updatedAt untouched); the DB gets the new time.
const phaseTimers = new Map()
export function setPhase(id, phase) {
  const before = cached(id)
  if (!before) return
  publish(cache.map((r) => (r.id === id ? { ...r, phase } : r)))
  clearTimeout(phaseTimers.get(id)?.timer)
  const was = phaseTimers.get(id)?.was ?? before.phase // phase last saved, for putting back on failure
  phaseTimers.set(id, {
    was,
    timer: setTimeout(async () => {
      phaseTimers.delete(id)
      try {
        await withTimeout(setDoc(doc(candidates, id), { phase, updatedAt: serverTimestamp() }, { merge: true }))
      } catch (err) {
        if (cache) publish(cache.map((r) => (r.id === id ? { ...r, phase: was } : r)))
        toast(`Phase not saved for ${before.name || 'candidate'}: ${err.message}`, { tone: 'error' })
      }
    }, 600),
  })
}
