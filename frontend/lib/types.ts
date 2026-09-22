export type RoomSize = {
  length_ft: number;
  width_ft: number;
  area_sqft?: number;
};

export type HouseDesign = {
  id: number;
  name: string;
  style: string;
  description: string;
  glb_url: string;
  model_url?: string;
  thumbnail_url?: string;
  gallery_images?: string[];
  recommended_min_plot: number;
  recommended_max_plot: number;
  min_plot_area_sqm?: number | null;
  max_plot_area_sqm?: number | null;
  recommended_width_m?: number | null;
  recommended_depth_m?: number | null;
  building_width_m?: number;
  building_depth_m?: number;
  building_height_m?: number;
  building_footprint_sqm?: number;
  bedrooms: number;
  bathrooms?: number;
  powder_rooms?: number;
  floors: number;
  living_rooms?: number;
  family_rooms?: number;
  dining_rooms?: number;
  drawing_rooms?: number;
  kitchens?: number;
  dirty_kitchens?: number;
  study_rooms?: number;
  parking_spaces?: number;
  parking_spaces_max?: number | null;
  balconies?: number;
  terraces?: number;
  garage?: boolean;
  pool?: boolean;
  garden?: boolean;
  parking: boolean;
  room_sizes?: Record<string, RoomSize>;
  estimated_cost_pkr: number;
  estimated_cost_min?: number | null;
  estimated_cost_max?: number | null;
  currency?: string;
  model_type?: "procedural" | "glb";
  model_config?: Record<string, unknown>;
  model_width_m?: number | null;
  model_depth_m?: number | null;
  model_height_m?: number | null;
  source_provider?: string;
  source_license?: string;
  source_attribution?: string;
  active?: boolean;
  room_program?: Record<string, number | boolean>;
  plot_range?: { min_sqm: number; max_sqm: number };
  match_reason?: string;
  compatibility?: "exact" | "nearby" | string;
};

export type ArchStyleCard = {
  id: string;
  name: string;
  description: string;
  traits: string[];
  preview_style: string;
};

export type Feasibility = {
  plot_area_sqm: number;
  building_footprint_sqm: number;
  remaining_area_sqm: number;
  ground_coverage_percent: number;
  building_width_m?: number;
  building_depth_m?: number;
  plot_length_m?: number | null;
  plot_width_m?: number | null;
  fits_rectangle?: boolean | null;
  status: string;
  note: string;
  disclaimer: string;
};

export type DesignMatchResponse = {
  plot_area_sqm: number;
  land_units: LandUnits;
  style: string | null;
  match_kind: "exact" | "nearby" | "all";
  exact: HouseDesign[];
  nearby: HouseDesign[];
  preliminary_space: Preliminary;
  planning_summary?: PlanningSummary;
  message?: string | null;
};

export type CostEstimate = {
  currency: string;
  quality: string;
  min: number;
  max: number;
  mid?: number;
  covered_area_m2?: number;
  covered_area_sqft?: number;
  built_area_m2?: number;
  built_area_sqft?: number;
  floors?: number;
  reference_rate_pkr_per_sqft?: number;
  source: string;
  is_estimate: boolean;
  estimate_type?: string;
  disclaimer?: string;
};

export type PlanningSummary = {
  plot?: {
    area_m2: number;
    area_sqft?: number;
    marla?: number;
    kanal?: number;
    acre?: number;
    display_label?: string;
  };
  planning?: {
    band?: string;
    band_label?: string;
    title?: string;
    recommended_floors?: number;
    covered_area_m2?: number;
    covered_area_sqft?: number;
    coverage_percent?: number;
    remaining_area_m2?: number;
    source?: string;
    room_sizes_source?: string;
  };
  room_program?: Record<string, number | boolean | null>;
  room_sizes?: Record<string, RoomSize>;
  cost_estimate?: CostEstimate;
  feasibility?: Feasibility;
  catalog_cost?: Record<string, unknown>;
  disclaimer?: string;
  estimate?: Record<string, string>;
};

export type LandUnits = {
  sqm: number;
  sqft?: number;
  marla: number;
  kanal: number;
  acre: number;
  display_unit: string;
  display_value: number;
  display_label: string;
};

export type Preliminary = {
  plot_area_sqm: number;
  estimate: Record<string, string>;
  disclaimer: string;
  planning?: PlanningSummary["planning"];
  room_program?: PlanningSummary["room_program"];
  room_sizes?: Record<string, RoomSize>;
  cost_estimate?: CostEstimate;
  plot?: PlanningSummary["plot"];
};

export type WorldPoint = { x: number; y: number; z: number };

export type Report = {
  id: number;
  project: number;
  narration_text: string;
  generated_at: string;
  updated_at?: string;
  source: string;
  model_name: string;
  warning?: string | null;
};

export type Project = {
  id: number;
  name?: string;
  land_size_sqm: number;
  plot_length_m?: number | null;
  plot_width_m?: number | null;
  measurement_type?: "ar" | "manual";
  land_size_display_unit: string;
  marla?: number | null;
  kanal?: number | null;
  acre?: number | null;
  preferred_style?: string;
  selected_house: HouseDesign | null;
  screenshot_url: string | null;
  plot_points: WorldPoint[];
  recommendation_reason: string;
  feasibility_snapshot?: Feasibility | Record<string, unknown>;
  feasibility?: Feasibility | null;
  created_at: string;
  updated_at?: string;
  land_units: LandUnits;
  latest_report: Report | null;
};

export type AuthUser = {
  id: number;
  username: string;
  email: string;
  date_joined?: string;
  last_login?: string | null;
};

export type RecommendResponse = {
  house: HouseDesign;
  reason: string;
  land_units: LandUnits;
  accuracy_disclaimer?: string;
};

export type HealthResponse = {
  ok: boolean;
  llm_configured: boolean;
  llm_model: string;
  accuracy_disclaimer?: string;
};

export const ACCURACY_DISCLAIMER =
  "This is an approximate planning measurement and is not a professional land survey. Large plots may accumulate AR tracking drift.";

export const UNIT_CAVEAT =
  "Marla / Kanal / Acre follow this app's configured Punjab-style constants (1 Marla ≈ 25.29 m²). Local legal conventions may differ.";
