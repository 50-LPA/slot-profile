import { useMemo, useRef, useState } from 'react';
import { compute } from '../lib/calc.js';
import { demoStatement } from '../lib/demo.js';
import { fmtLongDate } from '../lib/format.js';
import { blankAccount, normalizeStatement, statementTitle } from '../lib/model.js';
import { validateAccount } from '../lib/validate.js';
import { downloadStatementPdf, saveBlob } from '../pdf/generate.jsx';
import AccountForm from './AccountForm.jsx';
import PdfPreview from './PdfPreview.jsx';
import SummaryBar from './SummaryBar.jsx';
import TransactionManager from './TransactionManager.jsx';
import TransactionSeeder from './TransactionSeeder.jsx';
import { Button, Card, CardHeader } from '../../ui.jsx';

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

  const fileRef = useRef(null);

  async function openJsonFile(file) {
    if (fileRef.current) fileRef.current.value = '';
    if (!file) return;
    try {
      if (file.size > 5_000_000) throw new Error('file is larger than 5 MB');
      const st = normalizeStatement(JSON.parse(await file.text()));
      if (!st) throw new Error('this is not a valid Statement Builder file');
      onChange({ ...statement, account: st.account, transactions: st.transactions });
      setNotice({ tone: 'ok', text: `Loaded statement for ${st.account.holderName || 'Untitled'} (${st.transactions.length} transactions).` });
    } catch (e) {
      setNotice({ tone: 'danger', text: `Could not load file: ${e.message}` });
    }
  }

  function saveFile() {
    const name = (a.holderName || 'statement').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    saveBlob(new Blob([JSON.stringify(statement, null, 2)], { type: 'application/json' }), `statement-${name}.json`);
  }

  function loadDemo() {
    if ((statement.transactions.length || a.holderName) && !window.confirm('Replace this statement’s details and transactions with demo data?')) return;
    const demo = demoStatement();
    onChange({ ...statement, account: demo.account, transactions: demo.transactions });
    setNotice({ tone: 'ok', text: 'Demo data loaded (fictional person, ~60 transactions).' });
  }

  function resetForm() {
    if (!window.confirm('Reset the form? All account details and transactions in this statement will be cleared.')) return;
    onChange({ ...statement, account: blankAccount(), transactions: [] });
    setShowAllErrors(false);
    setNotice({ tone: 'ok', text: 'Form reset.' });
  }

  const outCount = computed.outOfPeriodIds.size;
  const badCount = computed.invalidIds.size;
  const saveText = persistent
    ? savedAt ? `Saved in this browser · ${savedAt.toLocaleTimeString()}` : 'Everything saves automatically.'
    : 'Browser storage blocked — use “Save as file”.';

  return (
    <Card>
      <CardHeader
        onBack={onBack || (() => (window.location.hash = '#/statements'))}
        title={statementTitle(statement)}
        extra={<span className="text-xs text-gray-500 font-normal">{saveText}</span>}
        actions={
          <div className="flex flex-wrap items-center gap-1.5">
            <Button size="sm" variant="plain" onClick={loadDemo}>Load demo</Button>
            <Button size="sm" variant="plain" onClick={() => fileRef.current?.click()}>Load .json</Button>
            <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={e => openJsonFile(e.target.files[0])} />
            <Button size="sm" variant="plain" onClick={saveFile}>Save .json</Button>
            <Button size="sm" variant="danger" onClick={resetForm}>Reset</Button>
          </div>
        }
      />

      <div className="mt-4 grid items-start gap-6 lg:grid-cols-[minmax(400px,480px)_minmax(0,1fr)] xl:grid-cols-[minmax(440px,500px)_minmax(0,1fr)]">
        {/* Left Column: Form Editor */}
        <div className="editor space-y-4 min-w-0">
          <SummaryBar computed={computed} currency={a.currency} />

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

          <AccountForm account={a} errors={errors} showAllErrors={showAllErrors} onChange={setAccount} />
          <TransactionSeeder account={a} transactions={statement.transactions} onSeed={handleSeedReplace} onAppend={handleSeedAppend} />
          <TransactionManager statement={statement} onTransactions={setTransactions} onAccount={setAccount} onUpdateStatement={updateStatement} />
        </div>

        {/* Right Column: Sticky Live PDF Preview */}
        <div className="sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto rounded-xl border border-gray-200 bg-gray-50/50 p-3 shadow-inner min-w-0">
          <PdfPreview
            statement={statement}
            actions={
              <div className="preview-download-bar">
                <label className="preview-encrypt-check" title="Require password to open the downloaded PDF">
                  <input
                    type="checkbox"
                    checked={Boolean(a.encryptPdf)}
                    onChange={e => setAccount({ encryptPdf: e.target.checked })}
                  />
                  <span>🔒 Protect with password</span>
                </label>

                {a.encryptPdf ? (
                  <input
                    type="text"
                    className="preview-pass-input"
                    placeholder="Enter password..."
                    value={a.pdfPassword || ''}
                    onChange={e => setAccount({ pdfPassword: e.target.value })}
                    title="Password required to open the PDF"
                  />
                ) : null}

                <Button variant="primary" size="sm" onClick={downloadPdf} disabled={busy}>
                  {busy
                    ? (a.encryptPdf ? 'Encrypting…' : 'Generating…')
                    : (a.encryptPdf ? '🔒 Download Protected PDF' : 'Download PDF')}
                </Button>
              </div>
            }
          />
        </div>
      </div>
    </Card>
  );
}
