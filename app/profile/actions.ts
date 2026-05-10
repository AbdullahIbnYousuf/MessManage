"use server";

import { db } from "@/lib/db";
import { requireAuth } from "@/lib/session";
import { revalidatePath } from "next/cache";

export async function updateNickname(formData: FormData) {
  const user = await requireAuth();
  
  const nickname = formData.get("nickname")?.toString().trim() || null;
  
  await db.user.update({
    where: { id: user.id },
    data: { nickname },
  });
  
  revalidatePath("/");
  revalidatePath("/profile");
}
