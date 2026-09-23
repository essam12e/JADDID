export type ExtractedProduct = {
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  price?: number | null;
  currency?: string | null;
  sourceUrl: string;
  category?: string | null;
  isAvailable?: boolean | null;
  /** Stable identifier for duplicate detection across re-imports. */
  fingerprint: string;
};

export type AdapterResult =
  | { ok: true; products: ExtractedProduct[] }
  | { ok: false; reason: string };

export interface StoreImporter {
  /** A short machine name, used in logs/import_jobs metadata. */
  readonly name: string;
  /** Cheap check: does this adapter look applicable to this URL/host? */
  canHandle(url: URL): boolean;
  /** Attempt extraction. May throw; callers should catch. */
  extract(url: URL): Promise<AdapterResult>;
}
