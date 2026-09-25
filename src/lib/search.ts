/**
 * Makes a user's search term safe to put inside a PostgREST `or()` filter.
 *
 * `or("name.ilike.%TERM%,phone.ilike.%TERM%")` is a small expression
 * language, not a parameter. A term containing a comma, a parenthesis or
 * a dot adds branches to that expression — `x,is_archived.eq.true` turns
 * one filter into two, and `x)` can close the group early. Row-level
 * security still confines the result to the caller's own organisation,
 * so this is not a data-theft hole, but a filter the user can rewrite is
 * a filter that no longer means what the page says it means.
 *
 * Everything the grammar treats as punctuation is removed, and the
 * result is length-capped so a pathological term can't build a huge
 * expression.
 */
const FILTER_PUNCTUATION = /[,()".\\*:]/g;

export function escapeSearchTerm(raw: string, maxLength = 60): string {
  return raw
    .replace(FILTER_PUNCTUATION, " ")
    // `%` and `_` are ILIKE wildcards: harmless, but a term of "%%%" is a
    // scan of the whole table dressed up as a search.
    .replace(/[%_]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}
