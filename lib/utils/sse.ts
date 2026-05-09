// SSE stream helpers — used by app/api/sse/route.ts

export type SSEEvent =
  | "meal_updated"
  | "bazar_trip_opened"
  | "bazar_trip_completed"
  | "shopping_notes_updated"
  | "balance_updated";

/** Encodes a single SSE message frame */
export function encodeSSE(event: SSEEvent, data: unknown): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(
    `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  );
}

/** Returns the standard SSE response headers */
export function sseHeaders(): HeadersInit {
  return {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  };
}
