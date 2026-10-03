import { handleAuth } from "../../../../server/auth/routes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const handler = (request: Request) => handleAuth("logout", request);
// Handle unsupported methods explicitly so auth failures also carry no-store headers.
export {
  handler as GET,
  handler as POST,
  handler as PUT,
  handler as PATCH,
  handler as DELETE,
  handler as HEAD,
  handler as OPTIONS,
};
