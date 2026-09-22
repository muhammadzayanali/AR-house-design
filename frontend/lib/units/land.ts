/**
 * Pakistan land-unit conversions (must match backend/planning/units.py).
 *
 * 1 Marla = 272.25 sq ft = 25.29285264 m²
 * 1 Kanal = 20 Marla
 * 1 Acre  = 160 Marla (Punjab)
 */
export const MARLA_SQM = 25.29285264;
export const KANAL_SQM = MARLA_SQM * 20;
export const ACRE_SQM = MARLA_SQM * 160;
export const SQM_TO_SQFT = 10.76391041671;

export function sqmToUnits(areaSqm: number) {
  const area = Math.max(areaSqm, 0);
  const marla = area / MARLA_SQM;
  const kanal = area / KANAL_SQM;
  const acre = area / ACRE_SQM;
  const sqft = area * SQM_TO_SQFT;
  let display_unit = "sqm";
  let display_value = area;
  if (area >= KANAL_SQM) {
    display_unit = "kanal";
    display_value = kanal;
  } else if (area >= MARLA_SQM) {
    display_unit = "marla";
    display_value = marla;
  }
  const display_label =
    display_unit === "kanal"
      ? `${kanal.toFixed(2)} Kanal (${area.toFixed(1)} m²)`
      : display_unit === "marla"
        ? `${marla.toFixed(2)} Marla (${area.toFixed(1)} m²)`
        : `${area.toFixed(1)} m²`;
  return {
    sqm: Math.round(area * 100) / 100,
    sqft: Math.round(sqft * 10) / 10,
    marla: Math.round(marla * 1000) / 1000,
    kanal: Math.round(kanal * 10000) / 10000,
    acre: Math.round(acre * 100000) / 100000,
    display_unit,
    display_value: Math.round(display_value * 1000) / 1000,
    display_label,
  };
}

export function formatPkr(value: number) {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 0,
  }).format(value);
}
