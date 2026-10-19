import { useState } from 'react';
import { blockTimeParts, blockTimeValue } from '../domain/blockTime';
import { Field } from './ui';
import { useT } from '../i18n';

/** Draft input stays local; untouched historical timestamps retain their original bytes. */
export default function BlockTimeField({
  label,
  code,
  value,
  fallbackDate,
  onChange,
}: {
  label: string;
  code: string;
  value: string;
  fallbackDate: string;
  onChange: (value: string) => void;
}) {
  const t = useT();
  const [draft, setDraft] = useState<{ date: string; time: string } | null>(null);
  const saved = blockTimeParts(value);
  const parts = draft || { date: saved.date || fallbackDate, time: saved.time };
  function edit(part: Partial<typeof parts>) {
    const next = { ...parts, ...part };
    setDraft(next);
    const timestamp = blockTimeValue(next.date, next.time);
    if (!next.time) onChange('');
    else if (timestamp) onChange(timestamp);
    // An incomplete date/time stays in the form; save checks these native inputs.
  }
  return (
    <div className="block-time-field form-grid">
      <Field
        label={label}
        type="text"
        inputMode="numeric"
        data-block-clock="true"
        placeholder="HH:mm"
        pattern="(?:[01][0-9]|2[0-3]):[0-5][0-9]"
        maxLength={5}
        autoComplete="off"
        value={parts.time}
        onChange={(e) => {
          const text = e.target.value.trim().replaceAll('：', ':');
          edit({ time: /^\d{3,4}$/.test(text) ? `${text.slice(0, 2)}:${text.slice(2)}` : text });
        }}
      />
      <Field
        label={`${code} ${t('Date · Hong Kong', '日期 · 香港')}`}
        type="date"
        required={Boolean(parts.time)}
        aria-required={Boolean(parts.time)}
        value={parts.date}
        onChange={(e) => edit({ date: e.target.value })}
      />
      {value && !saved.date && (
        <p className="muted">
          {t(
            'The saved time cannot be displayed. It is retained until you edit or clear it.',
            '無法顯示已儲存的時間；修改或清除前會保留原值。',
          )}
        </p>
      )}
    </div>
  );
}
