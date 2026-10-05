"use client";
import type { RefObject } from "react";
import { Button } from "../../../components/ui/primitives";
import type { EditorHandle, FormatAction } from "./CodeMirrorEditor";
export type EditorMode = "edit" | "preview" | "split";
const actions: [FormatAction, string][] = [["heading","Heading"],["bold","Bold"],["italic","Italic"],["list","List"],["checklist","Checklist"],["quote","Quote"],["link","Link"],["code","Code block"]];
export function EditorToolbar({mode,setMode,handle}: {mode:EditorMode;setMode:(mode:EditorMode)=>void;handle:RefObject<EditorHandle|null>}) {
 return <div className="mm-editor-toolbar">
  <div className="mm-workspace-actions" role="group" aria-label="Markdown formatting">
   {actions.map(([action,label])=><Button key={action} variant="secondary" disabled={mode==="preview"} onMouseDown={event=>event.preventDefault()} onClick={()=>handle.current?.format(action)}>{label}</Button>)}
  </div>
  <div className="mm-workspace-actions" role="group" aria-label="Editor presentation">
   {(["edit","preview","split"] as const).map(value=><Button key={value} variant="secondary" aria-pressed={mode===value} onClick={()=>setMode(value)}>{value[0].toUpperCase()+value.slice(1)}</Button>)}
  </div>
 </div>;
}
