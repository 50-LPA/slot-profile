import { toISO } from './format.js';
import { blankStatement, newId } from './model.js';

// Small seeded PRNG so the demo data is the same every time it is loaded.
const rng = seed => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);

const MERCHANTS = [
  ['UPI - Demo Grocery Mart', 180, 3200],
  ['UPI - Sample Fuel Station', 500, 2500],
  ['UPI - Example Cafe', 120, 950],
  ['UPI - Demo Pharmacy', 150, 1800],
  ['Card - Online Shopping (Demo)', 400, 4800],
  ['UPI - Test Electronics Store', 900, 4200],
  ['UPI - Demo Restaurant', 350, 2100],
  ['UPI/DEMO HOME APPLIANCES PVT LTD/demo.appliances@okdemo/DEMO0000456/Payment for order 88231 - EMI instalment (demo)', 1200, 4500],
];

/** A fictional person with ~60 transactions over the last three full months. */
export function demoStatement(today = new Date()) {
  const r = rng(20261112);
  const pick = arr => arr[Math.floor(r() * arr.length)];
  const between = (lo, hi) => Math.round((lo + r() * (hi - lo)) * 100) / 100;
  let refNo = 4100;
  const txns = [];
  const add = (date, description, type, amount) =>
    txns.push({ id: newId(), date: toISO(date), valueDate: toISO(date), description, reference: `DM${(refNo += 7)}${Math.floor(r() * 90 + 10)}`, type, amount: amount.toFixed(2) });

  const start = new Date(today.getFullYear(), today.getMonth() - 3, 1);
  const end = new Date(today.getFullYear(), today.getMonth(), 0);

  for (let k = 0; k < 3; k++) {
    const y = start.getFullYear(), m = start.getMonth() + k;
    const lastDay = new Date(y, m + 1, 0).getDate();
    const day = d => new Date(y, m, Math.min(d, lastDay));
    add(day(1), 'Salary credit - Demo Technologies Pvt Ltd', 'credit', 85000);
    add(day(3), 'NEFT - Rent transfer to Demo Landlord', 'debit', 22000);
    add(day(5), 'Mutual fund SIP - Demo Asset Management', 'debit', 5000);
    add(day(10), 'Electricity bill - Demo Power Co', 'debit', between(1650, 2600));
    add(day(12), 'Mobile recharge - Demo Telecom', 'debit', 599);
    for (let i = 0; i < 2; i++) add(day(6 + Math.floor(r() * 22)), 'ATM cash withdrawal - Demo ATM 0042', 'debit', pick([2000, 3000, 5000]));
    for (let i = 0; i < 10; i++) {
      const [name, lo, hi] = pick(MERCHANTS);
      add(day(2 + Math.floor(r() * (lastDay - 2))), name, 'debit', between(lo, hi));
    }
    add(day(8 + Math.floor(r() * 15)), 'UPI received - R Kapoor (shared expenses)', 'credit', between(800, 3500));
    if (k === 1) add(day(20), 'Refund - Online Shopping (Demo)', 'credit', 1499);
  }
  add(end, 'Savings interest credit', 'credit', 312.45);
  txns.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const s = blankStatement();
  s.account = {
    title: 'Mr',
    holderName: 'Aarav Mehta',
    customerId: '104582731',
    address: '402, Sample Residency, Aundh Road\nNear Demo Park, Aundh',
    city: 'Pune',
    pinCode: '411007',
    state: 'Maharashtra',
    country: 'India',
    micr: '999999123',
    ifsc: 'DEMO0000123',
    accountNumber: '00001234567890',
    accountType: 'Savings',
    branch: 'Demo Branch – Baner, Pune',
    accountStatus: 'Active',
    nomination: 'Yes',
    currency: 'INR',
    periodStart: toISO(start),
    periodEnd: toISO(end),
    openingBalance: '48250.75',
  };
  s.transactions = txns;
  return s;
}
