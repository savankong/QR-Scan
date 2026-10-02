import { useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { initials, type Profile } from '../lib/profile';

export function Section({
  title,
  description,
  children,
  flush = false,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  /** Render children directly instead of inside a grouped list. */
  flush?: boolean;
}) {
  return (
    <section className="section">
      <h2 className="section-title">{title}</h2>
      {flush ? children : <div className="group">{children}</div>}
      {description && <p className="section-note">{description}</p>}
    </section>
  );
}

type FieldProps = { label: string } & InputHTMLAttributes<HTMLInputElement>;

export function TextField({ label, ...input }: FieldProps) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} {...input} />
    </div>
  );
}

type AreaProps = { label: string } & TextareaHTMLAttributes<HTMLTextAreaElement>;

export function TextArea({ label, ...area }: AreaProps) {
  const id = useId();
  const left = area.maxLength ? area.maxLength - String(area.value ?? '').length : null;
  return (
    <div className="field field-stacked">
      <label htmlFor={id}>{label}</label>
      <textarea id={id} rows={3} {...area} />
      {left !== null && <span className="counter counter-area">{left}</span>}
    </div>
  );
}

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: SegmentOption<T>[];
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className={value === o.value ? 'is-active' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.icon}
          <span>{o.label}</span>
        </button>
      ))}
    </div>
  );
}

export function Toggle({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <label className={`row toggle-row${disabled ? ' is-disabled' : ''}`} htmlFor={id}>
      <span className="row-text">
        <span className="row-title">{label}</span>
        {description && <span className="row-sub">{description}</span>}
      </span>
      <input
        id={id}
        type="checkbox"
        role="switch"
        className="switch"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  format: (value: number) => string;
}) {
  const id = useId();
  return (
    <div className="row slider-row">
      <label htmlFor={id} className="row-title">
        {label}
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <output htmlFor={id} className="row-value">
        {format(value)}
      </output>
    </div>
  );
}

export function Avatar({ profile, size, className = '' }: { profile: Profile; size: number; className?: string }) {
  const text = initials(profile.name);
  return (
    <span className={`avatar ${className}`} style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {profile.photo ? (
        <img src={profile.photo} alt="" referrerPolicy="no-referrer" />
      ) : (
        <span aria-hidden="true">{text || '🙂'}</span>
      )}
    </span>
  );
}

export function Hint({ tone = 'info', children }: { tone?: 'info' | 'warn' | 'ok'; children: ReactNode }) {
  return <div className={`hint hint-${tone}`}>{children}</div>;
}
