import { useRef, useState } from 'react';
import { money, plainAmount, todayISO, toPaise } from '../lib/format.js';
import { blankTransaction, newId } from '../lib/model.js';
import { fillTransactionGaps, parseTransactionsFromJson } from '../lib/seeder.js';
import { validateTransaction } from '../lib/validate.js';
import DatePicker from './DatePicker.jsx';

export default function TransactionManager({ statement, onTransactions, onAccount, onUpdateStatement }) {
  const txns = statement.transactions;
  const cur = statement.account.currency;
  const m = p => money(p, cur);

  const lastDate = () => txns.reduce((d, t) => (t.date > d ? t.date : d), '') || statement.account.periodStart || todayISO();
  const [draft, setDraft] = useState(() => blankTransaction(lastDate()));
  const [errors, setErrors] = useState({});
  const [msg, setMsg] = useState(null);
  const [fillingGaps, setFillingGaps] = useState(false);
  const formRef = useRef(null);
  const descRef = useRef(null);
  const fileInputRef = useRef(null);

  const set = patch => setDraft(d => ({ ...d, ...patch }));

  function submit(e) {
    e.preventDefault();
    const t = { ...draft, description: draft.description.trim(), reference: draft.reference.trim(), amount: draft.amount.trim() };
    const errs = validateTransaction(t);
    setErrors(errs);
    if (Object.keys(errs).length) {
      formRef.current.querySelector('[aria-invalid="true"]')?.focus();
      return;
    }
    t.amount = plainAmount(toPaise(t.amount));
    onTransactions(list => [...list, { ...t, id: newId() }]);
    setMsg({ tone: 'ok', text: `Added: ${t.description} (${t.type} ${m(toPaise(t.amount))}).` });
    setDraft({ ...blankTransaction(t.date), type: t.type });
    setErrors({});
    descRef.current?.focus();
  }

  async function handleJsonFile(e) {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!file) return;

    try {
      if (file.size > 5_000_000) throw new Error('File is larger than 5 MB.');
      const text = await file.text();
      const parsed = parseTransactionsFromJson(text, statement.account);

      let replace = false;
      if (txns.length > 0) {
        replace = window.confirm(
          `Imported ${parsed.transactions.length} transactions (${parsed.isSalaryCredits ? 'Salary Credits' : 'Transactions'}).\n\n` +
          `Click OK to REPLACE existing ${txns.length} transactions.\n` +
          `Click Cancel to APPEND to existing transactions.`
        );
      }

      const nextList = replace ? parsed.transactions : [...txns, ...parsed.transactions];

      const patch = {};
      if (parsed.minDate && parsed.maxDate) {
        const acc = statement.account;
        if (!acc.periodStart || acc.periodStart > parsed.minDate) {
          const [y, mo] = parsed.minDate.split('-');
          patch.periodStart = `${y}-${mo}-01`;
        }
        if (!acc.periodEnd || acc.periodEnd < parsed.maxDate) {
          const [y, mo] = parsed.maxDate.split('-');
          const lastDay = new Date(Number(y), Number(mo), 0).getDate();
          patch.periodEnd = `${y}-${mo}-${String(lastDay).padStart(2, '0')}`;
        }
      }

      if (onUpdateStatement) {
        onUpdateStatement({
          transactions: nextList,
          account: Object.keys(patch).length > 0 ? patch : undefined,
        });
      } else {
        onTransactions(nextList);
        if (onAccount && Object.keys(patch).length > 0) onAccount(patch);
      }

      setMsg({
        tone: 'ok',
        text: `Imported ${parsed.transactions.length} transactions from “${file.name}”. Click “⚡ Fill gaps with random” to generate daily expenses between salary payments.`,
      });
    } catch (err) {
      setMsg({ tone: 'danger', text: `Failed to import JSON: ${err.message}` });
    }
  }

  function handleFillGaps() {
    setFillingGaps(true);
    try {
      const res = fillTransactionGaps(statement.account, txns);
      if (res.addedCount === 0) {
        setMsg({
          tone: 'warn',
          text: 'No empty date gaps found to fill. Ensure statement dates are set or import salary transactions first.',
        });
        return;
      }

      const accountPatch = {};
      if (res.periodStart !== statement.account.periodStart) accountPatch.periodStart = res.periodStart;
      if (res.periodEnd !== statement.account.periodEnd) accountPatch.periodEnd = res.periodEnd;

      if (onUpdateStatement) {
        onUpdateStatement({
          transactions: res.transactions,
          account: Object.keys(accountPatch).length > 0 ? accountPatch : undefined,
        });
      } else {
        onTransactions(res.transactions);
        if (onAccount && Object.keys(accountPatch).length > 0) onAccount(accountPatch);
      }

      setMsg({
        tone: 'ok',
        text: `⚡ Filled gaps: Generated ${res.addedCount} realistic daily transactions across empty dates. All existing transactions and salary credits were preserved with balanced positive savings.`,
      });
    } catch (err) {
      setMsg({ tone: 'danger', text: `Error filling transaction gaps: ${err.message}` });
    } finally {
      setFillingGaps(false);
    }
  }

  const fieldProps = k => ({
    id: `tx-${k}`,
    value: draft[k],
    onChange: e => set({ [k]: e.target.value }),
    'aria-invalid': errors[k] ? 'true' : undefined,
    'aria-describedby': errors[k] ? `tx-${k}-err` : undefined,
  });
  const err = k => errors[k] && <small id={`tx-${k}-err`} className="error">{errors[k]}</small>;

  return (
    <div className="panel">
      <form ref={formRef} className="group tx-form" onSubmit={submit} noValidate aria-label="Add transaction">
        <div className="tx-form-header">
          <h2 className="group-title" style={{ margin: 0 }}>Add transaction</h2>
          <div className="tx-helper-actions">
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => fileInputRef.current?.click()}
              title="Import salary credits or transactions from a JSON file"
            >
              📥 Import JSON
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              hidden
              onChange={handleJsonFile}
            />
            <button
              type="button"
              className="btn btn-sm"
              disabled={fillingGaps}
              onClick={handleFillGaps}
              title="Fill empty days between transactions with realistic daily random debits"
            >
              {fillingGaps ? 'Filling…' : '⚡ Fill gaps with random'}
            </button>
          </div>
        </div>
        <div className="grid tx-grid">
          <div className="field">
            <label htmlFor="tx-date">Transaction date <span className="req" aria-hidden="true">*</span></label>
            <DatePicker
              id="tx-date"
              name="date"
              value={draft.date}
              onChange={d => set({ date: d })}
              placeholder="dd-mmm-yyyy"
              required
              aria-invalid={errors.date ? 'true' : undefined}
              aria-describedby={errors.date ? 'tx-date-err' : undefined}
            />
            {err('date')}
          </div>
          <div className="field">
            <label htmlFor="tx-valueDate">Value date</label>
            <DatePicker
              id="tx-valueDate"
              name="valueDate"
              value={draft.valueDate}
              onChange={d => set({ valueDate: d })}
              placeholder="Blank = same as date"
              aria-invalid={errors.valueDate ? 'true' : undefined}
              aria-describedby={errors.valueDate ? 'tx-valueDate-err' : undefined}
            />
            {err('valueDate') || <small className="hint">Blank = same as transaction date</small>}
          </div>
          <div className="field full">
            <label htmlFor="tx-description">Description <span className="req" aria-hidden="true">*</span></label>
            <input ref={descRef} maxLength={160} placeholder="e.g. UPI - Demo Grocery Mart" {...fieldProps('description')} />
            {err('description')}
          </div>
          <div className="field">
            <label htmlFor="tx-reference">Reference no.</label>
            <input maxLength={30} placeholder="Demo reference" {...fieldProps('reference')} />
            {err('reference')}
          </div>
          <div className="field">
            <label htmlFor="tx-amount">Amount ({cur}) <span className="req" aria-hidden="true">*</span></label>
            <input inputMode="decimal" placeholder="0.00" {...fieldProps('amount')} />
            {err('amount')}
          </div>
          <div className="field">
            <span className="label" id="tx-type-label">Type</span>
            <div className="seg" role="radiogroup" aria-labelledby="tx-type-label">
              {['debit', 'credit'].map(v => (
                <label key={v} className={`seg-opt ${v} ${draft.type === v ? 'on' : ''}`}>
                  <input type="radio" name="tx-type" value={v} checked={draft.type === v} onChange={() => set({ type: v })} />
                  {v === 'debit' ? 'Debit' : 'Credit'}
                </label>
              ))}
            </div>
          </div>
          <div className="field tx-actions">
            <button type="submit" className="btn primary">Add transaction</button>
          </div>
        </div>
      </form>

      {msg && (
        <div className={`alert ${msg.tone}`} role="status">
          <div className="alert-row">
            <span>{msg.text}</span>
            <button type="button" className="link" onClick={() => setMsg(null)} aria-label="Dismiss message">Dismiss</button>
          </div>
        </div>
      )}
    </div>
  );
}
