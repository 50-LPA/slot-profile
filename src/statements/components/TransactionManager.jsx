import { useRef, useState } from 'react';
import { money, plainAmount, todayISO, toPaise } from '../lib/format.js';
import { blankTransaction, newId } from '../lib/model.js';
import { fillTransactionGaps, parseTransactionsFromJson } from '../lib/seeder.js';
import { validateTransaction } from '../lib/validate.js';
import { ICONS, Icon } from '../../icons.jsx';
import { Button, Card, CardHeader } from '../../ui.jsx';
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

  function handleAddEntry() {
    const newTx = { ...blankTransaction(lastDate()), description: 'UPI - Payment', amount: '100.00', type: 'debit' };
    onTransactions(list => [...list, newTx]);
    setMsg({ tone: 'ok', text: 'Added new transaction entry.' });
  }

  function handleRemoveLast() {
    if (txns.length === 0) return;
    const last = txns[txns.length - 1];
    onTransactions(list => list.slice(0, -1));
    setMsg({ tone: 'ok', text: `Removed transaction: “${last.description || 'Untitled'}”.` });
  }

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
        text: `Imported ${parsed.transactions.length} transactions from “${file.name}”. Click “Fill gaps with random” to generate daily expenses between salary payments.`,
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
        text: `Filled gaps: Generated ${res.addedCount} realistic daily transactions across empty dates. All existing transactions and salary credits were preserved with balanced positive savings.`,
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
    <Card className="mt-4">
      <CardHeader
        title={
          <div className="flex items-center gap-2">
            <span>Transactions</span>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
              {txns.length}
            </span>
          </div>
        }
        actions={
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <Button
              size="sm"
              variant="plain"
              icon={ICONS.plus}
              onClick={handleAddEntry}
              title="Add a new transaction entry manually"
              className="h-8 px-2 font-bold text-emerald-700 hover:bg-emerald-50"
            />
            <Button
              size="sm"
              variant="plain"
              icon={ICONS.minus}
              onClick={handleRemoveLast}
              disabled={txns.length === 0}
              title="Remove the last transaction entry"
              className="h-8 px-2 text-rose-700 hover:bg-rose-50 disabled:opacity-40"
            />
            <Button
              size="sm"
              variant="plain"
              icon={ICONS.import}
              onClick={() => fileInputRef.current?.click()}
              title="Import salary credits or transactions from a JSON file"
              className="h-8 px-2.5"
            >
              Import JSON
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              hidden
              onChange={handleJsonFile}
            />
            <Button
              size="sm"
              variant="plain"
              icon={ICONS.bolt}
              disabled={fillingGaps}
              onClick={handleFillGaps}
              title="Fill empty days between transactions with realistic daily random debits and credits"
              className="h-8 px-2.5"
            >
              {fillingGaps ? 'Filling…' : 'Fill gaps with random'}
            </Button>
          </div>
        }
      />

      <form ref={formRef} className="mt-4 group tx-form" onSubmit={submit} noValidate aria-label="Add transaction">
        <div className="st-form-grid tx-grid">
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
            <label htmlFor="tx-reference">Chq/Ref. No.</label>
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
            <div className="flex h-[34px] overflow-hidden rounded-md border border-gray-300 bg-white text-xs font-semibold" role="group" aria-labelledby="tx-type-label">
              <button
                type="button"
                className={`flex-1 flex items-center justify-center transition-colors cursor-pointer ${
                  draft.type === 'debit'
                    ? 'bg-rose-600 text-white font-bold shadow-xs'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
                onClick={() => set({ type: 'debit' })}
                aria-pressed={draft.type === 'debit'}
              >
                Debit
              </button>
              <div className="w-[1px] bg-gray-300" />
              <button
                type="button"
                className={`flex-1 flex items-center justify-center transition-colors cursor-pointer ${
                  draft.type === 'credit'
                    ? 'bg-emerald-600 text-white font-bold shadow-xs'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
                onClick={() => set({ type: 'credit' })}
                aria-pressed={draft.type === 'credit'}
              >
                Credit
              </button>
            </div>
          </div>
          <div className="field tx-actions">
            <Button type="submit" variant="primary" size="md" className="w-full">Add transaction</Button>
          </div>
        </div>
      </form>

      {msg && (
        <div className={`mt-3 alert ${msg.tone}`} role="status">
          <div className="alert-row">
            <span>{msg.text}</span>
            <button type="button" className="link" onClick={() => setMsg(null)} aria-label="Dismiss message">Dismiss</button>
          </div>
        </div>
      )}
    </Card>
  );
}
