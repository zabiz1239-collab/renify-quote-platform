import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_QUOTE_OCR_MODEL || "gemini-2.5-pro";
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

interface OcrResult {
  priceExGST?: number;
  priceIncGST?: number;
  supplierName?: string;
  quoteDate?: string;
  expiryDate?: string;
  scopeItems: string[];
  rawText?: string;
}

interface GeminiGenerateContentResponse {
  candidates?: Array<{
    finishReason?: string;
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
}

const OCR_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    priceExGST: {
      type: ["number", "null"],
      description: "Price excluding GST in AUD.",
    },
    priceIncGST: {
      type: ["number", "null"],
      description: "Price including GST in AUD.",
    },
    supplierName: {
      type: ["string", "null"],
      description: "Supplier company name.",
    },
    quoteDate: {
      type: ["string", "null"],
      description: "Quote date in YYYY-MM-DD format.",
    },
    expiryDate: {
      type: ["string", "null"],
      description: "Expiry or validity date in YYYY-MM-DD format.",
    },
    scopeItems: {
      type: "array",
      description: "List of items or works included in the quote.",
      items: {
        type: "string",
      },
    },
  },
  required: [
    "priceExGST",
    "priceIncGST",
    "supplierName",
    "quoteDate",
    "expiryDate",
    "scopeItems",
  ],
};

function extractGeminiText(payload: GeminiGenerateContentResponse): string {
  const parts = payload?.candidates?.[0]?.content?.parts ?? [];
  const text = parts
    .map((part: { text?: string }) => (typeof part.text === "string" ? part.text : ""))
    .join("")
    .trim();

  if (text) return text;

  const finishReason = payload?.candidates?.[0]?.finishReason;
  if (finishReason) {
    throw new Error(`Gemini returned no text (finish reason: ${finishReason})`);
  }

  throw new Error("Gemini returned no text");
}

function normalizeOcrResult(parsed: Partial<OcrResult>, rawText: string): OcrResult {
  return {
    priceExGST: typeof parsed.priceExGST === "number" ? parsed.priceExGST : undefined,
    priceIncGST: typeof parsed.priceIncGST === "number" ? parsed.priceIncGST : undefined,
    supplierName:
      typeof parsed.supplierName === "string" && parsed.supplierName.trim()
        ? parsed.supplierName.trim()
        : undefined,
    quoteDate:
      typeof parsed.quoteDate === "string" && parsed.quoteDate.trim()
        ? parsed.quoteDate.trim()
        : undefined,
    expiryDate:
      typeof parsed.expiryDate === "string" && parsed.expiryDate.trim()
        ? parsed.expiryDate.trim()
        : undefined,
    scopeItems: Array.isArray(parsed.scopeItems)
      ? parsed.scopeItems.filter(
          (item): item is string => typeof item === "string" && item.trim().length > 0
        )
      : [],
    rawText,
  };
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!GEMINI_API_KEY || GEMINI_API_KEY === "PASTE_GEMINI_KEY_HERE") {
    return NextResponse.json(
      { error: "Gemini API key not configured" },
      { status: 500 }
    );
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");

  try {
    const response = await fetch(GEMINI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                inline_data: {
                  mime_type: "application/pdf",
                  data: base64,
                },
              },
              {
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
        generationConfig: {
          maxOutputTokens: 2000,
          temperature: 0.1,
          responseMimeType: "application/json",
          responseJsonSchema: OCR_SCHEMA,
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      return NextResponse.json(
        { error: `OCR failed: ${errorData?.error?.message || response.statusText}` },
        { status: 500 }
      );
    }

    const data = await response.json();
    const content = extractGeminiText(data);

    let result: OcrResult;
    try {
      result = normalizeOcrResult(JSON.parse(content), content);
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
