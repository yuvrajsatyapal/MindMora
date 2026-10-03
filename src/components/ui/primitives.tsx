"use client";
import {
  useId,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { AlertCircle, Info, LoaderCircle, type LucideIcon } from "lucide-react";

export type Tone = "success" | "warning" | "danger" | "info" | "accent";
export function Icon({
  icon: Glyph,
  size = "md",
}: {
  icon: LucideIcon;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <Glyph
      className="mm-icon"
      data-size={size}
      strokeWidth={1.75}
      aria-hidden="true"
    />
  );
}
export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  loading?: boolean;
  size?: "default" | "icon";
};
export function Button({
  variant = "primary",
  loading = false,
  disabled,
  size = "default",
  children,
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={`mm-button ${className}`}
      data-variant={variant}
      data-size={size}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {loading && <Icon icon={LoaderCircle} />}
      {children}
    </button>
  );
}
export function IconButton({
  label,
  icon,
  ...props
}: Omit<ButtonProps, "children" | "size" | "aria-label"> & {
  label: string;
  icon: LucideIcon;
}) {
  return (
    <Button {...props} size="icon" aria-label={label}>
      <Icon icon={icon} />
    </Button>
  );
}

type FieldInfo = { label: string; hint?: string; error?: string };
function FieldFrame({
  id,
  label,
  hint,
  error,
  children,
}: FieldInfo & { id: string; children: ReactNode }) {
  return (
    <div className="mm-field">
      <label className="mm-label" htmlFor={id}>
        {label}
      </label>
      {children}
      {(error || hint) && (
        <p id={`${id}-description`} className={error ? "mm-error" : "mm-muted"}>
          {error || hint}
        </p>
      )}
    </div>
  );
}
export function TextField({
  label,
  hint,
  error,
  id: explicitId,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & FieldInfo) {
  const generated = useId();
  const id = explicitId || generated;
  return (
    <FieldFrame {...{ id, label, hint, error }}>
      <input
        {...props}
        id={id}
        className="mm-input"
        aria-invalid={error ? true : props["aria-invalid"]}
        aria-describedby={
          [props["aria-describedby"], (hint || error) && `${id}-description`]
            .filter(Boolean)
            .join(" ") || undefined
        }
      />
    </FieldFrame>
  );
}
export function TextArea({
  label,
  hint,
  error,
  id: explicitId,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & FieldInfo) {
  const generated = useId();
  const id = explicitId || generated;
  return (
    <FieldFrame {...{ id, label, hint, error }}>
      <textarea
        {...props}
        id={id}
        className="mm-input"
        aria-invalid={error ? true : props["aria-invalid"]}
        aria-describedby={
          [props["aria-describedby"], (hint || error) && `${id}-description`]
            .filter(Boolean)
            .join(" ") || undefined
        }
      />
    </FieldFrame>
  );
}
export function Select({
  label,
  hint,
  error,
  id: explicitId,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & FieldInfo) {
  const generated = useId();
  const id = explicitId || generated;
  return (
    <FieldFrame {...{ id, label, hint, error }}>
      <select
        {...props}
        id={id}
        className="mm-input"
        aria-invalid={error ? true : props["aria-invalid"]}
        aria-describedby={
          [props["aria-describedby"], (hint || error) && `${id}-description`]
            .filter(Boolean)
            .join(" ") || undefined
        }
      >
        {children}
      </select>
    </FieldFrame>
  );
}
export function Checkbox({
  children,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  return (
    <label className="mm-check">
      <input {...props} type="checkbox" />
      {children}
    </label>
  );
}
export function Switch({
  label,
  checked,
  onCheckedChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className="mm-switch-control"
    >
      <span className="mm-switch" data-checked={checked} aria-hidden="true" />
      {label}
    </button>
  );
}
export function Badge({
  children,
  tone,
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  return (
    <span className="mm-badge" data-tone={tone}>
      {children}
    </span>
  );
}
export function Tag({ children }: { children: ReactNode }) {
  return <Badge tone="accent">#{children}</Badge>;
}
export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="mm-kbd">{children}</kbd>;
}
export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`mm-card ${className}`}>{children}</div>;
}
export function Separator() {
  return <hr className="mm-separator" />;
}
export function Alert({
  title,
  children,
  tone = "info",
  urgent = false,
}: {
  title: string;
  children: ReactNode;
  tone?: Tone;
  urgent?: boolean;
}) {
  return (
    <div className="mm-alert" data-tone={tone} role={urgent ? "alert" : "note"}>
      <Icon icon={tone === "danger" ? AlertCircle : Info} />
      <div>
        <strong>{title}</strong>
        <p>{children}</p>
      </div>
    </div>
  );
}
export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mm-empty">
      <h3>{title}</h3>
      <p className="mm-muted">{children}</p>
      {action}
    </div>
  );
}
export function Skeleton({ label = "Loading content" }: { label?: string }) {
  return (
    <div role="status" aria-label={label} className="mm-stack">
      <span className="mm-skeleton" aria-hidden="true" />
      <span className="mm-skeleton" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </div>
  );
}
