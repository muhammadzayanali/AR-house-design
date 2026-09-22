import { api } from "@/lib/api";
import type { HouseDesign, RecommendResponse, WorldPoint } from "@/lib/types";

const DRAFT_KEY = "plotline.projectDraft.v2";
const LEGACY_KEYS = ["plotline.projectDraft"];

export type ProjectDraft = {
  recommendation: RecommendResponse;
  points: WorldPoint[];
  lengthM: string;
  widthM: string;
  manualSqm: number | null;
  preferredStyle?: string | null;
  savedAt: number;
};

function wipeLegacyDrafts() {
  if (typeof window === "undefined") return;
  for (const key of LEGACY_KEYS) window.localStorage.removeItem(key);
}

export function saveProjectDraft(draft: Omit<ProjectDraft, "savedAt">) {
  if (typeof window === "undefined") return;
  wipeLegacyDrafts();
  const payload: ProjectDraft = { ...draft, savedAt: Date.now() };
  window.localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
}

export function loadProjectDraft(): ProjectDraft | null {
  if (typeof window === "undefined") return null;
  wipeLegacyDrafts();
  const raw = window.localStorage.getItem(DRAFT_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ProjectDraft;
    if (!parsed?.recommendation?.house?.id) return null;
    if (Date.now() - (parsed.savedAt || 0) > 24 * 60 * 60 * 1000) {
      clearProjectDraft();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearProjectDraft() {
  if (typeof window === "undefined") return;
  wipeLegacyDrafts();
  window.localStorage.removeItem(DRAFT_KEY);
}

/** Ensure draft house still exists and is active; refresh from API or clear. */
export async function resolveValidDraft(): Promise<ProjectDraft | null> {
  const draft = loadProjectDraft();
  if (!draft) return null;
  const houseId = draft.recommendation.house.id;
  try {
    const house = await api<HouseDesign>(`/api/houses/${houseId}/`);
    if (!house.active && house.active !== undefined) {
      clearProjectDraft();
      return null;
    }
    return {
      ...draft,
      recommendation: { ...draft.recommendation, house },
    };
  } catch {
    // Inactive / deleted — try resolve by name among active catalog
    try {
      const list = await api<HouseDesign[]>("/api/houses/");
      const name = draft.recommendation.house.name;
      const style = draft.recommendation.house.style;
      const match =
        list.find((h) => h.name === name) ||
        list.find(
          (h) =>
            h.style === style &&
            Math.abs(
              (h.min_plot_area_sqm ?? h.recommended_min_plot) -
                (draft.recommendation.house.min_plot_area_sqm ??
                  draft.recommendation.house.recommended_min_plot),
            ) < 1,
        ) ||
        list.find((h) => h.name.replace(/\s+Home$/, "") === name.replace(/\s+Home$/, ""));
      if (!match) {
        clearProjectDraft();
        return null;
      }
      const refreshed: ProjectDraft = {
        ...draft,
        recommendation: {
          ...draft.recommendation,
          house: match,
          reason: `Restored selection as '${match.name}' for ${draft.recommendation.land_units.display_label}.`,
        },
        preferredStyle: draft.preferredStyle || match.style,
      };
      saveProjectDraft(refreshed);
      return refreshed;
    } catch {
      clearProjectDraft();
      return null;
    }
  }
}
