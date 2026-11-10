// Candidate records in Firestore, plus one in-memory copy shared by the home page and the list.
import { useEffect, useState } from 'react'
import {
  Timestamp, addDoc, collection, deleteDoc, deleteField, doc, getDoc, getDocs, orderBy, query, serverTimestamp, setDoc, where,
} from 'firebase/firestore/lite'
import { db, withTimeout } from './firebase.js'
import { confirmAsk, toast } from './toast.jsx'

const candidates = collection(db, 'candidates')

// In-memory copy: pages open instantly from it; saves/deletes keep it current; cleared on logout.
// ponytail: loads every record and filters in the browser; fine for a few thousand, query page by page beyond that.
let cache = null
const subscribers = new Set()
const publish = (rows) => { cache = rows; subscribers.forEach((fn) => fn(rows)) }
export const clearCache = () => { cache = null } // on logout
export const cached = (id) => cache?.find((r) => r.id === id)

export const loadAll = () =>
  withTimeout(getDocs(query(candidates, orderBy('updatedAt', 'desc'))))
    .then((snap) => publish(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))

// { rows, error, refreshing, refresh } — rows stay null until the first load; every page sees the same copy.
export function useCandidates() {
  const [rows, setRows] = useState(cache)
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(!cache) // first visit loads straight away
  const load = () => loadAll().then(() => setError(''), (err) => setError(err.message)).finally(() => setRefreshing(false))
  const refresh = () => { setRefreshing(true); return load() }
  useEffect(() => {
    subscribers.add(setRows)
    if (!cache) load()
    return () => subscribers.delete(setRows)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return { rows, error, refreshing, refresh }
}

export const getCandidate = (id) => withTimeout(getDoc(doc(candidates, id))).then((d) => (d.exists() ? d.data() : null))

// Another saved candidate with this phone, or null.
export async function findByPhone(phone, exceptId) {
  const snap = await withTimeout(getDocs(query(candidates, where('phone', '==', phone))))
  const other = snap.docs.find((d) => d.id !== exceptId)
  return other ? { id: other.id, ...other.data() } : null
}

// Saves the form. Only form fields are written: the list's `id` and the timestamps are never copied into the record
// (and an `id` saved by older versions is removed). merge keeps createdAt. Resolves the record's id.
export async function saveCandidate(id, form) {
  const { id: _id, createdAt: _c, updatedAt: _u, ...data } = form
  const now = Timestamp.now()
  if (id) {
    await withTimeout(setDoc(doc(candidates, id), { ...data, id: deleteField(), visitDate: deleteField(), updatedAt: serverTimestamp() }, { merge: true }))
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
          if (cache) publish(sortByUpdated([{ ...row, updatedAt: Timestamp.now() }, ...cache]))
          toast(`${name || 'Candidate'} restored.`)
        } catch (err) {
          toast('Could not restore: ' + err.message, { tone: 'error' })
        }
      },
    },
  })
  return true
}
const sortByUpdated = (rows) => [...rows].sort((a, b) => (b.updatedAt?.toMillis?.() ?? 0) - (a.updatedAt?.toMillis?.() ?? 0))

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
