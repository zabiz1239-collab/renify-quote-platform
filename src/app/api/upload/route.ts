import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSettings, getJob, saveJob } from "@/lib/supabase";
import { supabase } from "@/lib/supabase";
import { createFolder, uploadFile } from "@/lib/onedrive";
import type { JobDocument } from "@/types";

const VALID_CATEGORIES = ["architectural", "engineering", "scope", "colour_selection", "energy_rating", "other"] as const;
type UploadCategory = typeof VALID_CATEGORIES[number];

const CATEGORY_FOLDERS: Record<UploadCategory, string> = {
  architectural: "Plans",
  engineering: "Engineering",
  scope: "Inclusions",
  colour_selection: "Colour Selection",
  energy_rating: "Energy Rating",
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
    file?: File;
  };
  try {
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file");
      body = {
        jobCode: formData.get("jobCode")?.toString(),
        address: formData.get("address")?.toString(),
        category: formData.get("category")?.toString(),
        fileName: file instanceof File ? file.name : undefined,
        storagePath: formData.get("storagePath")?.toString(),
        file: file instanceof File ? file : undefined,
      };
    } else {
      body = await request.json();
    }
  } catch {
    return NextResponse.json({ error: "Invalid upload request" }, { status: 400 });
  }

  const { jobCode, address, category, fileName, storagePath, file } = body;

  if (!jobCode || !address || !category || !fileName || (!storagePath && !file)) {
    return NextResponse.json(
      { error: "Missing required fields: jobCode, address, category, fileName and storagePath or file" },
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
    let fileBlob: Blob | File | null = null;
    let finalStoragePath = storagePath;
    let storageAvailable = false;

    if (file) {
      finalStoragePath = storagePath || `${jobCode}/${category}/${fileName}`;
      fileBlob = file;

      const { error: storageErr } = await supabase.storage
        .from("project-documents")
        .upload(finalStoragePath, file, {
          contentType: "application/pdf",
          upsert: true,
        });

      if (storageErr) {
        console.warn("[Upload] Supabase Storage upload failed; keeping OneDrive fallback:", storageErr.message);
      } else {
        storageAvailable = true;
      }
    } else if (storagePath) {
      // The browser uploaded the file directly to Supabase Storage. Verify it landed.
      const { data: downloadedBlob, error: dlErr } = await supabase.storage
        .from("project-documents")
        .download(storagePath);

      if (dlErr || !downloadedBlob) {
        console.error("[Upload] File not found in Supabase Storage:", dlErr);
        return NextResponse.json(
          { error: `File not found in storage: ${storagePath}` },
          { status: 404 }
        );
      }

      fileBlob = downloadedBlob;
      storageAvailable = true;
    }

    if (!fileBlob) {
      return NextResponse.json({ error: "No PDF content available to store" }, { status: 400 });
    }

    let oneDrivePath: string | undefined;

    // OneDrive sync. This also acts as a fallback when Supabase Storage policies are missing.
    if (fileBlob.size <= ONEDRIVE_SIMPLE_UPLOAD_LIMIT) {
      try {
        const settings = await getSettings();
        const rootPath = settings.oneDriveRootPath;
        const jobFolder = `${jobCode} - ${address}`;
        const categoryFolder = CATEGORY_FOLDERS[category as UploadCategory];

        const buffer = await fileBlob.arrayBuffer();
        const candidateOneDrivePath = `${rootPath}/${jobFolder}/${categoryFolder}/${fileName}`;

        await createFolder(accessToken, rootPath, jobFolder);
        await createFolder(accessToken, `${rootPath}/${jobFolder}`, categoryFolder);
        await uploadFile(
          accessToken,
          `${rootPath}/${jobFolder}/${categoryFolder}`,
          fileName,
          buffer
        );
        oneDrivePath = candidateOneDrivePath;
      } catch (onedriveErr) {
        console.warn("[Upload] OneDrive upload failed (non-blocking):", onedriveErr);
      }
    } else {
      console.log(
        `[Upload] Skipped OneDrive sync for ${fileName} (${fileBlob.size} bytes > ${ONEDRIVE_SIMPLE_UPLOAD_LIMIT}). File is in Supabase Storage.`
      );
    }

    if (!storageAvailable && !oneDrivePath) {
      return NextResponse.json(
        { error: "PDF could not be stored. Check Supabase Storage policies or OneDrive access." },
        { status: 502 }
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
        storagePath: storageAvailable ? finalStoragePath : undefined,
        oneDrivePath,
      };
      job.documents = [...(job.documents || []), newDoc];
      job.updatedAt = new Date().toISOString();
      await saveJob(job);
    }

    return NextResponse.json({
      success: true,
      fileName,
      storagePath: storageAvailable ? finalStoragePath : undefined,
      oneDrivePath,
    });
  } catch (err: unknown) {
    console.error("[Upload] Failed:", err);
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
