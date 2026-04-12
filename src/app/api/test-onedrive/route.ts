import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getGraphClient } from "@/lib/onedrive";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({
      error: "Not authenticated",
      hint: "Sign in first at /login",
    }, { status: 401 });
  }

  const results: Record<string, unknown> = {};
  const client = getGraphClient(session.accessToken);

  // Step 1: Test basic token validity
  try {
    const me = await client.api("/me").get();
    results.step1_me = { ok: true, name: me.displayName, email: me.mail || me.userPrincipalName };
  } catch (err: unknown) {
    const e = err as { statusCode?: number; message?: string; body?: string };
    results.step1_me = { ok: false, status: e.statusCode, message: e.message, body: typeof e.body === "string" ? e.body.slice(0, 500) : e.body };
    return NextResponse.json(results);
  }

  // Step 2: Test drive access
  try {
    const drive = await client.api("/me/drive").get();
    results.step2_drive = { ok: true, driveType: drive.driveType, quota: drive.quota?.total ? `${Math.round(drive.quota.total / 1024 / 1024)}MB` : "unknown" };
  } catch (err: unknown) {
    const e = err as { statusCode?: number; message?: string; body?: string };
    results.step2_drive = { ok: false, status: e.statusCode, message: e.message, body: typeof e.body === "string" ? e.body.slice(0, 500) : e.body };
    return NextResponse.json(results);
  }

  // Step 3: List root children
  try {
    const root = await client.api("/me/drive/root/children").top(10).get();
    results.step3_rootChildren = {
      ok: true,
      count: root.value?.length || 0,
      items: (root.value || []).map((item: { name: string; folder?: unknown }) => ({
        name: item.name,
        isFolder: !!item.folder,
      })),
    };
  } catch (err: unknown) {
    const e = err as { statusCode?: number; message?: string; body?: string };
    results.step3_rootChildren = { ok: false, status: e.statusCode, message: e.message, body: typeof e.body === "string" ? e.body.slice(0, 500) : e.body };
  }

  // Step 4: Try to find or create "Renify Jobs" folder
  const folderName = "Renify Jobs";
  try {
    const folder = await client.api(`/me/drive/root:/${folderName}`).get();
    results.step4_renifyJobs = { ok: true, exists: true, id: folder.id, name: folder.name };
  } catch (err: unknown) {
    const e = err as { statusCode?: number; message?: string };
    if (e.statusCode === 404) {
      // Try to create it
      try {
        const created = await client.api("/me/drive/root/children").post({
          name: folderName,
          folder: {},
          "@microsoft.graph.conflictBehavior": "fail",
        });
        results.step4_renifyJobs = { ok: true, exists: false, created: true, id: created.id, name: created.name };
      } catch (createErr: unknown) {
        const ce = createErr as { statusCode?: number; message?: string; body?: string };
        results.step4_renifyJobs = { ok: false, exists: false, created: false, status: ce.statusCode, message: ce.message, body: typeof ce.body === "string" ? ce.body.slice(0, 500) : ce.body };
      }
    } else {
      results.step4_renifyJobs = { ok: false, status: e.statusCode, message: e.message };
    }
  }

  // Step 5: Try the default configured path
  const defaultPath = "Desktop/Renify Business/Renify Jobs/Jobs";
  try {
    const encodedPath = encodeURIComponent(defaultPath).replace(/%2F/g, "/");
    const folder = await client.api(`/me/drive/root:/${encodedPath}`).get();
    results.step5_defaultPath = { ok: true, path: defaultPath, id: folder.id };
  } catch (err: unknown) {
    const e = err as { statusCode?: number; message?: string };
    results.step5_defaultPath = { ok: false, path: defaultPath, status: e.statusCode, message: e.message };
  }

  return NextResponse.json(results);
}
