import { toPage } from '@cesto/contracts';

export const pageArgs = (query) => ({ skip: (query.page - 1) * query.pageSize, take: query.pageSize });

export const paginate = async (query, load, map) => {
  const [rows, total] = await load(pageArgs(query));
  return toPage(rows.map(map), total, query.page, query.pageSize);
};

export const iso = (date) => date.toISOString();
export const isoOrNull = (date) => (date ? date.toISOString() : null);
