import { toPage } from '@cesto/contracts';
import type { PageQuery, Paginated } from '@cesto/contracts';

export const pageArgs = (query: PageQuery) => ({ skip: (query.page - 1) * query.pageSize, take: query.pageSize });

export const paginate = async <Row, Dto>(
  query: PageQuery,
  load: (args: { skip: number; take: number }) => Promise<[Row[], number]>,
  map: (row: Row) => Dto
): Promise<Paginated<Dto>> => {
  const [rows, total] = await load(pageArgs(query));
  return toPage(rows.map(map), total, query.page, query.pageSize);
};

export const iso = (date: Date): string => date.toISOString();
export const isoOrNull = (date: Date | null | undefined): string | null => (date ? date.toISOString() : null);
