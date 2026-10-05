"use client";
import type { ReactNode } from "react";
import {
  Check,
  Circle,
  AlertCircle,
  HardDrive,
  Cloud,
  CloudOff,
  FileText,
  LoaderCircle,
} from "lucide-react";
import { Badge, Card, Checkbox, Icon, type Tone } from "../ui/primitives";
export function NoteRow({
  title,
  excerpt,
  meta,
  selected = false,
  onSelect,
}: {
  title: string;
  excerpt: string;
  meta: string;
  selected?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className="mm-note"
      aria-pressed={selected}
      onClick={onSelect}
    >
      <Icon icon={FileText} />
      <span className="mm-note-copy">
        <strong>{title}</strong>
        <span className="mm-muted">{excerpt}</span>
        <span className="mm-muted">{meta}</span>
      </span>
    </button>
  );
}
export function WikiLink({
  href,
  missing = false,
  children,
}: {
  href: string;
  missing?: boolean;
  children: ReactNode;
}) {
  return (
    <a href={href} className="mm-wikilink" data-missing={missing}>
      {children}
      {missing && <span className="sr-only"> (note does not exist)</span>}
    </a>
  );
}
export function BacklinkItem({
  href,
  title,
  children,
}: {
  href: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <a className="mm-backlink" href={href}>
      <strong>{title}</strong>
      <p className="mm-muted">{children}</p>
    </a>
  );
}
export function TaskRow({
  checked,
  onCheckedChange,
  children,
  disabled,
}: {
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <div className="mm-task" data-checked={checked}>
      <Checkbox
        checked={checked}
        disabled={disabled}
        onChange={(event) => onCheckedChange(event.target.checked)}
      >
        <span className="mm-task-label">{children}</span>
      </Checkbox>
    </div>
  );
}
export type SaveState = "unsaved" | "saving" | "saved" | "error";
const saves = {
  unsaved: { label: "Unsaved changes", icon: Circle, tone: "warning" },
  saving: { label: "Saving to server…", icon: LoaderCircle, tone: "info" },
  saved: { label: "Saved to server", icon: HardDrive, tone: "success" },
  error: {
    label: "Not saved — retry required",
    icon: AlertCircle,
    tone: "danger",
  },
} satisfies Record<
  SaveState,
  { label: string; icon: typeof Circle; tone: Tone }
>;
/** Pass saved only after the server confirms a successful PostgreSQL commit. */
export function SaveStatus({ state }: { state: SaveState }) {
  const value = saves[state];
  return (
    <span className="mm-status" role="status" data-tone={value.tone}>
      <Icon icon={value.icon} size="sm" />
      {value.label}
    </span>
  );
}
export type SyncState =
  "disconnected" | "offline" | "syncing" | "synced" | "error";
const syncs = {
  disconnected: { label: "Not refreshing", icon: CloudOff, tone: "info" },
  offline: { label: "Offline · refresh unavailable", icon: CloudOff, tone: "warning" },
  syncing: { label: "Refreshing from server…", icon: Cloud, tone: "info" },
  synced: { label: "Server data refreshed", icon: Check, tone: "success" },
  error: {
    label: "Refresh failed · draft retained",
    icon: AlertCircle,
    tone: "danger",
  },
} satisfies Record<
  SyncState,
  { label: string; icon: typeof Circle; tone: Tone }
>;
export function SyncStatus({ state }: { state: SyncState }) {
  const value = syncs[state];
  return (
    <span className="mm-status" role="status" data-tone={value.tone}>
      <Icon icon={value.icon} size="sm" />
      {value.label}
    </span>
  );
}
export function CanvasCard({
  title,
  children,
  footer,
}: {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Card className="mm-canvas-card">
      <div className="mm-stack">
        <Badge>Note on canvas</Badge>
        <h3>{title}</h3>
        <p className="mm-muted">{children}</p>
        {footer}
      </div>
    </Card>
  );
}
export function PropertyRow({
  name,
  children,
}: {
  name: string;
  children: ReactNode;
}) {
  return (
    <div className="mm-property">
      <dt>{name}</dt>
      <dd>{children}</dd>
    </div>
  );
}
