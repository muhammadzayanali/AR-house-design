import type { HouseDesign, LandUnits } from "@/lib/types";

export async function makeSummaryCard(options: {
  house?: HouseDesign | null;
  units: LandUnits;
}): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = 960;
  canvas.height = 540;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D unavailable");

  ctx.fillStyle = "#14110e";
  ctx.fillRect(0, 0, 960, 540);
  ctx.fillStyle = "#b0893e";
  ctx.fillRect(0, 0, 16, 540);

  ctx.fillStyle = "#f4efe6";
  ctx.font = "600 28px Georgia";
  ctx.fillText("Plotline", 48, 64);
  ctx.font = "28px Georgia";
  ctx.fillText(options.units.display_label, 48, 160);
  ctx.font = "22px system-ui";
  ctx.fillStyle = "#cfc4b0";
  ctx.fillText(options.house?.name ?? "No house selected", 48, 230);
  ctx.fillText(options.house?.style ?? "", 48, 268);
  if (options.house) {
    ctx.fillText(
      `${options.house.floors} floor(s) · ${options.house.bedrooms} bedrooms · parking ${options.house.parking ? "yes" : "no"}`,
      48,
      320,
    );
  }
  ctx.fillText(new Date().toLocaleString("en-PK"), 48, 480);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Failed to encode screenshot"));
    }, "image/png");
  });
}
