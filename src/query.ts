import { QueryClient, type QueryKey } from "@tanstack/react-query";

export const cacheTime = {
  live: 30_000,
  workspace: 60_000,
  search: 10 * 60_000,
  catalog: 24 * 60 * 60_000,
} as const;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: cacheTime.workspace,
      gcTime: 30 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  },
});

export async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof body?.error === "string" ? body.error : `Request failed (${response.status}).`;
    throw new Error(message);
  }
  return body as T;
}

export function cachedRequest<T>(queryKey: QueryKey, url: string, init?: RequestInit, staleTime: number = cacheTime.workspace) {
  return queryClient.fetchQuery({
    queryKey,
    queryFn: () => requestJson<T>(url, init),
    staleTime,
  });
}

export async function refreshRequest<T>(queryKey: QueryKey, url: string, init?: RequestInit) {
  await queryClient.invalidateQueries({ queryKey, exact: true });
  return cachedRequest<T>(queryKey, url, init, 0);
}
