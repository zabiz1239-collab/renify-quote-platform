import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

interface OcrResult {
  priceExGST?: number;
  priceIncGST?: number;
  supplierName?: string;
  quoteDate?: string;
  expiryDate?: string;
  scopeItems: string[];
  rawText?: string;
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!ANTHROPIC_API_KEY || ANTHROPIC_API_KEY === "PASTE_ANTHROPIC_KEY_HERE") {
    return NextResponse.json(
      { error: "Anthropic API key not configured" },
      { status: 500 }
    );
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  // Convert PDF to base64
  const arrayBuffer = await file.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "document",
                source: {
                  type: "base64",
                  media_type: "application/pdf",
                  data: base64,
                },
              },
              {
                type: "text",
                text: `Extract the following information from this construction quote PDF. Return ONLY a JSON object with these fields:

{
  "priceExGST": number or null (price excluding GST in AUD),
  "priceIncGST": number or null (price including GST in AUD),
  "supplierName": string or null (company name of the supplier),
  "quoteDate": string or null (date in YYYY-MM-DD format),
  "expiryDate": string or null (expiry/validity date in YYYY-MM-DD format),
  "scopeItems": string[] (list of items/works included in the quote)
}

If a field cannot be found, use null for numbers/strings and empty array for scopeItems.
Only return the JSON object, no other text.`,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json(
        { error: `OCR failed: ${errorData.error?.message || response.statusText}` },
        { status: 500 }
      );
    }

    const data = await response.json();
    const content = data.content?.[0]?.text || "";

    // Parse the JSON response from Claude
    let result: OcrResult;
    try {
      // Extract JSON from the response (handle markdown code blocks)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }
      const parsed = JSON.parse(jsonMatch[0]);
      result = {
        priceExGST: typeof parsed.priceExGST === "number" ? parsed.priceExGST : undefined,
        priceIncGST: typeof parsed.priceIncGST === "number" ? parsed.priceIncGST : undefined,
        supplierName: parsed.supplierName || undefined,
        quoteDate: parsed.quoteDate || undefined,
        expiryDate: parsed.expiryDate || undefined,
        scopeItems: Array.isArray(parsed.scopeItems) ? parsed.scopeItems : [],
        rawText: content,
      };
    } catch {
      result = {
        scopeItems: [],
        rawText: content,
      };
    }

    return NextResponse.json(result);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "OCR processing failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
