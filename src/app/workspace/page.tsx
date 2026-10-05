import { Suspense } from "react";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { WorkspaceShell } from "../../components/workspace/WorkspaceShell";
export default function WorkspacePage() {
  return (
    <Suspense fallback={<p role="status">Loading workspace…</p>}>
      <NuqsAdapter>
        <WorkspaceShell />
      </NuqsAdapter>
    </Suspense>
  );
}
