export type CollectionRequestOptions = {
  method: string;
  headers: Record<string, string>;
  body?: string;
  redirect: "manual";
};
export type CollectionResponse = {
  status: number;
  headers: { get(name: string): string | null };
  json(): Promise<unknown>;
  body?: { cancel(): Promise<void> } | null;
};
export function runCollectionSmoke(
  baseUrl: string,
  request?: (
    url: string,
    options: CollectionRequestOptions,
  ) => Promise<CollectionResponse>,
  authenticated?: boolean,
): Promise<Array<{ operation: string; status: number }>>;
