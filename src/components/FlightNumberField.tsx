import { useId } from 'react';
import { flightEntry, flightInput, flightPrefix } from '../domain/handlingForm';
import { RequiredLabel } from './ui';
import { useT } from '../i18n';

export default function FlightNumberField({
  airline,
  value,
  onChange,
  label,
  error,
  name,
}: {
  airline: string;
  value: string;
  onChange: (value: string) => void;
  label: string;
  error?: string;
  name: string;
}) {
  const id = useId(),
    t = useT(),
    prefix = flightPrefix(airline),
    parsed = flightInput(airline, value);
  return (
    <label className="field" htmlFor={id}>
      <span id={`${id}-label`}>
        <RequiredLabel label={label} />
      </span>
      <span className="flight-number-input">
        {prefix && (
          <span className="flight-prefix" aria-hidden="true">
            {prefix}
          </span>
        )}
        <input
          id={id}
          aria-labelledby={`${id}-label`}
          name={name}
          value={parsed.input}
          onChange={(e) => onChange(flightEntry(airline, e.target.value))}
          autoCapitalize="characters"
          autoComplete="off"
          inputMode="text"
          enterKeyHint="next"
          spellCheck={false}
          aria-required="true"
          aria-invalid={Boolean(error)}
          aria-describedby={`${id}-hint${error ? ` ${id}-error` : ''}`}
        />
      </span>
      <small id={`${id}-hint`} className="muted">
        {prefix
          ? t(
              `Fixed prefix ${prefix}. Enter 1–4 digits and an optional letter.`,
              `固定前綴 ${prefix}。輸入 1–4 位數字及可選字母尾碼。`,
            )
          : t(
              'No catalogue IATA code. Enter the full flight number (two-character code, 1–4 digits, optional letter).',
              '沒有清單 IATA 代碼。請輸入完整航班編號（兩位代碼、1–4 位數字及可選字母尾碼）。',
            )}
        {value && !parsed.valid && (
          <span className="field-error">
            {t(
              'Unrecognized or conflicting value retained. Correct it before confirming; Save Draft preserves it.',
              '已保留未識別或前綴不符的原值；確認前請修正，儲存草稿可保留原值。',
            )}
          </span>
        )}
      </small>
      {error && (
        <small id={`${id}-error`} className="field-error">
          {error}
        </small>
      )}
    </label>
  );
}
