import React, { ReactNode } from "react";
import { ConvexProvider, ConvexReactClient } from "convex/react";

const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL || "https://loyal-leopard-468.convex.cloud";
const convex = new ConvexReactClient(convexUrl, {
    unsavedChangesWarning: false,
});

// Create a provider component
export function ConvexClientProvider({ children }: { children: ReactNode }) {
    return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
