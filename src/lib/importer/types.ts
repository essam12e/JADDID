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

/** What a caller can ask of a crawl. */
export type ImportOptions = {
  /**
   * Epoch-ms wall-clock budget. A store with hundreds of products takes
   * hundreds of fetches, and a serverless function that runs out of time
   * returns nothing at all — so the crawl stops itself while it still
   * has something to hand back.
   */
  deadline?: number;
  /**
   * Source URLs already stored for this store. Skipped so a second run
   * continues from where a budget-limited first run stopped instead of
   * re-reading the same pages forever.
   */
  knownSourceUrls?: ReadonlySet<string>;
  /** Hard ceiling on pages opened, whatever the budget allows. */
  maxPages?: number;
  /**
   * Ceiling on outbound requests per second. Exists so tests can crawl
   * without waiting out the pacing; production leaves it unset and uses
   * the adapter's own, politer, default.
   */
  maxRequestsPerSecond?: number;
};

export type AdapterResult =
  | {
      ok: true;
      products: ExtractedProduct[];
      /** True when the crawl stopped early and more products remain. */
      partial?: boolean;
      /** How many product pages were still queued when it stopped. */
      remaining?: number;
      /** The store answered 429 at some point and the crawl slowed down. */
      rateLimited?: boolean;
    }
  | { ok: false; reason: string };

export interface StoreImporter {
  /** A short machine name, used in logs/import_jobs metadata. */
  readonly name: string;
  /** Cheap check: does this adapter look applicable to this URL/host? */
  canHandle(url: URL): boolean;
  /** Attempt extraction. May throw; callers should catch. */
  extract(url: URL, options?: ImportOptions): Promise<AdapterResult>;
}
