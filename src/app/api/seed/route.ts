import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { writeJsonFile, itemExists, createFolder } from "@/lib/onedrive";
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

  const accessToken = session.accessToken;
  const rootPath = DEFAULT_ONEDRIVE_ROOT;

  try {
    // Create root folder if it doesn't exist
    const rootExists = await itemExists(accessToken, rootPath);
    if (!rootExists) {
      await createFolder(accessToken, "", rootPath);
    }

    // Save estimators
    await writeJsonFile(accessToken, `${rootPath}/estimators.json`, SAMPLE_ESTIMATORS);

    // Save suppliers
    await writeJsonFile(accessToken, `${rootPath}/suppliers.json`, SAMPLE_SUPPLIERS);

    // Save templates
    await writeJsonFile(accessToken, `${rootPath}/templates.json`, SAMPLE_TEMPLATES);

    // Save settings
    const settings: AppSettings = {
      oneDriveRootPath: rootPath,
      regions: ["Western", "Northern", "South East", "Eastern", "Geelong", "Ballarat"],
      followUpDays: { first: 7, second: 14 },
      quoteExpiryWarningDays: [30, 60, 90],
      defaultMarkupPercent: 15,
      adminEmail: "",
    };
    await writeJsonFile(accessToken, `${rootPath}/settings.json`, settings);

    // Create job folders and save job configs
    for (const job of SAMPLE_JOBS) {
      const folderName = `${job.jobCode} - ${job.address}`;
      try {
        await createFolder(accessToken, rootPath, folderName);
      } catch {
        // Folder may already exist
      }
      try {
        await createFolder(accessToken, `${rootPath}/${folderName}`, "Quotes");
      } catch {
        // Quotes folder may already exist
      }
      await writeJsonFile(
        accessToken,
        `${rootPath}/${folderName}/job-config.json`,
        job
      );
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
