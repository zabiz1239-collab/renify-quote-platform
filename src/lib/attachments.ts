import type {
  AttachmentPreferences,
  JobDocument,
  JobDocumentCategory,
  Supplier,
} from "@/types";

export const ATTACHMENT_CATEGORIES: {
  key: JobDocumentCategory;
  label: string;
}[] = [
  { key: "architectural", label: "Plans" },
  { key: "engineering", label: "Engineering" },
  { key: "scope", label: "Inclusions" },
  { key: "colour_selection", label: "Colour Selection" },
  { key: "energy_rating", label: "Energy Rating" },
  { key: "other", label: "Other" },
];

export const DEFAULT_ATTACHMENT_CATEGORIES = ATTACHMENT_CATEGORIES.map(
  (category) => category.key
);

const VALID_ATTACHMENT_CATEGORIES = new Set<JobDocumentCategory>(
  DEFAULT_ATTACHMENT_CATEGORIES
);

export function getAttachmentCategoryLabel(category: JobDocumentCategory): string {
  return (
    ATTACHMENT_CATEGORIES.find((item) => item.key === category)?.label ||
    category.replace(/_/g, " ")
  );
}

export function isJobDocumentCategory(value: unknown): value is JobDocumentCategory {
  return typeof value === "string" && VALID_ATTACHMENT_CATEGORIES.has(value as JobDocumentCategory);
}

export function normalizeAttachmentPreferences(value: unknown): AttachmentPreferences {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const preferences: AttachmentPreferences = {};
  for (const [tradeCode, categories] of Object.entries(value)) {
    if (!Array.isArray(categories)) continue;

    const validCategories = categories.filter(isJobDocumentCategory);
    preferences[tradeCode] = Array.from(new Set(validCategories));
  }

  return preferences;
}

export function getAttachmentPreferenceCategories(
  supplier: Pick<Supplier, "attachmentPreferences">,
  tradeCode: string
): JobDocumentCategory[] {
  const configured = supplier.attachmentPreferences?.[tradeCode];
  return Array.isArray(configured)
    ? configured.filter(isJobDocumentCategory)
    : DEFAULT_ATTACHMENT_CATEGORIES;
}

export function pruneAttachmentPreferences(
  preferences: AttachmentPreferences | undefined,
  tradeCodes: string[]
): AttachmentPreferences {
  const normalized = normalizeAttachmentPreferences(preferences);
  const allowed = new Set(tradeCodes);
  return Object.fromEntries(
    Object.entries(normalized).filter(([tradeCode]) => allowed.has(tradeCode))
  );
}

export function getJobDocumentKey(doc: JobDocument, index: number): string {
  return [
    doc.category,
    doc.storagePath || doc.fileName || doc.url || doc.name,
    String(index),
  ].join("::");
}

export function getSelectedDocumentsForSupplier(
  documents: JobDocument[],
  supplier: Pick<Supplier, "attachmentPreferences">,
  tradeCodes: string[],
  selectedDocumentKeys?: string[]
): JobDocument[] {
  if (selectedDocumentKeys) {
    const selected = new Set(selectedDocumentKeys);
    return documents.filter((doc, index) => selected.has(getJobDocumentKey(doc, index)));
  }

  const selectedCategories = new Set<JobDocumentCategory>();
  for (const tradeCode of tradeCodes) {
    for (const category of getAttachmentPreferenceCategories(supplier, tradeCode)) {
      selectedCategories.add(category);
    }
  }

  return documents.filter((doc) => selectedCategories.has(doc.category));
}
