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
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const t = useT();
  useEffect(() => {
    const el = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    el?.showModal();
    return () => {
      el?.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className={wide ? 'wide' : ''}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-head">
        <div>
          <span className="eyebrow">TCO / DEMO</span>
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
export function Field({
  label,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const id = useId();
  return (
    <label className="field" htmlFor={id}>
      <span>{label}</span>
      <input id={id} {...props} />
    </label>
  );
}
export function Select({
  label,
  options,
  placeholder,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  options: readonly string[] | { value: string; label: string }[];
  placeholder?: string;
}) {
  const id = useId();
  const l = useLabel();
  return (
    <label className="field" htmlFor={id}>
      <span>{label}</span>
      <select id={id} {...props}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
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
  return (
    <button className="aircraft-card" onClick={onClick}>
      <AirlineLogo airline={a.airline} decorative />
      <span className="aircraft-content">
        <strong>{c.title}</strong>
        <span>
          {l(a.role) || t('Role not selected', '未選角色')} ·{' '}
          {a.variant || t('Type not selected', '未選機型')}
          {privacy.registration && a.registration ? ` (${a.registration})` : ''}
        </span>
        <span className="card-meta">
          {l(a.handling)} <span>·</span> {a.date || t('Undated', '未定日期')}{' '}
          {a.status !== 'Confirmed' && <Badge>{l(a.status)}</Badge>}
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
