"use client";
import { Button, EmptyState } from "../../../components/ui/primitives";
import { FileText } from "lucide-react";
import { Icon } from "../../../components/ui/primitives";
import type { NoteSummary } from "../types";
export function NoteList({
  notes,
  selectedId,
  select,
}: {
  notes: NoteSummary[];
  selectedId: string | null;
  select: (id: string) => void;
}) {
  return notes.length ? (
    <ul className="mm-note-list">
      {notes.map((note) => (
        <li key={note.id}>
          <Button
            variant="ghost"
            aria-current={selectedId === note.id ? "page" : undefined}
            onClick={() => select(note.id)}
          >
            <Icon icon={FileText} size="sm" />
            <span>{note.title}</span>
          </Button>
        </li>
      ))}
    </ul>
  ) : (
    <EmptyState title="No notes yet">
      Create a note to start your workspace.
    </EmptyState>
  );
}
