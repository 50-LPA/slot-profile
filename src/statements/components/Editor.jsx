import { useMemo, useState } from 'react';
import { compute } from '../lib/calc.js';
import { demoStatement } from '../lib/demo.js';
import { blankAccount, statementTitle } from '../lib/model.js';
import { validateAccount } from '../lib/validate.js';
import { downloadStatementPdf } from '../pdf/generate.jsx';
import AccountForm from './AccountForm.jsx';
import PdfPreview from './PdfPreview.jsx';
import TransactionManager from './TransactionManager.jsx';
import TransactionSeeder from './TransactionSeeder.jsx';
import { Button, Card, CardHeader } from '../../ui.jsx';
import { Icon, ICONS } from '../../icons.jsx';

// Layout: responsive two-column grid inside Card. Left side scrolls naturally, right side PDF preview sticks to top.
export default function Editor({ statement, onChange, savedAt, persistent, onBack }) {
  const computed = useMemo(() => compute(statement), [statement]);
  const errors = useMemo(() => validateAccount(statement.account), [statement.account]);
  const errorCount = Object.keys(errors).length;
  const [showAllErrors, setShowAllErrors] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const a = statement.account;

  const setAccount = patch => onChange({ ...statement, account: { ...statement.account, ...patch } });
  const setTransactions = next =>
    onChange({ ...statement, transactions: typeof next === 'function' ? next(statement.transactions) : next });
  const updateStatement = patch => {
    const next = { ...statement };
    if (patch.account) next.account = { ...statement.account, ...patch.account };
    if (patch.transactions !== undefined) {
      next.transactions = typeof patch.transactions === 'function' ? patch.transactions(statement.transactions) : patch.transactions;
    }
    onChange(next);
  };

  function handleSeedReplace(txs, meta = {}) {
    if (!meta?.isFiller && statement.transactions.length > 0 && !window.confirm(`Replace all existing ${statement.transactions.length} transactions with ${txs.length} newly generated transactions?`)) {
      return;
    }
    setTransactions(txs);
    if (meta?.isFiller) {
      setNotice({
        tone: 'ok',
        text: `Generated ${meta.addedCount ?? (txs.length - statement.transactions.length)} daily filler transactions across empty dates. All existing transactions and salary credits were preserved.`,
      });
    } else {
      setNotice({ tone: 'ok', text: `Generated and loaded ${txs.length} transactions matching Indian store categories & monthly salary.` });
    }
  }

  function handleSeedAppend(txs) {
    setTransactions(list => [...list, ...txs]);
    setNotice({ tone: 'ok', text: `Appended ${txs.length} generated transactions.` });
  }

  async function downloadPdf() {
    if (errorCount) {
      setShowAllErrors(true);
      setNotice({ tone: 'danger', fields: true, text: `Fix ${errorCount} account field${errorCount > 1 ? 's' : ''} before downloading.` });
      setTimeout(() => document.querySelector('.editor [aria-invalid="true"]')?.focus(), 0); // focus scrolls it into view
      return;
    }
    if (a.encryptPdf && !a.pdfPassword?.trim()) {
      setNotice({ tone: 'danger', text: 'Please enter a password to encrypt the PDF before downloading.' });
      setTimeout(() => document.querySelector('#acc-pdfPassword, .preview-pass-input')?.focus(), 0);
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      await downloadStatementPdf(statement, {
        encrypted: Boolean(a.encryptPdf),
        password: a.pdfPassword,
      });
      if (a.encryptPdf) {
        setNotice({ tone: 'ok', text: `Downloaded password-protected PDF. Password: "${a.pdfPassword}".` });
      } else {
        setNotice({ tone: 'ok', text: 'Downloaded statement PDF.' });
      }
    } catch (e) {
      setNotice({ tone: 'danger', text: `PDF generation failed: ${e.message}` });
    } finally {
      setBusy(false);
    }
  }

  function loadDemo() {
    if ((statement.transactions.length || a.holderName) && !window.confirm('Replace this statement’s details and transactions with demo data?')) return;
    const demo = demoStatement();
    onChange({ ...statement, account: demo.account, transactions: demo.transactions });
    setNotice({ tone: 'ok', text: 'Demo data loaded (fictional person, ~60 transactions).' });
  }

  function resetForm() {
    if (!window.confirm('Clear the form? All account details and transactions in this statement will be cleared.')) return;
    onChange({ ...statement, account: blankAccount(), transactions: [] });
    setShowAllErrors(false);
    setNotice({ tone: 'ok', text: 'Form cleared.' });
  }

  const outCount = computed.outOfPeriodIds.size;
  const badCount = computed.invalidIds.size;
  const saveText = persistent
    ? savedAt ? `Saved in this browser · ${savedAt.toLocaleTimeString()}` : 'Everything saves automatically.'
    : 'Browser storage blocked — use “Save as file”.';

  return (
    <Card className="print:border-0 print:p-0 print:shadow-none">
      <CardHeader
        onBack={onBack || (() => (window.location.hash = '#/statements'))}
        title={statementTitle(statement)}
        actions={
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <span className="mr-1 text-xs text-gray-500 font-normal">{saveText}</span>
            <Button size="sm" variant="plain" onClick={loadDemo}>Load demo</Button>
            <Button size="sm" variant="danger" onClick={resetForm}>Clear</Button>
          </div>
        }
      />

      <div className="mt-4 grid items-start gap-6 lg:grid-cols-[minmax(400px,480px)_minmax(0,1fr)] xl:grid-cols-[minmax(440px,500px)_minmax(0,1fr)]">
        {/* Left Column: Form Editor */}
        <div className="editor space-y-4 min-w-0">
          {/* <SummaryBar computed={computed} currency={a.currency} /> */}

          {notice && !(notice.fields && errorCount === 0) && (
            <div className={`alert ${notice.tone}`} role="status">
              <div className="alert-row">
                <span>{notice.text}</span>
                <button type="button" className="link" onClick={() => setNotice(null)}>Dismiss</button>
              </div>
            </div>
          )}
          {(errorCount > 0 && showAllErrors) || outCount || badCount || computed.negativeCount ? (
            <ul className="warnings">
              {errorCount > 0 && showAllErrors && <li className="danger">{errorCount} account field{errorCount > 1 ? 's need' : ' needs'} attention. PDF download is blocked until fixed.</li>}
              {outCount > 0 && <li>{outCount} transaction{outCount > 1 ? 's are' : ' is'} dated outside the statement period and not shown on the statement.</li>}
              {badCount > 0 && <li className="danger">{badCount} transaction{badCount > 1 ? 's are' : ' is'} invalid and left out. Edit to fix.</li>}
              {computed.negativeCount > 0 && <li>The running balance goes below zero on {computed.negativeCount} transaction{computed.negativeCount > 1 ? 's' : ''}.</li>}
            </ul>
          ) : null}

          <AccountForm
            account={a}
            errors={errors}
            showAllErrors={showAllErrors}
            onChange={setAccount}
            onImportStatement={updateStatement}
            setNotice={setNotice}
          />
          <TransactionSeeder account={a} transactions={statement.transactions} onSeed={handleSeedReplace} onAppend={handleSeedAppend} />
          <TransactionManager statement={statement} onTransactions={setTransactions} onAccount={setAccount} onUpdateStatement={updateStatement} />
        </div>

        {/* Right Column: Sticky Live PDF Preview */}
        <div className="sticky top-4 min-w-0">
          <PdfPreview
            statement={statement}
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-semibold text-gray-700 shadow-2xs transition-colors hover:bg-gray-50 select-none whitespace-nowrap shrink-0">
                  <input
                    type="checkbox"
                    checked={Boolean(a.encryptPdf)}
                    onChange={e => setAccount({ encryptPdf: e.target.checked })}
                    className="h-4 w-4 shrink-0 rounded text-emerald-600 accent-emerald-600 cursor-pointer"
                  />
                  <Icon d={ICONS.lock} className="h-3.5 w-3.5 text-gray-500 shrink-0" />
                  <span>Protect with password</span>
                </label>

                {a.encryptPdf && (
                  <input
                    type="text"
                    className="h-8 w-32 sm:w-36 shrink-0 rounded-lg border border-gray-300 bg-white px-2.5 text-xs font-mono text-gray-800 placeholder-gray-400 shadow-2xs outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                    placeholder="Enter password..."
                    value={a.pdfPassword || ''}
                    onChange={e => setAccount({ pdfPassword: e.target.value })}
                    title="Password required to open the PDF"
                  />
                )}

                <Button
                  variant="primary"
                  size="md"
                  icon={a.encryptPdf ? ICONS.lock : ICONS.document}
                  onClick={downloadPdf}
                  disabled={busy}
                  className="whitespace-nowrap shrink-0"
                >
                  {busy
                    ? (a.encryptPdf ? 'Encrypting…' : 'Generating…')
                    : (a.encryptPdf ? 'Download Protected PDF' : 'Download PDF')}
                </Button>
              </div>
            }
          />
        </div>
      </div>
    </Card>
  );
}
