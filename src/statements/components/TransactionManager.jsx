import { useRef, useState } from 'react';
import { isISODate, money, plainAmount, todayISO, toPaise } from '../lib/format.js';
import { newId } from '../lib/model.js';
import { fillTransactionGaps, parseTransactionsFromJson } from '../lib/seeder.js';
import { ICONS, Icon } from '../../icons.jsx';
import { Button, Card } from '../../ui.jsx';
import DatePicker from './DatePicker.jsx';

export default function TransactionManager({ statement, onTransactions, onAccount, onUpdateStatement }) {
  const txns = statement.transactions || [];
  const cur = statement.account?.currency || 'INR';
  const m = p => money(p, cur);

  const [msg, setMsg] = useState(null);
  const [fillingGaps, setFillingGaps] = useState(false);
  const fileInputRef = useRef(null);

  // Appends a new empty transaction form at the end of the ledger
  function handleAddTransaction() {
    let nextDate = statement.account?.periodStart || todayISO();
    if (txns.length > 0) {
      const last = txns[txns.length - 1];
      if (last.date && isISODate(last.date)) {
        const [y, mo, d] = last.date.split('-').map(Number);
        if (y && mo && d) {
          const nextM = mo === 12 ? 1 : mo + 1;
          const nextY = mo === 12 ? y + 1 : y;
          const lastDay = new Date(nextY, nextM, 0).getDate();
          const targetDay = Math.min(d, lastDay);
          nextDate = `${nextY}-${String(nextM).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;
        } else {
          nextDate = last.date;
        }
      } else if (last.date) {
        nextDate = last.date;
      }
    }

    const newTx = {
      id: newId(),
      date: nextDate,
      valueDate: '',
      description: 'Salary credit - ' + (statement.account?.holderName ? 'Employer Pvt Ltd' : 'Tech Corp Pvt Ltd'),
      reference: '',
      amount: '',
      type: 'credit',
    };

    onTransactions(list => [...list, newTx]);
    setMsg({ tone: 'ok', text: `Created transaction #${txns.length + 1}.` });
  }

  // Inserts a new empty transaction form in between existing records at targetIndex
  function handleInsertAt(targetIndex) {
    let baseDate = statement.account?.periodStart || todayISO();
    if (targetIndex > 0 && txns[targetIndex - 1]?.date) {
      baseDate = txns[targetIndex - 1].date;
    } else if (targetIndex < txns.length && txns[targetIndex]?.date) {
      baseDate = txns[targetIndex].date;
    }

    const newTx = {
      id: newId(),
      date: baseDate,
      valueDate: '',
      description: 'Salary credit',
      reference: '',
      amount: '',
      type: 'credit',
    };

    onTransactions(list => [
      ...list.slice(0, targetIndex),
      newTx,
      ...list.slice(targetIndex),
    ]);
    setMsg({ tone: 'ok', text: `Inserted empty transaction at position #${targetIndex + 1}.` });
  }

  // Removes a transaction record at targetIndex
  function handleRemove(targetIndex) {
    const removed = txns[targetIndex];
    onTransactions(list => list.filter((_, idx) => idx !== targetIndex));
    setMsg({
      tone: 'ok',
      text: `Removed transaction #${targetIndex + 1}${removed?.description ? ` (${removed.description})` : ''}.`,
    });
  }

  // Live in-place field updater for any transaction
  function updateField(index, key, val) {
    onTransactions(list =>
      list.map((t, idx) => (idx === index ? { ...t, [key]: val } : t))
    );
  }

  // Formats amount to standard two-decimal paise representation on blur
  function handleAmountBlur(index, rawVal) {
    const p = toPaise(rawVal);
    if (!isNaN(p) && p > 0) {
      updateField(index, 'amount', plainAmount(p));
    }
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

  return (
    <Card className="mt-4">
      {/* Top Header & Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold text-gray-900">Transactions</h2>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
            {txns.length}
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <Button
            size="sm"
            variant="plain"
            icon={ICONS.plus}
            onClick={handleAddTransaction}
            title="Add a new transaction form"
            className="h-8 px-2.5 font-bold text-emerald-700 hover:bg-emerald-50"
          >
            + Add transaction
          </Button>
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
      </div>

      {/* Transactions Multi-Record Form List */}
      <div className="mt-4">
        {txns.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50/50 p-6 text-center">
            <p className="text-xs text-gray-500 mb-3">No transactions added yet.</p>
            <Button
              type="button"
              size="sm"
              variant="primary"
              icon={ICONS.plus}
              onClick={handleAddTransaction}
            >
              + Add first transaction
            </Button>
          </div>
        ) : (
          <div className="space-y-3.5 max-h-[720px] overflow-y-auto pr-1">
            {txns.map((tx, idx) => (
              <div
                key={tx.id || idx}
                className="relative rounded-xl border border-gray-200 bg-gray-50/60 p-3.5 transition-all hover:border-gray-300 hover:bg-white shadow-2xs"
              >
                {/* Form Card Header */}
                <div className="flex flex-wrap items-center justify-between gap-1.5 mb-2.5 border-b border-gray-200/70 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                      Transaction #{idx + 1}
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        tx.type === 'credit'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {tx.type || 'credit'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="plain"
                      onClick={() => handleInsertAt(idx)}
                      title="Insert empty transaction above"
                      className="h-6 px-1.5 text-[11px] text-gray-600 hover:text-emerald-700 hover:bg-emerald-50"
                    >
                      + Insert above
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="plain"
                      onClick={() => handleInsertAt(idx + 1)}
                      title="Insert empty transaction below"
                      className="h-6 px-1.5 text-[11px] text-gray-600 hover:text-emerald-700 hover:bg-emerald-50"
                    >
                      + Insert below
                    </Button>
                    <button
                      type="button"
                      onClick={() => handleRemove(idx)}
                      title="Remove this transaction"
                      className="inline-flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer transition-colors ml-0.5"
                      aria-label={`Remove transaction ${idx + 1}`}
                    >
                      <Icon d={ICONS.trash} className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Form Grid */}
                <div className="st-form-grid">
                  <div className="field">
                    <label htmlFor={`tx-${tx.id || idx}-date`}>
                      Transaction date <span className="req">*</span>
                    </label>
                    <DatePicker
                      id={`tx-${tx.id || idx}-date`}
                      value={tx.date}
                      onChange={val => updateField(idx, 'date', val)}
                      placeholder="dd-mmm-yyyy"
                      required
                    />
                  </div>
                  <div className="field">
                    <label htmlFor={`tx-${tx.id || idx}-valueDate`}>Value date</label>
                    <DatePicker
                      id={`tx-${tx.id || idx}-valueDate`}
                      value={tx.valueDate}
                      onChange={val => updateField(idx, 'valueDate', val)}
                      placeholder="Blank = same as date"
                    />
                  </div>
                  <div className="field full">
                    <label htmlFor={`tx-${tx.id || idx}-desc`}>
                      Description <span className="req">*</span>
                    </label>
                    <input
                      id={`tx-${tx.id || idx}-desc`}
                      type="text"
                      maxLength={160}
                      value={tx.description || ''}
                      onChange={e => updateField(idx, 'description', e.target.value)}
                      placeholder="e.g. Salary credit - Demo Technologies Pvt Ltd"
                    />
                  </div>
                  <div className="field">
                    <label htmlFor={`tx-${tx.id || idx}-ref`}>Chq/Ref. No.</label>
                    <input
                      id={`tx-${tx.id || idx}-ref`}
                      type="text"
                      maxLength={30}
                      value={tx.reference || ''}
                      onChange={e => updateField(idx, 'reference', e.target.value)}
                      placeholder="Demo reference"
                    />
                  </div>
                  <div className="field">
                    <label htmlFor={`tx-${tx.id || idx}-amt`}>
                      Amount ({cur}) <span className="req">*</span>
                    </label>
                    <input
                      id={`tx-${tx.id || idx}-amt`}
                      type="text"
                      inputMode="decimal"
                      value={tx.amount || ''}
                      onChange={e => updateField(idx, 'amount', e.target.value)}
                      onBlur={e => handleAmountBlur(idx, e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>
            ))}

            <Button
              type="button"
              variant="primary"
              size="md"
              icon={ICONS.plus}
              onClick={handleAddTransaction}
              className="w-full mt-3 font-semibold"
            >
              + Add next transaction
            </Button>
          </div>
        )}
      </div>

      {/* Informational / Status Notice */}
      {msg && (
        <div className={`mt-3 alert ${msg.tone}`} role="status">
          <div className="alert-row">
            <span>{msg.text}</span>
            <button
              type="button"
              className="link"
              onClick={() => setMsg(null)}
              aria-label="Dismiss message"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}
