import { useId, useRef, useState, useEffect } from 'react';
import type { Duty } from '../domain/model';
import { useT, useLabel } from '../i18n';
import { dutyOptionText } from '../domain/roster';

/** Wrapping listbox: native mobile select popups cannot reliably wrap long duty labels. */
export default function DutyPicker({
  duties,
  value,
  onChange,
}: {
  duties: Duty[];
  value: string;
  onChange: (value: string) => void;
}) {
  const t = useT(),
    l = useLabel(),
    uid = useId(),
    ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false),
    [active, setActive] = useState(0);
  const options = [
    { id: '', text: t('No linked Duty', '不連結更次') },
    ...duties
      .filter((d) => d.status !== 'Trashed' || d.id === value)
      .sort(
        (a, b) =>
          b.date.localeCompare(a.date) ||
          b.start.localeCompare(a.start) ||
          a.id.localeCompare(b.id),
      )
      .map((d) => ({ id: d.id, text: dutyOptionText(d, l) })),
  ];
  const select = (index: number) => {
    onChange(options[index].id);
    setOpen(false);
  };
  useEffect(() => {
    if (open) document.getElementById(`${uid}-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active, uid]);
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);
  return (
    <div className="duty-picker field" ref={ref}>
      <span id={`${uid}-label`}>{t('Duty / Shift', '所屬更次')}</span>
      <button
        type="button"
        role="combobox"
        aria-labelledby={`${uid}-label`}
        aria-describedby={`${uid}-help`}
        aria-expanded={open}
        aria-controls={`${uid}-options`}
        aria-haspopup="listbox"
        aria-activedescendant={open ? `${uid}-${active}` : undefined}
        onClick={() => {
          setActive(
            Math.max(
              0,
              options.findIndex((o) => o.id === value),
            ),
          );
          setOpen(!open);
        }}
        onBlur={(e) => {
          if (!e.currentTarget.parentElement?.contains(e.relatedTarget)) setOpen(false);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            setOpen(true);
            setActive(
              (i) => (i + (e.key === 'ArrowDown' ? 1 : options.length - 1)) % options.length,
            );
          } else if (e.key === 'Enter' && open) {
            e.preventDefault();
            select(active);
          } else if (e.key === 'Escape' && open) {
            e.preventDefault();
            e.stopPropagation();
            setOpen(false);
          } else if (e.key === 'Home' && open) {
            e.preventDefault();
            setActive(0);
          } else if (e.key === 'End' && open) {
            e.preventDefault();
            setActive(options.length - 1);
          } else if (e.key === 'Tab') setOpen(false);
        }}
      >
        {options.find((o) => o.id === value)?.text || t('No linked Duty', '不連結更次')}
      </button>
      {open && (
        <div
          id={`${uid}-options`}
          role="listbox"
          aria-labelledby={`${uid}-label`}
          className="duty-options"
        >
          {options.map((o, i) => (
            <div
              key={o.id}
              id={`${uid}-${i}`}
              role="option"
              aria-selected={o.id === value}
              className={active === i ? 'highlighted' : ''}
              onPointerDown={(e) => e.preventDefault()}
              onMouseMove={() => setActive(i)}
              onClick={() => select(i)}
            >
              {o.text}
            </div>
          ))}
        </div>
      )}
      <small id={`${uid}-help`}>
        {t(
          'No duty recorded? Add it using Add Duty, then link it here.',
          '尚未建立更次？請先使用「Add Duty」新增，再返回此處關聯。',
        )}
      </small>
      {duties.some((d) => !d.workState) && (
        <small>
          {t(
            'Historical duties without work state remain unclassified; counting rules are unchanged.',
            '歷史更次缺少工作進度時不會推斷分類；統計規則維持不變。',
          )}
        </small>
      )}
    </div>
  );
}
