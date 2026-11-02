import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'

// Public web config (safe to ship). Access is controlled by Firebase Auth + firestore.rules: only the admin account can read or write.
const app = initializeApp({
  apiKey: 'AIzaSyDoEwHBhiPZSDtHnIrrjG7UPRE07y_jOW0',
  authDomain: 'interview-candidate-profile.firebaseapp.com',
  projectId: 'interview-candidate-profile',
  storageBucket: 'interview-candidate-profile.firebasestorage.app',
  messagingSenderId: '932140149289',
  appId: '1:932140149289:web:a1fef2068d3737f373ca38',
})

export const db = getFirestore(app)
export const auth = getAuth(app)

// The admin logs in with a mobile number; Firebase Auth needs an email, so the number maps to this address.
export const loginEmail = (phone) => `${phone.trim()}@candidate-profile.app`

// Firestore retries silently forever when it can't reach the database; fail with a clear message instead.
export const withTimeout = (promise, ms = 15000) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('No response from the database. Check the internet connection and that Firestore is set up in Firebase.')), ms),
    ),
  ])
