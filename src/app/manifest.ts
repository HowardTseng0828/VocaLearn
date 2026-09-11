import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "VocaLearn 英文單字學習",
    short_name: "VocaLearn",
    description: "高中 7000 單字與口說練習",
    start_url: "/",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#58cc02",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png", purpose: "any" },
    ],
  };
}
