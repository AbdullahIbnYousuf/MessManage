import { addPaymentAttribution } from "@/lib/queries/payment-attribution";

export function withPaymentAttribution<T extends (...args: never[]) => Promise<Response>>(handler: T): T {
  return (async (...args: unknown[]) => {
    const response = await (handler as unknown as (...values: unknown[]) => Promise<Response>)(...args);
    if (!response.ok) return response;
    try {
      const payload = await response.json() as { data?: unknown };
      await addPaymentAttribution(payload.data);
      return Response.json(payload, { status: response.status, headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      console.error("Payment attribution unavailable", error);
      return Response.json({ error: "Could not load payment attribution. Please retry." }, { status: 500 });
    }
  }) as unknown as T;
}
