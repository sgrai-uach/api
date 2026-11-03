import { NextRequest } from "next/server";
import { PATCH as handlePatchPatrulla } from "../route";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/patrullas/[id]/estado
 * Alias directo hacia PATCH /api/patrullas/[id] para mutación de estado operativo.
 */
export async function PATCH(req: NextRequest, props: RouteContext) {
  return handlePatchPatrulla(req, props);
}
