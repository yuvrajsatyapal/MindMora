import {isKnowledgeEnabled} from "../../server/config";
import "katex/dist/katex.min.css";
import { headers } from "next/headers";
import { Suspense } from "react";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { WorkspaceShell } from "../../components/workspace/WorkspaceShell";
export default async function WorkspacePage() {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <Suspense fallback={<p role="status">Loading workspace…</p>}>
      <NuqsAdapter>
        <WorkspaceShell nonce={nonce} knowledgeEnabled={isKnowledgeEnabled()} />
      </NuqsAdapter>
    </Suspense>
  );
}
