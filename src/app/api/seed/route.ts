import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  saveSettings,
  saveEstimator,
  saveSuppliersBulk,
  saveTemplatesBulk,
  saveJob,
} from "@/lib/supabase";
import { createJobFolders } from "@/lib/onedrive";
import { SAMPLE_ESTIMATORS, SAMPLE_SUPPLIERS, SAMPLE_JOBS } from "@/data/sample-data";
import { SAMPLE_TEMPLATES } from "@/data/sample-templates";
import type { AppSettings } from "@/types";
import { DEFAULT_ONEDRIVE_ROOT } from "@/types";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function POST(_request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rootPath = DEFAULT_ONEDRIVE_ROOT;

  try {
    // Save estimators
    for (const est of SAMPLE_ESTIMATORS) {
      await saveEstimator(est);
    }

    // Save suppliers
    await saveSuppliersBulk(SAMPLE_SUPPLIERS);

    // Save templates
    await saveTemplatesBulk(SAMPLE_TEMPLATES);

    // Save settings
    const settings: AppSettings = {
      oneDriveRootPath: rootPath,
      regions: ["Western", "Northern", "South East", "Eastern", "Geelong", "Ballarat"],
      followUpDays: { first: 7, second: 14 },
      quoteExpiryWarningDays: [30, 60, 90],
      defaultMarkupPercent: 15,
      adminEmail: "",
    };
    await saveSettings(settings);

    // Save jobs and create OneDrive folders (best effort)
    for (const job of SAMPLE_JOBS) {
      await saveJob(job);
      try {
        await createJobFolders(session.accessToken, rootPath, job.jobCode, job.address);
      } catch {
        // OneDrive folder creation is best-effort
      }
    }

    return NextResponse.json({
      success: true,
      seeded: {
        estimators: SAMPLE_ESTIMATORS.length,
        suppliers: SAMPLE_SUPPLIERS.length,
        templates: SAMPLE_TEMPLATES.length,
        jobs: SAMPLE_JOBS.length,
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Seed failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
