import { supabase } from '@/integrations/supabase/client';

const PAGE_SIZE = 1000;

/**
 * Fetches all rows from a Supabase query by paginating through results.
 * PostgREST caps results at 1000 rows per request regardless of .limit(),
 * so this function fetches in batches using .range().
 */
export async function fetchAllRows<T>(
  queryBuilder: () => ReturnType<ReturnType<typeof supabase.from>['select']>
): Promise<T[]> {
  const allRows: T[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await queryBuilder().range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allRows.push(...(data as T[]));
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return allRows;
}
