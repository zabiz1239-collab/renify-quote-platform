import { describe, expect, it } from "vitest";
import {
  DEFAULT_ATTACHMENT_CATEGORIES,
  getSelectedDocumentsForSupplier,
  normalizeAttachmentPreferences,
  pruneAttachmentPreferences,
} from "@/lib/attachments";
import type { JobDocument, Supplier } from "@/types";

const documents: JobDocument[] = [
  {
    category: "architectural",
    name: "Plans.pdf",
    type: "upload",
    fileName: "Plans.pdf",
    storagePath: "JOB01/architectural/Plans.pdf",
  },
  {
    category: "engineering",
    name: "Engineering.pdf",
    type: "upload",
    fileName: "Engineering.pdf",
    storagePath: "JOB01/engineering/Engineering.pdf",
  },
  {
    category: "scope",
    name: "Inclusions.pdf",
    type: "upload",
    fileName: "Inclusions.pdf",
    storagePath: "JOB01/scope/Inclusions.pdf",
  },
];

const supplier: Pick<Supplier, "attachmentPreferences"> = {
  attachmentPreferences: {
    "110": ["architectural", "scope"],
  },
};

describe("attachment preferences", () => {
  it("defaults to every document category when a trade has no preference", () => {
    const selected = getSelectedDocumentsForSupplier(documents, supplier, ["115"]);
    expect(selected).toHaveLength(documents.length);
    expect(DEFAULT_ATTACHMENT_CATEGORIES).toContain("engineering");
  });

  it("filters documents by supplier cost-centre defaults", () => {
    const selected = getSelectedDocumentsForSupplier(documents, supplier, ["110"]);
    expect(selected.map((doc) => doc.category)).toEqual(["architectural", "scope"]);
  });

  it("keeps an explicit empty override as no attachments", () => {
    const selected = getSelectedDocumentsForSupplier(documents, supplier, ["110"], []);
    expect(selected).toEqual([]);
  });

  it("normalizes invalid persisted categories", () => {
    const normalized = normalizeAttachmentPreferences({
      "110": ["architectural", "bad-category", "scope", "scope"],
      "115": "engineering",
    });
    expect(normalized).toEqual({
      "110": ["architectural", "scope"],
    });
  });

  it("prunes preferences for removed cost centres", () => {
    const pruned = pruneAttachmentPreferences(
      {
        "110": ["architectural"],
        "115": ["engineering"],
      },
      ["115"]
    );
    expect(pruned).toEqual({ "115": ["engineering"] });
  });
});
