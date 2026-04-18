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

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  const jobCode = formData.get("jobCode") as string | null;
  const address = formData.get("address") as string | null;
  const category = formData.get("category") as string | null;

  if (!file || !jobCode || !address || !category) {
    return NextResponse.json(
      { error: "Missing required fields: file, jobCode, address, category" },
      { status: 400 }
    );
  }

  if (!VALID_CATEGORIES.includes(category as UploadCategory)) {
    return NextResponse.json(
      { error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(", ")}` },
      { status: 400 }
    );
  }

  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json(
      { error: "Only PDF files are accepted" },
      { status: 400 }
    );
  }

  const accessToken = session.accessToken;

  try {
    const buffer = await file.arrayBuffer();

    // 1. Upload to Supabase Storage (primary — always available for email attachments)
    const storagePath = `${jobCode}/${category}/${file.name}`;
    const { error: storageErr } = await supabase.storage
      .from("project-documents")
      .upload(storagePath, Buffer.from(buffer), {
        contentType: "application/pdf",
        upsert: true,
      });

    if (storageErr) {
      console.error("[Upload] Supabase Storage failed:", storageErr);
      throw new Error(`Storage upload failed: ${storageErr.message}`);
    }

    // 2. Upload to OneDrive (best-effort — for user browsing)
    try {
      const settings = await getSettings();
      const rootPath = settings.oneDriveRootPath;
      const jobFolder = `${jobCode} - ${address}`;
      const categoryFolder = CATEGORY_FOLDERS[category as UploadCategory];

      await createFolder(accessToken, rootPath, jobFolder);
      await createFolder(accessToken, `${rootPath}/${jobFolder}`, categoryFolder);
      await uploadFile(
        accessToken,
        `${rootPath}/${jobFolder}/${categoryFolder}`,
        file.name,
        buffer
      );
    } catch (onedriveErr) {
      console.warn("[Upload] OneDrive upload failed (non-blocking):", onedriveErr);
    }

    // 3. Update job documents in Supabase
    const job = await getJob(jobCode);
    if (job) {
      const newDoc: JobDocument = {
        category: category as JobDocument["category"],
        name: file.name,
        type: "upload",
        fileName: file.name,
        storagePath,
      };
      job.documents = [...(job.documents || []), newDoc];
      job.updatedAt = new Date().toISOString();
      await saveJob(job);
    }

    return NextResponse.json({ success: true, fileName: file.name, storagePath });
  } catch (err: unknown) {
    console.error("[Upload] Failed:", err);
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
