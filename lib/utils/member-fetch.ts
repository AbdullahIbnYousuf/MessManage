// All member API calls carry the identity of the screen that issued them, not a cookie-selected target.
let screenContext: string | undefined;
let changing = false;
const pending = new Set<AbortController>();

export function stopMemberRequests() {
  changing = true;
  for (const controller of pending) controller.abort();
}

export async function memberFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (typeof window === "undefined") return globalThis.fetch(input, init);
  const url = new URL(input instanceof Request ? input.url : String(input), window.location.href);
  if (url.origin !== window.location.origin || !url.pathname.startsWith("/api/")) return globalThis.fetch(input, init);
  if (changing) throw new Error("Account context is changing. Reload before continuing.");
  screenContext ??= document.documentElement.dataset.mmContext ?? "self";
  const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
  headers.set("x-mm-context", screenContext);
  const controller = new AbortController();
  pending.add(controller);
  const signal = init?.signal ?? (input instanceof Request ? input.signal : null);
  const abort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener("abort", abort, { once: true });
  try { return await globalThis.fetch(input, { ...init, headers, signal: controller.signal, cache: "no-store" }); }
  finally { pending.delete(controller); signal?.removeEventListener("abort", abort); }
}

export function returnToAccountScreen(destination: string) {
  stopMemberRequests();
  localStorage.setItem("mm-account-change", crypto.randomUUID());
  window.location.assign(destination);
}
