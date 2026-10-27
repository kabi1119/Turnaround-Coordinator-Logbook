import { useEffect, useRef, useId } from 'react';
import type {
  ReactNode,
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { X, ArrowUpRight, Plane, ChevronRight } from 'lucide-react';
import AirlineLogo from './AirlineLogo';
import { useLabel, useT } from '../i18n';
import type { Aircraft, Privacy } from '../domain/model';
import { cardText, hasArrival, hasDeparture } from '../domain/selectors';
import { aircraftTimes } from '../domain/time';
import { handlingDisplayStatus, untitledDraft } from '../domain/handlingForm';
import { modalScrollArea } from '../lib/modalInteraction';
import { useModalViewport } from '../lib/useModalViewport';
let openModals = 0;
let previousOverflow = '';
export function Modal({
  title,
  children,
  onClose,
  wide = false,
  sheet = false,
  closing = false,
  upperKeyboardFocus = false,
  syncControl = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  sheet?: boolean;
  closing?: boolean;
  upperKeyboardFocus?: boolean;
  syncControl?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const t = useT();
  useEffect(() => {
    const el = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    const parent = previous?.closest('dialog');
    const parentArea = parent ? modalScrollArea(parent) : null;
    const parentScroll = parentArea?.scrollTop;
    if (openModals++ === 0) {
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      document.documentElement.classList.add('modal-open');
    }
    el?.showModal();
    return () => {
      el?.close();
      if (--openModals === 0) {
        document.body.style.overflow = previousOverflow;
        document.documentElement.classList.remove('modal-open');
      }
      if (previous?.isConnected) previous.focus({ preventScroll: true });
      if (parentArea && parentScroll !== undefined) parentArea.scrollTop = parentScroll;
    };
  }, []);
  useModalViewport(ref);
  return (
    <dialog
      ref={ref}
      data-sync-control={syncControl || undefined}
      data-upper-keyboard-focus={upperKeyboardFocus || undefined}
      aria-labelledby={titleId}
      inert={closing}
      className={`${wide ? 'wide' : ''} ${sheet ? 'duty-sheet' : ''} ${closing ? 'closing' : ''}`}
      onCancel={(e) => {
        e.preventDefault();
        if (!closing) onClose();
      }}
      onClick={(e) => {
        if (!closing && e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-head">
        <div>
          <span className="eyebrow">TCO Logbook</span>
          <h2 id={titleId}>{title}</h2>
        </div>
        <button className="icon-button" aria-label={t('Close', '關閉')} onClick={onClose}>
          <X size={21} />
        </button>
      </div>
      <div className="modal-body">{children}</div>
    </dialog>
  );
}
export function RequiredLabel({ label }: { label: string }) {
  return label.endsWith(' *') ? (
    <>
      {label.slice(0, -1)}
      <span className="required-marker">*</span>
    </>
  ) : (
    <>{label}</>
  );
}
export function Field({
  label,
  error,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  const id = useId();
  return (
    <label className="field" htmlFor={id}>
      <span id={`${id}-label`}>
        <RequiredLabel label={label} />
      </span>
      <input
        id={id}
        aria-labelledby={`${id}-label`}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        aria-required={label.endsWith(' *')}
        {...props}
      />
      {error && (
        <small id={`${id}-error`} className="field-error">
          {error}
        </small>
      )}
    </label>
  );
}
export function Select({
  label,
  error,
  options,
  placeholder,
  placeholderDisabled = false,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  error?: string;
  options: readonly string[] | { value: string; label: string }[];
  placeholder?: string;
  placeholderDisabled?: boolean;
}) {
  const id = useId();
  const l = useLabel();
  return (
    <label className="field" htmlFor={id}>
      <span id={`${id}-label`}>
        <RequiredLabel label={label} />
      </span>
      <select
        id={id}
        aria-labelledby={`${id}-label`}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        aria-required={label.endsWith(' *')}
        {...props}
      >
        {placeholder !== undefined && (
          <option value="" disabled={placeholderDisabled}>
            {placeholder}
          </option>
        )}
        {options.map((o) =>
          typeof o === 'string' ? (
            <option key={o} value={o}>
              {l(o)}
            </option>
          ) : (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ),
        )}
      </select>
      {error && (
        <small id={`${id}-error`} className="field-error">
          {error}
        </small>
      )}
    </label>
  );
}
export function TextArea({
  label,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  const id = useId();
  return (
    <label className="field" htmlFor={id}>
      <span>{label}</span>
      <textarea id={id} rows={3} {...props} />
    </label>
  );
}
export function Badge({ children, tone = '' }: { children: ReactNode; tone?: string }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function Empty({ text }: { text: string }) {
  return (
    <div className="empty">
      <Plane size={28} />
      <p>{text}</p>
    </div>
  );
}
export function SectionTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-title">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
export function AircraftCard({
  a,
  privacy,
  onClick,
}: {
  a: Aircraft;
  privacy: Privacy;
  onClick: () => void;
}) {
  const c = cardText(a, privacy);
  const t = useT();
  const l = useLabel();
  const times = aircraftTimes(a, privacy);
  return (
    <button className="aircraft-card" onClick={onClick}>
      <AirlineLogo airline={a.airline} decorative />
      <span className="aircraft-content">
        <strong>{untitledDraft(a) ? t('Untitled Draft', '未命名草稿') : c.title}</strong>
        <span>
          {l(a.role) || t('Role not selected', '未選角色')} ·{' '}
          {a.variant || t('Type not selected', '未選機型')}
          {privacy.registration && a.registration ? ` (${a.registration})` : ''}
        </span>
        <span className="aircraft-times">
          {!privacy.gateTimes
            ? t('Times hidden by privacy settings', '時間已按私隱設定隱藏')
            : times.length
              ? times
                  .map(
                    (time) =>
                      `${time.scheduled ? t('Scheduled ', '表定 ') : ''}${time.label} ${time.value}`,
                  )
                  .join(' · ') + ' HKT'
              : t('Time not recorded', '未記錄時間')}
          {privacy.bay && a.bay ? ` · ${t('Bay', '停機位')} ${a.bay}` : ''}
        </span>
        <span className="card-meta">
          {l(a.handling)} <span>·</span> {a.date || t('Undated', '未定日期')}{' '}
          {a.status !== 'Confirmed' && <Badge>{l(handlingDisplayStatus(a))}</Badge>}
          {!a.dutyId && <Badge tone="amber">{t('Unlinked', '未連結')}</Badge>}
        </span>
        {privacy.statuses && (
          <span className="leg-line">
            {hasArrival(a) && `ARR ${l(a.arrival.status)}`}
            {hasArrival(a) && hasDeparture(a) && ' · '}
            {hasDeparture(a) && `DEP ${l(a.departure.status)}`}
          </span>
        )}
      </span>
      <ChevronRight size={18} />
    </button>
  );
}
export function Metric({ value, label, detail }: { value: number; label: string; detail: string }) {
  return (
    <div className="metric">
      <span className="metric-label">{label}</span>
      <div>
        <strong>{String(value).padStart(2, '0')}</strong>
        <ArrowUpRight size={22} />
      </div>
      <small>{detail}</small>
    </div>
  );
}
export function Confirm({
  title,
  children,
  onClose,
  onConfirm,
  confirmLabel,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  onConfirm: () => void;
  confirmLabel?: string;
}) {
  const t = useT();
  return (
    <Modal title={title} onClose={onClose}>
      {children}
      <div className="actions">
        <button onClick={onClose}>{t('Cancel', '取消')}</button>
        <button className="primary" onClick={onConfirm}>
          {confirmLabel || t('Confirm', '確認')}
        </button>
      </div>
    </Modal>
  );
}
