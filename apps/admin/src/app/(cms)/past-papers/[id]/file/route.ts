import { loadPastPaperFile } from "@/server/past-papers";
import { currentStaff } from "@/server/staff";

/** Streams a past-paper PDF to signed-in staff, shown inline in the browser's PDF viewer. */
export async function GET(_req: Request, ctx: RouteContext<"/past-papers/[id]/file">) {
  const staff = await currentStaff();
  if (!staff) return new Response("Not signed in", { status: 401 });
  const { id } = await ctx.params;
  const file = await loadPastPaperFile(staff, id);
  if (!file) return new Response("Past paper not found", { status: 404 });
  // ASCII fallback plus the UTF-8 name, so accented French file names survive.
  const ascii = file.name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "");
  return new Response(file.body, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
