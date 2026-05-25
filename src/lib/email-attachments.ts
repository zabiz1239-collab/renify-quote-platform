import { downloadFile } from "@/lib/onedrive";
import { getSettings, supabase } from "@/lib/supabase";
import type { Job, JobDocument, JobDocumentCategory } from "@/types";

export const MAX_SMTP_SIZE = 20 * 1024 * 1024; // 20MB

const CATEGORY_FOLDERS: Record<JobDocumentCategory, string> = {
  architectural: "Plans",
  engineering: "Engineering",
  scope: "Inclusions",
  colour_selection: "Colour Selection",
  energy_rating: "Energy Rating",
  other: "Other",
};

export interface DownloadedAttachmentFile {
  name: string;
  content: Buffer;
  size: number;
}

export interface EmailFileAttachment {
  name: string;
  contentType: string;
  contentBytes: string;
}

export async function downloadAttachmentFiles(
  accessToken: string,
  job: Job,
  documents: JobDocument[]
): Promise<DownloadedAttachmentFile[]> {
  const files: DownloadedAttachmentFile[] = [];
  const settings = await getSettings().catch(() => null);

  for (const doc of documents) {
    if (doc.type !== "upload") continue;

    const storagePath = doc.storagePath || `${job.jobCode}/${doc.category}/${doc.fileName || doc.name}`;

    try {
      const { data, error } = await supabase.storage
        .from("project-documents")
        .download(storagePath);

      if (error || !data) {
        console.error(`[Email] Storage download failed for ${storagePath}:`, error?.message || "No data returned");
      } else {
        const arrayBuffer = await data.arrayBuffer();
        const buf = Buffer.from(arrayBuffer);
        files.push({ name: doc.name, content: buf, size: buf.length });
        continue;
      }
    } catch (err) {
      console.error(`[Email] Failed to download ${storagePath}:`, err);
    }

    const fileName = doc.fileName || doc.name;
    const oneDrivePath =
      doc.oneDrivePath ||
      (settings?.oneDriveRootPath
        ? `${settings.oneDriveRootPath}/${job.jobCode} - ${job.address}/${CATEGORY_FOLDERS[doc.category]}/${fileName}`
        : "");

    if (!oneDrivePath) continue;

    try {
      const arrayBuffer = await downloadFile(accessToken, oneDrivePath);
      const buf = Buffer.from(arrayBuffer);
      files.push({ name: doc.name, content: buf, size: buf.length });
    } catch (err) {
      console.error(`[Email] OneDrive fallback download failed for ${oneDrivePath}:`, err);
    }
  }

  return files;
}

export function filesToEmailAttachments(files: DownloadedAttachmentFile[]): EmailFileAttachment[] {
  return files.map((file) => ({
    name: file.name,
    contentType: "application/pdf",
    contentBytes: file.content.toString("base64"),
  }));
}

export function getAttachmentFilesSize(files: DownloadedAttachmentFile[]): number {
  return files.reduce((sum, file) => sum + file.size, 0);
}
