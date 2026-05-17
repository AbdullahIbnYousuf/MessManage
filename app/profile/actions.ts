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

export async function updateContactInfo(formData: FormData) {
  const user = await requireAuth();
  
  const phoneNumber = formData.get("phoneNumber")?.toString().trim() || null;
  const phoneNumber2 = formData.get("phoneNumber2")?.toString().trim() || null;
  const bkashNumber = formData.get("bkashNumber")?.toString().trim() || null;
  const bankName = formData.get("bankName")?.toString().trim() || null;
  const bankAccountNumber = formData.get("bankAccountNumber")?.toString().trim() || null;
  const emergencyContactName = formData.get("emergencyContactName")?.toString().trim() || null;
  const emergencyContactPhone = formData.get("emergencyContactPhone")?.toString().trim() || null;
  const emergencyContactRelation = formData.get("emergencyContactRelation")?.toString().trim() || null;

  await db.user.update({
    where: { id: user.id },
    data: {
      phoneNumber,
      phoneNumber2,
      bkashNumber,
      bankName,
      bankAccountNumber,
      emergencyContactName,
      emergencyContactPhone,
      emergencyContactRelation,
    },
  });
  
  revalidatePath("/profile");
  revalidatePath(`/members/${user.id}`);
}
