import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getJob, saveJob, getEstimators, getSettings } from "@/lib/supabase";
import { createFolder, uploadFile } from "@/lib/onedrive";
import { getQuoteFileName, getNextVersion } from "@/lib/quote-utils";
import { isJobFullyQuoted } from "@/lib/notifications";
import { notifyQuoteReceived, notifyMilestone } from "@/lib/notify-email";
import { TRADES } from "@/data/trades";

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

  const jobCode = formData.get("jobCode") as string | null;
  const tradeCode = formData.get("tradeCode") as string | null;
  const supplierId = formData.get("supplierId") as string | null;
  const supplierName = formData.get("supplierName") as string | null;
  const priceExGSTStr = formData.get("priceExGST") as string | null;
  const priceIncGSTStr = formData.get("priceIncGST") as string | null;
  const quoteExpiry = formData.get("quoteExpiry") as string | null;
  const file = formData.get("file") as File | null;

  if (!jobCode || !tradeCode || !supplierId || !supplierName) {
    return NextResponse.json(
      { error: "Missing required fields: jobCode, tradeCode, supplierId, supplierName" },
      { status: 400 }
    );
  }

  const priceExGST = priceExGSTStr ? parseFloat(priceExGSTStr) : undefined;
  const priceIncGST = priceIncGSTStr ? parseFloat(priceIncGSTStr) : undefined;
  const accessToken = session.accessToken;

  try {
    const job = await getJob(jobCode);
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Find the trade in the job
    const tradeIndex = job.trades.findIndex((t) => t.code === tradeCode);
    if (tradeIndex === -1) {
      return NextResponse.json({ error: "Trade not found on this job" }, { status: 400 });
    }

    const trade = job.trades[tradeIndex];

    // Get next version number
    const version = getNextVersion(trade.quotes || [], supplierId);

    // Check for duplicate file hash
    let fileHash: string | undefined;
    let duplicateWarning: string | undefined;
    let uploadedFileName: string | undefined;

    if (file) {
      // Compute hash
      const buffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest("SHA-256", new Uint8Array(buffer));
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      fileHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

      // Check duplicates across all quotes in this trade
      const allQuotes = trade.quotes || [];
      for (const q of allQuotes) {
        if (q.fileHash === fileHash) {
          duplicateWarning = `Duplicate PDF detected — same file already uploaded for ${q.supplierName} (${q.quotePDF})`;
          break;
        }
      }

      // Upload to OneDrive
      const tradeName = TRADES.find((t) => t.code === tradeCode)?.name || tradeCode;
      uploadedFileName = getQuoteFileName(tradeName, supplierName, version);

      const settings = await getSettings();
      const rootPath = settings.oneDriveRootPath;
      const jobFolder = `${job.jobCode} - ${job.address}`;
      const quotesFolder = "Quotes";

      await createFolder(accessToken, rootPath, jobFolder);
      await createFolder(accessToken, `${rootPath}/${jobFolder}`, quotesFolder);
      await uploadFile(
        accessToken,
        `${rootPath}/${jobFolder}/${quotesFolder}`,
        uploadedFileName,
        buffer
      );
    }

    // Update or create the quote
    const existingQuoteIdx = (trade.quotes || []).findIndex(
      (q) => q.supplierId === supplierId && q.version === version
    );

    const quoteData = {
      supplierId,
      supplierName,
      status: "received" as const,
      requestedDate: trade.quotes?.find((q) => q.supplierId === supplierId)?.requestedDate,
      receivedDate: new Date().toISOString(),
      priceExGST,
      priceIncGST,
      quoteExpiry: quoteExpiry || undefined,
      quotePDF: uploadedFileName,
      version,
      fileHash,
      followUpCount: trade.quotes?.find((q) => q.supplierId === supplierId)?.followUpCount || 0,
      lastFollowUp: trade.quotes?.find((q) => q.supplierId === supplierId)?.lastFollowUp,
    };

    if (!trade.quotes) trade.quotes = [];

    if (existingQuoteIdx >= 0) {
      trade.quotes[existingQuoteIdx] = quoteData;
    } else {
      trade.quotes.push(quoteData);
    }

    job.trades[tradeIndex] = trade;
    job.updatedAt = new Date().toISOString();
    await saveJob(job);

    // Send notification to estimator
    try {
      const estimators = await getEstimators();
      const estimator = estimators.find((e) => e.id === job.estimatorId);
      const tradeName = TRADES.find((t) => t.code === tradeCode)?.name || tradeCode;
      if (estimator) {
        await notifyQuoteReceived(accessToken, estimator, jobCode, tradeName, supplierName, priceExGST);
      }
    } catch {
      // Notification failure shouldn't block the quote save
    }

    // Check milestone
    try {
      if (isJobFullyQuoted(job)) {
        const settings = await getSettings();
        if (settings.adminEmail) {
          await notifyMilestone(accessToken, settings.adminEmail, job);
        }
      }
    } catch {
      // Milestone notification failure shouldn't block
    }

    return NextResponse.json({
      success: true,
      version,
      fileName: uploadedFileName,
      duplicateWarning,
    });
  } catch (err: unknown) {
    console.error("[QuoteReceive] Failed:", err);
    const message = err instanceof Error ? err.message : "Failed to record quote";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
