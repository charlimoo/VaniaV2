import type { MetadataRoute } from "next";

import { APP_CONFIG } from "@/lib/config";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_CONFIG.BRANDING.APP_NAME,
    short_name: APP_CONFIG.BRANDING.APP_NAME,
    description: APP_CONFIG.BRANDING.APP_TAGLINE,
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#0f1720",
    theme_color: "#0f1720",
    icons: [
      {
        src: APP_CONFIG.IMAGES.LOGO_ICON,
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: APP_CONFIG.IMAGES.LOGO_ICON,
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
