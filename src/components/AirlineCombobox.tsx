import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import AirlineLogo from './AirlineLogo';
import { searchAirlines } from '../data/airlineCatalogue';
import { useT } from '../i18n';

/** Editable combobox: custom/historical text is never coerced into a catalogue option. */
export default function AirlineCombobox({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const t = useT(),
    id = useId(),
    input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false),
    [search, setSearch] = useState(false),
    [active, setActive] = useState(-1);
  const options = searchAirlines(search ? value : '');
  const activeId =
    open && active >= 0 && options[active] ? `${id}-${options[active].iata}` : undefined;
  useEffect(() => {
    if (activeId) document.getElementById(activeId)?.scrollIntoView?.({ block: 'nearest' });
  }, [activeId]);
  const choose = (name: string) => {
    onChange(name);
    setOpen(false);
    setSearch(false);
    setActive(-1);
    input.current?.focus();
  };
  return (
    <div
      className="airline-combobox"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
    >
      <label className="field" htmlFor={id}>
        <span>{t('Airline *', '航空公司 *')}</span>
      </label>
      <div className="airline-combobox-field">
        {value && <AirlineLogo airline={value} size="sm" decorative />}
        <input
          ref={input}
          id={id}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          aria-activedescendant={activeId}
          aria-describedby={`${id}-hint`}
          autoComplete="off"
          value={value}
          placeholder={t('Search airline name or code', '搜尋航空公司名稱或代碼')}
          onClick={() => {
            setSearch(false);
            setActive(-1);
            setOpen(true);
          }}
          onChange={(e) => {
            onChange(e.target.value);
            setSearch(true);
            setActive(-1);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault();
              setOpen(true);
              const next = options.length
                ? active < 0
                  ? e.key === 'ArrowDown'
                    ? 0
                    : options.length - 1
                  : (active + (e.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length
                : -1;
              setActive(next);
            } else if (e.key === 'Enter' && open) {
              e.preventDefault();
              if (active >= 0 && options[active]) choose(options[active].name);
              else setOpen(false);
            } else if (e.key === 'Escape' && open) {
              e.preventDefault();
              e.stopPropagation();
              setOpen(false);
            } else if (e.key === 'Tab') setOpen(false);
          }}
        />
        <button
          type="button"
          aria-label={t('Show airline options', '顯示航空公司選項')}
          aria-expanded={open}
          aria-controls={`${id}-list`}
          onClick={() => {
            setSearch(false);
            setActive(-1);
            setOpen(!open);
            input.current?.focus();
          }}
        >
          <ChevronDown size={18} />
        </button>
        {open && (
          <div
            id={`${id}-list`}
            role="listbox"
            aria-label={t('Airlines', '航空公司')}
            className="airline-options"
          >
            {options.map((a, i) => (
              <div
                key={a.iata}
                id={`${id}-${a.iata}`}
                role="option"
                aria-label={`${a.name} ${a.iata}`}
                aria-selected={value === a.name}
                className={`airline-option ${active === i ? 'highlighted' : ''}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(a.name)}
              >
                <AirlineLogo airline={a.name} decorative />
                <span>{a.name}</span>
                <strong>{a.iata}</strong>
              </div>
            ))}
            {!options.length && (
              <p role="status">
                {t(
                  'No catalogue match. Custom text is kept.',
                  '清單沒有符合項目，將保留自訂名稱。',
                )}
              </p>
            )}
          </div>
        )}
      </div>
      <small id={`${id}-hint`} className="muted">
        {t(
          'Search by name/code, or enter a custom airline. Arrow keys select; Enter confirms.',
          '按名稱／代碼搜尋，亦可輸入自訂航空公司。方向鍵選擇，Enter 確認。',
        )}
      </small>
    </div>
  );
}
