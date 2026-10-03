"use client";
import {
  Dialog as PrimitiveDialog,
  Tabs as PrimitiveTabs,
  DropdownMenu,
  Tooltip as PrimitiveTooltip,
} from "radix-ui";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { Button, IconButton } from "./primitives";
export function Dialog({
  trigger,
  title,
  description,
  children,
}: {
  trigger: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <PrimitiveDialog.Root>
      <PrimitiveDialog.Trigger asChild>{trigger}</PrimitiveDialog.Trigger>
      <PrimitiveDialog.Portal>
        <PrimitiveDialog.Overlay className="mm-overlay" />
        <PrimitiveDialog.Content className="mm-dialog">
          <PrimitiveDialog.Title>{title}</PrimitiveDialog.Title>
          <PrimitiveDialog.Description className="mm-muted">
            {description}
          </PrimitiveDialog.Description>
          {children}
          <PrimitiveDialog.Close asChild>
            <Button variant="secondary" className="mm-dialog-close">
              Close dialog
            </Button>
          </PrimitiveDialog.Close>
        </PrimitiveDialog.Content>
      </PrimitiveDialog.Portal>
    </PrimitiveDialog.Root>
  );
}
export function Tabs({
  label,
  items,
}: {
  label: string;
  items: { value: string; label: string; content: ReactNode }[];
}) {
  return (
    <PrimitiveTabs.Root defaultValue={items[0]?.value}>
      <PrimitiveTabs.List className="mm-tab-list" aria-label={label}>
        {items.map((item) => (
          <PrimitiveTabs.Trigger
            key={item.value}
            value={item.value}
            className="mm-tab"
          >
            {item.label}
          </PrimitiveTabs.Trigger>
        ))}
      </PrimitiveTabs.List>
      {items.map((item) => (
        <PrimitiveTabs.Content
          key={item.value}
          value={item.value}
          className="mm-tab-panel"
        >
          {item.content}
        </PrimitiveTabs.Content>
      ))}
    </PrimitiveTabs.Root>
  );
}
export function Menu({
  trigger,
  items,
}: {
  trigger: ReactNode;
  items: { label: string; onSelect: () => void; disabled?: boolean }[];
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="mm-menu" sideOffset={8}>
          {items.map((item) => (
            <DropdownMenu.Item
              key={item.label}
              className="mm-menu-item"
              disabled={item.disabled}
              onSelect={item.onSelect}
            >
              {item.label}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
export function Tooltip({
  content,
  children,
}: {
  content: string;
  children: ReactNode;
}) {
  return (
    <PrimitiveTooltip.Provider delayDuration={300}>
      <PrimitiveTooltip.Root>
        <PrimitiveTooltip.Trigger asChild>{children}</PrimitiveTooltip.Trigger>
        <PrimitiveTooltip.Portal>
          <PrimitiveTooltip.Content className="mm-tooltip" sideOffset={8}>
            {content}
          </PrimitiveTooltip.Content>
        </PrimitiveTooltip.Portal>
      </PrimitiveTooltip.Root>
    </PrimitiveTooltip.Provider>
  );
}
export function Toast({
  message,
  onDismiss,
}: {
  message: string | null;
  onDismiss: () => void;
}) {
  return (
    <div role="status" aria-live="polite" aria-atomic="true">
      {message && (
        <div className="mm-toast">
          <span>{message}</span>
          <IconButton
            label="Dismiss notification"
            icon={X}
            variant="ghost"
            onClick={onDismiss}
          />
        </div>
      )}
    </div>
  );
}
