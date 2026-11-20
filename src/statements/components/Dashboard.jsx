import { useMemo, useRef, useState } from 'react';
import { compute } from '../lib/calc.js';
import { demoStatement } from '../lib/demo.js';
import { fmtLongDate, money } from '../lib/format.js';
import { blankStatement, maskAccount, newId, normalizeStatement, statementTitle } from '../lib/model.js';
import { validateAccount } from '../lib/validate.js';
import { downloadStatementPdf } from '../pdf/generate.jsx';
import { go } from '../route.js';

export default function Dashboard({ list, onSave, onDelete, persistent }) {
  const [busyId, setBusyId] = useState(null);
  const [msg, setMsg] = useState(null);
  const fileRef = useRef(null);
  const rows = useMemo(
    () => [...list].sort((x, y) => y.updatedAt - x.updatedAt).map(st => ({ st, c: compute(st) })),
    [list],
  );

  const create = st => { onSave(st); go(st.id); };

  function duplicate(st) {
    const now = Date.now();
    onSave({
      ...st,
      id: newId(),
      createdAt: now,
      account: { ...st.account, holderName: `${st.account.holderName || 'Untitled'} (copy)` },
      transactions: st.transactions.map(t => ({ ...t, id: newId() })),
    });
    setMsg({ tone: 'ok', text: `Duplicated “${statementTitle(st)}”.` });
  }

  function remove(st) {
    if (!window.confirm(`Delete “${statementTitle(st)}” and its ${st.transactions.length} transactions?\n\nThis cannot be undone.`)) return;
    onDelete(st.id);
    setMsg({ tone: 'ok', text: `Deleted “${statementTitle(st)}”.` });
  }

  async function download(st) {
    const problems = Object.keys(validateAccount(st.account)).length;
    if (problems) return setMsg({ tone: 'danger', text: `“${statementTitle(st)}” has ${problems} account field${problems > 1 ? 's' : ''} to fix before it can be downloaded. Open it with Edit.` });
    setBusyId(st.id);
    try {
      await downloadStatementPdf(st, {
        encrypted: Boolean(st.account?.encryptPdf),
        password: st.account?.pdfPassword,
      });
      if (st.account?.encryptPdf && st.account?.pdfPassword) {
        setMsg({ tone: 'ok', text: `Downloaded encrypted PDF for “${statementTitle(st)}”. Password: "${st.account.pdfPassword}".` });
      }
    } catch (e) {
      setMsg({ tone: 'danger', text: `PDF generation failed: ${e.message}` });
    } finally {
      setBusyId(null);
    }
  }

  async function openFile(file) {
    fileRef.current.value = '';
    if (!file) return;
    try {
      if (file.size > 5_000_000) throw new Error('file is larger than 5 MB');
      const st = normalizeStatement(JSON.parse(await file.text()));
      if (!st) throw new Error('this is not a Statement Builder file');
      create({ ...st, id: newId(), transactions: st.transactions.map(t => ({ ...t, id: newId() })) });
    } catch (e) {
      setMsg({ tone: 'danger', text: `Could not open ${file.name}: ${e.message}` });
    }
  }

  return (
    <div className="dash">
      <header className="dash-head">
        <div>
          <h1>Statement Builder</h1>
          <p className="muted">Account statement generator and live preview.</p>
        </div>
        <div className="dash-actions">
          <button type="button" className="btn primary" onClick={() => create(blankStatement())}>New statement</button>
          <button type="button" className="btn" onClick={() => create(demoStatement())}>New from demo data</button>
          <button type="button" className="btn" onClick={() => fileRef.current.click()}>Open .json file</button>
          <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={e => openFile(e.target.files[0])} />
        </div>
      </header>

      {!persistent && <p className="alert warn">Browser storage is blocked, so statements will be lost when this tab closes. Use “Save as file” inside a statement.</p>}
      {msg && (
        <div className={`alert ${msg.tone}`} role="status">
          <div className="alert-row">
            <span>{msg.text}</span>
            <button type="button" className="link" onClick={() => setMsg(null)}>Dismiss</button>
          </div>
        </div>
      )}

      <section className="panel" aria-label="Saved statements">
        <h2 className="group-title">Saved statements <span className="count">{rows.length}</span></h2>
        {rows.length === 0 ? (
          <p className="empty">No statements yet. Start a new one, or begin from demo data to see how it works.</p>
        ) : (
          <div className="table-wrap">
            <table className="tx-table dash-table">
              <thead>
                <tr>
                  <th>Account holder</th>
                  <th>Period</th>
                  <th className="num">Transactions</th>
                  <th className="num">Closing balance</th>
                  <th>Last edited</th>
                  <th><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ st, c }) => (
                  <tr key={st.id}>
                    <td>
                      <a href={`#/statements/edit/${encodeURIComponent(st.id)}`} className="strong-link">{statementTitle(st)}</a>
                      <small className="sub">{[st.account.accountType, maskAccount(st.account.accountNumber)].filter(Boolean).join(' · ')}</small>
                    </td>
                    <td className="nowrap">{st.account.periodStart ? `${fmtLongDate(st.account.periodStart)} – ${fmtLongDate(st.account.periodEnd)}` : '—'}</td>
                    <td className="num">{c.count}</td>
                    <td className={`num ${c.closing < 0 ? 'debit' : ''}`}>{st.account.currency} {money(c.closing, st.account.currency)}</td>
                    <td className="nowrap">{new Date(st.updatedAt).toLocaleString()}</td>
                    <td className="row-actions">
                      <button type="button" className="link" onClick={() => go(st.id)}>Open</button>
                      <button type="button" className="link" onClick={() => download(st)} disabled={busyId === st.id}>{busyId === st.id ? 'Generating…' : 'PDF'}</button>
                      <button type="button" className="link" onClick={() => duplicate(st)}>Duplicate</button>
                      <button type="button" className="link danger" onClick={() => remove(st)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <p className="muted small">Statements are stored in this browser only. Use “Save as file” to keep a copy or move it to another device.</p>
    </div>
  );
}
