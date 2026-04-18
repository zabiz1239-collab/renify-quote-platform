import { NextRequest, NextResponse } from "next/server";
import { getJobs, getSuppliers, getEstimators, getTemplates, getSettings } from "@/lib/supabase";
import { supabase } from "@/lib/supabase";

// Runs daily via Vercel Cron — creates automatic backup and deletes expired ones
export async function GET(request: NextRequest) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Create daily backup
    const [jobs, suppliers, estimators, templates, settings] = await Promise.all([
      getJobs(),
      getSuppliers(),
      getEstimators(),
      getTemplates(),
      getSettings(),
    ]);

    const backupData = { jobs, suppliers, estimators, templates, settings };
    const sizeEstimate = JSON.stringify(backupData).length;
    const today = new Date().toLocaleDateString("en-AU");

    const { error: insertErr } = await supabase.from("qp_backups").insert({
      label: `Auto backup ${today}`,
      data: backupData,
      size_estimate: sizeEstimate,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    });

    if (insertErr) throw insertErr;

    // 2. Delete expired backups (older than 14 days)
    const { data: deleted } = await supabase
      .from("qp_backups")
      .delete()
      .lt("expires_at", new Date().toISOString())
      .select("id");

    const deletedCount = deleted?.length || 0;

    return NextResponse.json({
      success: true,
      backup: `Auto backup ${today}`,
      sizeKB: Math.round(sizeEstimate / 1024),
      jobs: jobs.length,
      suppliers: suppliers.length,
      expiredDeleted: deletedCount,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Backup cron failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
