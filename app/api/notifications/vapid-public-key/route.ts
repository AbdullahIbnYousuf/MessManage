import { getVapidPublicKey } from "@/lib/utils/push";

export const runtime = "nodejs";

export async function GET() {
  const publicKey = getVapidPublicKey();
  if (!publicKey) {
    return Response.json(
      { error: "Push notifications are not configured." },
      { status: 503 }
    );
  }

  return Response.json({ data: { publicKey } });
}
