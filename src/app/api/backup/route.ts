import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getJobs, getSuppliers, getEstimators, getTemplates, getSettings } from "@/lib/supabase";
import { supabase } from "@/lib/supabase";

// GET — list backups or download one
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const backupId = request.nextUrl.searchParams.get("id");

  if (backupId) {
    // Download specific backup
    const { data, error } = await supabase
      .from("qp_backups")
      .select("*")
      .eq("id", backupId)
      .single();
    if (error || !data) return NextResponse.json({ error: "Backup not found" }, { status: 404 });
    return NextResponse.json(data);
  }

  // List all backups
  const { data, error } = await supabase
    .from("qp_backups")
    .select("id, created_at, label, size_estimate")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ backups: data || [] });
}

// POST — create a new backup
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const label = body.label || `Backup ${new Date().toLocaleDateString("en-AU")}`;

  try {
    const [jobs, suppliers, estimators, templates, settings] = await Promise.all([
      getJobs(),
      getSuppliers(),
      getEstimators(),
      getTemplates(),
      getSettings(),
    ]);

    const backupData = { jobs, suppliers, estimators, templates, settings };
    const sizeEstimate = JSON.stringify(backupData).length;

    const { error } = await supabase.from("qp_backups").insert({
      label,
      data: backupData,
      size_estimate: sizeEstimate,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    });

    if (error) throw error;

    // Clean up expired backups (older than 14 days)
    await supabase
      .from("qp_backups")
      .delete()
      .lt("expires_at", new Date().toISOString());

    return NextResponse.json({
      success: true,
      label,
      sizeKB: Math.round(sizeEstimate / 1024),
      jobs: jobs.length,
      suppliers: suppliers.length,
      estimators: estimators.length,
      templates: templates.length,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Backup failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE — remove a backup
export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const backupId = request.nextUrl.searchParams.get("id");
  if (!backupId) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const { error } = await supabase.from("qp_backups").delete().eq("id", backupId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
