import type { Sql } from 'postgres';
export function backfillKnowledge(connection: Sql): Promise<{ repaired: number; changed: number }>;
