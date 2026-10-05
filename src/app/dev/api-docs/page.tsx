import { notFound } from "next/navigation";
import { docsEnabled } from "./policy";
import ApiDocs from "./swagger";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export default function ApiDocsPage() {
  if (!docsEnabled(process.env.NODE_ENV, process.env.API_DOCS_ENABLED))
    notFound();
  return (
    <main>
      <h1 className="sr-only">MindMora API reference</h1>
      <ApiDocs />
    </main>
  );
}
