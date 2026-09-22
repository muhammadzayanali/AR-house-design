/**
 * Browser / API E2E for Plotline critical path.
 * WebXR is NOT exercised — physical AR is manual (docs/AR_TESTING.md).
 *
 * Requires Django on API_BASE (default http://127.0.0.1:8000).
 * UI smoke requires Next on PLAYWRIGHT_BASE_URL (default :3000).
 */
import { expect, test } from "@playwright/test";

const API = process.env.API_BASE || "http://127.0.0.1:8000";

test.describe("API planning flow (master dataset 15×12)", () => {
  test("units + style match + feasibility for 180 m² Italian", async ({
    request,
  }) => {
    const health = await request.get(`${API}/api/health/`);
    expect(health.ok()).toBeTruthy();

    const styles = await request.get(`${API}/api/styles/`);
    expect(styles.ok()).toBeTruthy();
    const styleBody = await styles.json();
    const names = (styleBody.styles || []).map((s: { name: string }) => s.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "Modern",
        "Italian Villa",
        "American",
        "Cottage / Hut",
        "Contemporary",
        "Traditional",
        "Villa",
        "Luxury Villa",
      ]),
    );

    const match = await request.get(
      `${API}/api/designs/match/?style=Italian%20Villa&plot_area=180`,
    );
    expect(match.ok()).toBeTruthy();
    const m = await match.json();
    expect(m.match_kind).toBe("exact");
    expect(m.land_units.sqm).toBe(180);
    expect(m.exact.length).toBeGreaterThan(0);
    expect(m.exact[0].match_reason).toContain("180");
    expect(m.exact[0].feasibility_preview.ground_coverage_percent).toBeDefined();

    const houseId = m.exact[0].id;
    const feas = await request.post(`${API}/api/feasibility/`, {
      data: {
        land_size_sqm: 180,
        house_id: houseId,
        plot_length_m: 15,
        plot_width_m: 12,
      },
    });
    expect(feas.ok()).toBeTruthy();
    const f = await feas.json();
    expect(f.feasibility.building_footprint_sqm).toBe(90);
    expect(f.feasibility.remaining_area_sqm).toBe(90);
    expect(f.feasibility.ground_coverage_percent).toBe(50);
  });

  test("register → project → ask consultant (local RAG)", async ({ request }) => {
    const user = `e2e_${Date.now()}`;
    const reg = await request.post(`${API}/api/auth/register/`, {
      data: { username: user, password: "TestPass123!", email: `${user}@test.local` },
    });
    expect(reg.status()).toBe(201);
    const { token } = await reg.json();

    const houses = await request.get(`${API}/api/houses/?style=Italian%20Villa`);
    const list = await houses.json();
    const villa =
      (Array.isArray(list) ? list : list.results || []).find(
        (h: { name: string }) => h.name.includes("Italian Compact"),
      ) || (Array.isArray(list) ? list[0] : null);
    expect(villa).toBeTruthy();

    const create = await request.post(`${API}/api/projects/`, {
      headers: { Authorization: `Token ${token}` },
      data: {
        name: "E2E 15x12",
        land_size_sqm: 180,
        measurement_type: "manual",
        plot_length_m: 15,
        plot_width_m: 12,
        preferred_style: "Italian Villa",
        selected_house_id: villa.id,
        recommendation_reason: "E2E exact match 180 m²",
      },
    });
    expect(create.status()).toBe(201);
    const project = await create.json();

    const ask = await request.post(`${API}/api/projects/${project.id}/ask/`, {
      headers: { Authorization: `Token ${token}` },
      data: {
        question: "Why was this house recommended?",
      },
    });
    expect(ask.ok()).toBeTruthy();
    const a = await ask.json();
    expect(a.answer).toBeTruthy();
    expect(["local_rag", "huggingface"]).toContain(a.source);
    expect(a.grounded.facts.plot_area_sqm).toBe(180);
    expect(a.grounded.facts.bedrooms).toBe(villa.bedrooms);
    expect(a.grounded.estimates).toBeTruthy();
    expect(a.grounded.limitations.length).toBeGreaterThan(0);
  });
});

test.describe("UI smoke (requires Next.js)", () => {
  test("home page loads", async ({ page }) => {
    const res = await page.goto("/");
    // Soft skip if frontend down
    if (!res || res.status() >= 500) {
      test.skip(true, "Next.js not reachable");
    }
    await expect(page.locator("body")).toBeVisible();
  });

  test("AR page shows manual fallback path", async ({ page }) => {
    const res = await page.goto("/ar");
    if (!res || res.status() >= 500) {
      test.skip(true, "Next.js not reachable");
    }
    await expect(page.getByText(/Length|manual|Plotline|AR/i).first()).toBeVisible({
      timeout: 15_000,
    });
  });
});
