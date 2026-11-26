import type { AuthInfo } from "@modelcontextprotocol/server";
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { safeEqual } from "@/lib/auth/session";
import { registerGibit } from "@/lib/mcp/server";

export const maxDuration = 60;

const handler = createMcpHandler(registerGibit, {
  serverInfo: { name: "gibit", version: "2.0.0" },
});

async function verifyToken(_req: Request, bearerToken?: string): Promise<AuthInfo | undefined> {
  const secret = process.env.GIBIT_SECRET;
  if (!secret || !bearerToken || !(await safeEqual(bearerToken, secret))) return undefined;
  return { token: bearerToken, clientId: "claude", scopes: [] };
}

const authed = withMcpAuth(handler, verifyToken, { required: true });

export { authed as GET, authed as POST, authed as DELETE };
