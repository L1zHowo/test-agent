export function escapeSqlLiteral(value: unknown): string {
  return String(value).replace(/'/g, "''");
}

export function metadataMatchCondition(key: string, value: unknown): string {
  return `(metadata::jsonb)->>'${escapeSqlLiteral(key)}' = '${escapeSqlLiteral(value)}'`;
}

export function metadataInCondition(key: string, values: unknown[]): string {
  const valueList = values.map((value) => `'${escapeSqlLiteral(value)}'`).join(',');
  return `(metadata::jsonb)->>'${escapeSqlLiteral(key)}' IN (${valueList})`;
}

export function metadataRangeConditions(
  key: string,
  range: { gte?: number; lte?: number },
): string[] {
  const expression = `(metadata::jsonb)->>'${escapeSqlLiteral(key)}'`;
  const conditions: string[] = [];
  if (range.gte !== undefined) conditions.push(`(${expression})::numeric >= ${range.gte}`);
  if (range.lte !== undefined) conditions.push(`(${expression})::numeric <= ${range.lte}`);
  return conditions;
}
