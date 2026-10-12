// Vite configuration for TanStack Start with React, Tailwind, and Nitro SSR
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  vite: {
    optimizeDeps: {
      // Reject old optimized modules rather than mixing two React dispatchers.
      ignoreOutdatedRequests: false,
      include: [
        "@tanstack/react-query",
        "@tanstack/react-router",
        "@radix-ui/react-dialog",
        "@radix-ui/react-slot",
        "@supabase/supabase-js",
        "lucide-react",
        "recharts",
        "sonner",
      ],
    },
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
