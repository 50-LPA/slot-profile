import { useState } from 'react';
import { CURRENCIES } from '../lib/format.js';
import { ACCOUNT_STATUSES, ACCOUNT_TYPES, BANK_OPTIONS, NOMINATION_OPTIONS, TITLES } from '../lib/model.js';
import DatePicker from './DatePicker.jsx';

const getGroups = account => [
  {
    title: 'Bank & Account',
    fields: [
      { k: 'bank', label: 'Bank Name', select: BANK_OPTIONS, required: true },
      { k: 'accountNumber', label: 'Account number', required: true, inputMode: 'numeric', placeholder: 'e.g. 00001234567890', hint: 'Use a demo number.' },
      { k: 'accountType', label: 'Account type', datalist: ACCOUNT_TYPES, placeholder: 'Savings / Current' },
      { k: 'branch', label: 'Branch', placeholder: 'e.g. Baner, Pune' },
      { k: 'accountStatus', label: 'Account status', datalist: ACCOUNT_STATUSES, placeholder: 'Active / Dormant' },
      { k: 'nomination', label: 'Nominee registered', datalist: NOMINATION_OPTIONS, placeholder: 'Yes / No' },
      { k: 'currency', label: 'Currency', select: CURRENCIES },
    ],
  },
  {
    title: 'Customer',
    fields: [
      { k: 'title', label: 'Title', datalist: TITLES, placeholder: 'Mr / Ms / Dr' },
      { k: 'holderName', label: 'Customer name', required: true, placeholder: 'Full name' },
      { k: 'customerId', label: account.bank === 'HDFC Bank' ? 'Customer ID' : 'CRN', placeholder: 'e.g. 104582731', hint: 'Demo value' },
      { k: 'address', label: 'Residential address', textarea: true, full: true, placeholder: 'House / street, area' },
      { k: 'city', label: 'City', placeholder: 'e.g. Pune' },
      { k: 'pinCode', label: 'PIN code', inputMode: 'numeric', placeholder: '6 digits' },
      { k: 'state', label: 'State', placeholder: 'e.g. Maharashtra' },
      { k: 'country', label: 'Country', placeholder: 'e.g. India' },
      { k: 'micr', label: 'MICR', inputMode: 'numeric', placeholder: '9 digits', hint: 'Demo value' },
      { k: 'ifsc', label: 'IFSC code', upper: true, placeholder: 'DEMO0000123', hint: 'Demo value' },
    ],
  },
  {
    title: 'Statement period & opening balance',
    fields: [
      { k: 'periodStart', label: 'Start date', date: true, required: true, placeholder: 'dd-mmm-yyyy' },
      { k: 'periodEnd', label: 'End date', date: true, required: true, placeholder: 'dd-mmm-yyyy' },
      { k: 'openingBalance', label: 'Opening balance', required: true, inputMode: 'decimal', placeholder: '0.00', hint: 'Balance at the start of the period. Can be negative for an overdraft.' },
    ],
  },
  {
    title: 'PDF Security & Password Protection',
    fields: [
      {
        k: 'encryptPdf',
        label: 'Password Protect PDF',
        type: 'checkbox',
        hint: 'When enabled, the downloaded PDF will be encrypted with AES-256 and will require a password to open.',
        full: true,
      },
      ...(account.encryptPdf ? [
        {
          k: 'pdfPassword',
          label: 'PDF Password',
          placeholder: 'Enter password (e.g. DDMMYYYY, PAN, or custom)',
          hint: 'This exact password will be required to open the PDF.',
          full: true,
        },
      ] : []),
    ],
  },
];

export default function AccountForm({ account, errors, showAllErrors, onChange }) {
  const [touched, setTouched] = useState({});
  const touch = k => setTouched(t => (t[k] ? t : { ...t, [k]: true }));

  const groups = getGroups(account);

  return (
    <form className="panel" noValidate onSubmit={e => e.preventDefault()} aria-label="Account details">
      {groups.map(group => (
        <fieldset key={group.title} className="group">
          <legend>{group.title}</legend>
          <div className="grid">
            {group.fields.map(f => {
              const id = `acc-${f.k}`;
              const err = (touched[f.k] || showAllErrors) && errors[f.k];
              const common = {
                id,
                name: f.k,
                value: account[f.k] ?? '',
                onBlur: () => touch(f.k),
                onChange: e => onChange({ [f.k]: f.upper ? e.target.value.toUpperCase() : e.target.value }),
                'aria-invalid': err ? 'true' : undefined,
                'aria-describedby': err || f.hint ? `${id}-msg` : undefined,
                required: f.required,
                placeholder: f.placeholder,
              };
              return (
                <div className={`field ${f.full ? 'full' : ''}`} key={f.k}>
                  {f.type === 'checkbox' ? (
                    <label className="checkbox-label" style={{ marginTop: 6, fontWeight: 500 }}>
                      <input
                        type="checkbox"
                        id={id}
                        name={f.k}
                        checked={Boolean(account[f.k])}
                        onChange={e => onChange({ [f.k]: e.target.checked })}
                      />
                      <span>{f.label}</span>
                    </label>
                  ) : (
                    <>
                      <label htmlFor={id}>
                        {f.label}
                        {f.required && <span className="req" aria-hidden="true"> *</span>}
                      </label>
                      {f.textarea ? (
                        <textarea rows={2} {...common} />
                      ) : f.select ? (
                        <select {...common}>
                          {f.select.map(o => <option key={o}>{o}</option>)}
                        </select>
                      ) : f.date ? (
                        <DatePicker
                          id={id}
                          name={f.k}
                          value={account[f.k]}
                          onChange={val => onChange({ [f.k]: val })}
                          onBlur={() => touch(f.k)}
                          required={f.required}
                          placeholder={f.placeholder}
                          aria-invalid={err ? 'true' : undefined}
                          aria-describedby={err || f.hint ? `${id}-msg` : undefined}
                        />
                      ) : (
                        <input
                          type={f.type || 'text'}
                          inputMode={f.inputMode}
                          autoComplete={f.autoComplete || 'off'}
                          list={f.datalist ? `${id}-list` : undefined}
                          {...common}
                        />
                      )}
                    </>
                  )}
                  {f.datalist && (
                    <datalist id={`${id}-list`}>
                      {f.datalist.map(o => <option key={o} value={o} />)}
                    </datalist>
                  )}
                  {(err || f.hint) && (
                    <small id={`${id}-msg`} className={err ? 'error' : 'hint'}>
                      {err || f.hint}
                    </small>
                  )}
                </div>
              );
            })}
          </div>
        </fieldset>
      ))}
    </form>
  );
}
