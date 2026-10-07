"use client";

import { createContext, useContext } from "react";
import type { ActingSessionView } from "@/types/acting";

const ActingIdentity = createContext<ActingSessionView | null>(null);
export const useActingIdentity = () => useContext(ActingIdentity);
export default function ActingIdentityProvider({ acting, children }: { acting: ActingSessionView | null; children: React.ReactNode }) {
  return <ActingIdentity.Provider value={acting}>{children}</ActingIdentity.Provider>;
}
