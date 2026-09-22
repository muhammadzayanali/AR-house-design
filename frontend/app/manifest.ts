import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Plotline Architectural Assistant",
    short_name: "Plotline",
    description:
      "On-site plot measurement, AR house visualization, and AI-narrated reports.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4efe6",
    theme_color: "#14110e",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
