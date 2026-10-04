import { handleNotes } from "../../../../server/notes/routes";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const handler = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) => handleNotes(request, (await params).id);
export {
  handler as GET,
  handler as POST,
  handler as PUT,
  handler as PATCH,
  handler as DELETE,
  handler as HEAD,
  handler as OPTIONS,
};
