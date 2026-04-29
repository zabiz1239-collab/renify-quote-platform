import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSettings, getJob, saveJob } from "@/lib/supabase";
import { supabase } from "@/lib/supabase";
import { createFolder, uploadFile } from "@/lib/onedrive";
import type { JobDocument } from "@/types";

const VALID_CATEGORIES = ["architectural", "engineering", "scope", "colour_selection", "other"] as const;
type UploadCategory = typeof VALID_CATEGORIES[number];

const CATEGORY_FOLDERS: Record<UploadCategory, string> = {
  architectural: "Plans",
  engineering: "Engineering",
  scope: "Inclusions",
  colour_selection: "Colour Selection",
  other: "Other",
};

// OneDrive Graph PUT supports up to 4MB. Larger files would need a resumable
// upload session, which we don't implement yet — skip OneDrive above this size.
const ONEDRIVE_SIMPLE_UPLOAD_LIMIT = 4 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    jobCode?: string;
    address?: string;
    category?: string;
    fileName?: string;
    storagePath?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { jobCode, address, category, fileName, storagePath } = body;

  if (!jobCode || !address || !category || !fileName || !storagePath) {
    return NextResponse.json(
      { error: "Missing required fields: jobCode, address, category, fileName, storagePath" },
      { status: 400 }
    );
  }

  if (!VALID_CATEGORIES.includes(category as UploadCategory)) {
    return NextResponse.json(
      { error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(", ")}` },
      { status: 400 }
    );
  }

  if (!fileName.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json(
      { error: "Only PDF files are accepted" },
      { status: 400 }
    );
  }

  const accessToken = session.accessToken;

  try {
    // The browser uploaded the file directly to Supabase Storage (bypasses
    // Vercel's 4.5MB request-body limit). Verify it landed.
    const { data: fileBlob, error: dlErr } = await supabase.storage
      .from("project-documents")
      .download(storagePath);

    if (dlErr || !fileBlob) {
      console.error("[Upload] File not found in Supabase Storage:", dlErr);
      return NextResponse.json(
        { error: `File not found in storage: ${storagePath}` },
        { status: 404 }
      );
    }

    // OneDrive sync (best-effort, for user browsing).
    if (fileBlob.size <= ONEDRIVE_SIMPLE_UPLOAD_LIMIT) {
      try {
        const settings = await getSettings();
        const rootPath = settings.oneDriveRootPath;
        const jobFolder = `${jobCode} - ${address}`;
        const categoryFolder = CATEGORY_FOLDERS[category as UploadCategory];

        const buffer = await fileBlob.arrayBuffer();

        await createFolder(accessToken, rootPath, jobFolder);
        await createFolder(accessToken, `${rootPath}/${jobFolder}`, categoryFolder);
        await uploadFile(
          accessToken,
          `${rootPath}/${jobFolder}/${categoryFolder}`,
          fileName,
          buffer
        );
      } catch (onedriveErr) {
        console.warn("[Upload] OneDrive upload failed (non-blocking):", onedriveErr);
      }
    } else {
      console.log(
        `[Upload] Skipped OneDrive sync for ${fileName} (${fileBlob.size} bytes > ${ONEDRIVE_SIMPLE_UPLOAD_LIMIT}). File is in Supabase Storage.`
      );
    }

    // Update job documents in Supabase
    const job = await getJob(jobCode);
    if (job) {
      const newDoc: JobDocument = {
        category: category as JobDocument["category"],
        name: fileName,
        type: "upload",
        fileName,
        storagePath,
      };
      job.documents = [...(job.documents || []), newDoc];
      job.updatedAt = new Date().toISOString();
      await saveJob(job);
    }

    return NextResponse.json({ success: true, fileName, storagePath });
  } catch (err: unknown) {
    console.error("[Upload] Failed:", err);
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
