const PAGE = 1000;

type PageResult<T> = { data: T[] | null; error: { message: string } | null };

/**
 * Read every matching row. PostgREST stops at 1,000 rows per response, so a
 * single .limit() silently drops the rest.
 */
export async function fetchAllRows<T>(
  query: (from: number, to: number) => PromiseLike<PageResult<T>>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; from <= 500_000; from += PAGE) {
    const { data, error } = await query(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < PAGE) return rows;
  }
  throw new Error("Query exceeded 500,000 rows");
}

/** `.in()` filters blow the request URL once the id list gets long. */
export async function fetchInChunks<T>(
  ids: string[],
  query: (chunk: string[]) => PromiseLike<PageResult<T>>,
): Promise<T[]> {
  if (!ids.length) return [];
  const rows: T[] = [];
  const size = 100;
  for (let i = 0; i < ids.length; i += size) {
    const { data, error } = await query(ids.slice(i, i + size));
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
  }
  return rows;
}
