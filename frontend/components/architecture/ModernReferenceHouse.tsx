"use client";

/**
 * High-quality Modern massing aimed at docs/reference/house-reference.png.
 * Metres, origin at footprint centre, y=0 ground, facing +Z.
 * Labeled in UI as generated architectural massing (not a photoreal scan).
 */

import { useMemo } from "react";
import {
  DoubleSide,
  ExtrudeGeometry,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Shape,
  ShapeGeometry,
  type Material,
} from "three";

import type { HouseConfig } from "./materials";

function M({
  position,
  args,
  material,
  castShadow = true,
  receiveShadow = true,
  rotation,
}: {
  position: [number, number, number];
  args: [number, number, number];
  material: Material;
  castShadow?: boolean;
  receiveShadow?: boolean;
  rotation?: [number, number, number];
}) {
  return (
    <mesh
      position={position}
      rotation={rotation}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
      material={material}
    >
      <boxGeometry args={args} />
    </mesh>
  );
}

/** Wall slab with punched window openings (Shape + Extrude — no CSG). */
function PunchedFacade({
  width,
  height,
  thickness,
  openings,
  wallMat,
  position,
  rotationY = 0,
}: {
  width: number;
  height: number;
  thickness: number;
  openings: Array<{ x: number; y: number; w: number; h: number }>;
  wallMat: Material;
  position: [number, number, number];
  rotationY?: number;
}) {
  const geom = useMemo(() => {
    const shape = new Shape();
    const hw = width / 2;
    shape.moveTo(-hw, 0);
    shape.lineTo(hw, 0);
    shape.lineTo(hw, height);
    shape.lineTo(-hw, height);
    shape.closePath();
    for (const o of openings) {
      const hole = new Shape();
      const x0 = o.x - o.w / 2;
      const y0 = o.y - o.h / 2;
      hole.moveTo(x0, y0);
      hole.lineTo(x0 + o.w, y0);
      hole.lineTo(x0 + o.w, y0 + o.h);
      hole.lineTo(x0, y0 + o.h);
      hole.closePath();
      shape.holes.push(hole);
    }
    const g = new ExtrudeGeometry(shape, {
      depth: thickness,
      bevelEnabled: false,
    });
    g.translate(0, 0, -thickness / 2);
    g.computeVertexNormals();
    return g;
  }, [width, height, thickness, openings]);

  return (
    <mesh
      position={position}
      rotation={[0, rotationY, 0]}
      geometry={geom}
      material={wallMat}
      castShadow
      receiveShadow
    />
  );
}

function GlassPanel({
  position,
  args,
  glass,
  frame,
  frameT = 0.04,
}: {
  position: [number, number, number];
  args: [number, number, number];
  glass: Material;
  frame: Material;
  frameT?: number;
}) {
  const [w, h, d] = args;
  return (
    <group position={position}>
      <M position={[0, 0, 0]} args={[w, h, d * 0.4]} material={glass} castShadow={false} />
      {/* Slim dark mullions */}
      <M position={[0, h / 2 - frameT / 2, d * 0.15]} args={[w + frameT, frameT, frameT]} material={frame} castShadow={false} />
      <M position={[0, -h / 2 + frameT / 2, d * 0.15]} args={[w + frameT, frameT, frameT]} material={frame} castShadow={false} />
      <M position={[-w / 2 + frameT / 2, 0, d * 0.15]} args={[frameT, h, frameT]} material={frame} castShadow={false} />
      <M position={[w / 2 - frameT / 2, 0, d * 0.15]} args={[frameT, h, frameT]} material={frame} castShadow={false} />
      <M position={[0, 0, d * 0.15]} args={[frameT * 0.8, h, frameT]} material={frame} castShadow={false} />
      <M position={[0, 0, d * 0.15]} args={[w, frameT * 0.8, frameT]} material={frame} castShadow={false} />
    </group>
  );
}

function GlassRailing({
  width,
  z,
  y,
  glass,
  rail,
}: {
  width: number;
  z: number;
  y: number;
  glass: Material;
  rail: Material;
}) {
  return (
    <group position={[0, y, z]}>
      <M position={[0, 0.55, 0]} args={[width, 1.05, 0.03]} material={glass} castShadow={false} />
      <M position={[0, 1.08, 0]} args={[width + 0.04, 0.04, 0.05]} material={rail} castShadow={false} />
      <M position={[-width / 2, 0.55, 0]} args={[0.04, 1.1, 0.04]} material={rail} castShadow={false} />
      <M position={[width / 2, 0.55, 0]} args={[0.04, 1.1, 0.04]} material={rail} castShadow={false} />
    </group>
  );
}

/** Lawn from a correctly wound shape (measured polygon or a padded rectangle). */
function PlotGround({
  width,
  depth,
  polygon,
  material,
}: {
  width: number;
  depth: number;
  polygon?: Array<{ x: number; z: number }>;
  material: Material;
}) {
  const geom = useMemo(() => {
    const pad = 3.2;
    const raw =
      polygon && polygon.length >= 3
        ? polygon
        : [
            { x: -width / 2 - pad, z: -depth / 2 - pad },
            { x: width / 2 + pad + 1.2, z: -depth / 2 - pad },
            { x: width / 2 + pad + 1.2, z: depth / 2 + pad + 1.4 },
            { x: -width / 2 - pad, z: depth / 2 + pad + 1.4 },
          ];
    const mapped = raw.map((p) => ({ x: p.x, y: -p.z }));
    let area = 0;
    for (let i = 0; i < mapped.length; i++) {
      const a = mapped[i];
      const b = mapped[(i + 1) % mapped.length];
      area += a.x * b.y - b.x * a.y;
    }
    const ordered = area < 0 ? [...mapped].reverse() : mapped;
    const shape = new Shape();
    shape.moveTo(ordered[0].x, ordered[0].y);
    for (let i = 1; i < ordered.length; i++) shape.lineTo(ordered[i].x, ordered[i].y);
    shape.closePath();
    const g = new ShapeGeometry(shape);
    g.rotateX(-Math.PI / 2);
    g.computeVertexNormals();
    return g;
  }, [width, depth, polygon]);

  return <mesh geometry={geom} material={material} receiveShadow position={[0, 0.02, 0]} />;
}

function SiteDressing({
  width,
  depth,
  polygon,
  grass,
  concrete,
  dark,
}: {
  width: number;
  depth: number;
  polygon?: Array<{ x: number; z: number }>;
  grass: Material;
  concrete: Material;
  dark: Material;
}) {
  const hw = width / 2 + 3.2;
  const hd = depth / 2 + 3.2;
  const wallH = 1.15;
  const gateW = 2.6;
  return (
    <group>
      <PlotGround width={width} depth={depth} polygon={polygon} material={grass} />
      {/* Raised kerb */}
      <M position={[0, 0.08, hd]} args={[hw * 2, 0.16, 0.18]} material={concrete} castShadow={false} />
      <M position={[0, 0.08, -hd]} args={[hw * 2, 0.16, 0.18]} material={concrete} castShadow={false} />
      <M position={[-hw, 0.08, 0]} args={[0.18, 0.16, hd * 2]} material={concrete} castShadow={false} />
      <M position={[hw, 0.08, 0]} args={[0.18, 0.16, hd * 2]} material={concrete} castShadow={false} />
      {/* Boundary wall with a front gate gap */}
      <M position={[-hw + gateW / 4, wallH / 2, hd]} args={[hw * 2 - gateW, wallH, 0.16]} material={concrete} />
      <M position={[hw * 0.55, wallH / 2, hd]} args={[hw * 0.7, wallH, 0.16]} material={concrete} />
      <M position={[0, wallH / 2, -hd]} args={[hw * 2, wallH, 0.16]} material={concrete} />
      <M position={[-hw, wallH / 2, 0]} args={[0.16, wallH, hd * 2]} material={concrete} />
      <M position={[hw, wallH / 2, 0]} args={[0.16, wallH, hd * 2]} material={concrete} />
      {/* Driveway in front of the house, darker than the lawn */}
      <M
        position={[0, 0.06, hd * 0.55]}
        args={[3.4, 0.08, Math.max(4, hd * 0.85)]}
        material={dark}
        castShadow={false}
      />
      <M
        position={[width * 0.32, 0.05, depth * 0.15]}
        args={[1.1, 0.05, depth * 0.7]}
        material={concrete}
        castShadow={false}
      />
      {/* Low-poly trees */}
      {[
        [hw - 1.2, -hd + 1.4],
        [-hw + 1.3, hd - 1.6],
        [hw - 1.6, hd - 2.2],
      ].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <M position={[0, 0.7, 0]} args={[0.18, 1.4, 0.18]} material={dark} castShadow={false} />
          <mesh position={[0, 1.7, 0]} castShadow={false}>
            <coneGeometry args={[0.7, 1.5, 6]} />
            <meshStandardMaterial color={i === 1 ? "#3e6b45" : "#2f5a3a"} roughness={1} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export function ModernReferenceHouse({
  config,
  evening = false,
  mobileGlass = true,
  plotPolygon,
}: {
  config: HouseConfig;
  evening?: boolean;
  /** Prefer transparent+envMap glass on mobile (no transmission). */
  mobileGlass?: boolean;
  plotPolygon?: Array<{ x: number; z: number }>;
}) {
  const w = Math.max(0.5, Number(config.footprint?.width) || 11);
  const d = Math.max(0.5, Number(config.footprint?.depth) || 10);
  const floors = Math.max(1, Number(config.floors) || 2);
  const features = config.features || {};
  const storey = 3.2;
  const groundH = storey;
  const upperH = floors > 1 ? storey * 0.92 : 0;
  const cantilever = features.cantilever !== false && floors > 1 ? Math.min(1.8, d * 0.18) : 0;
  const upperW = w * 0.92;
  const upperD = d - cantilever * 0.35;
  const slabT = 0.3;
  const parapet = 0.28;

  const mats = useMemo(() => {
    const plaster = new MeshStandardMaterial({
      color: "#ebe6df",
      roughness: 0.78,
      metalness: 0.02,
    });
    const concrete = new MeshStandardMaterial({
      color: "#d8d2c8",
      roughness: 0.88,
      metalness: 0.03,
    });
    const frame = new MeshStandardMaterial({
      color: "#1a1c1f",
      roughness: 0.45,
      metalness: 0.35,
    });
    const glass = mobileGlass
      ? new MeshPhysicalMaterial({
          color: evening ? "#f2e2c4" : "#a8c4d4",
          transparent: true,
          opacity: evening ? 0.38 : 0.42,
          roughness: 0.06,
          metalness: 0.05,
          envMapIntensity: 1.4,
          side: DoubleSide,
          depthWrite: false,
          emissive: evening ? "#ff9a3c" : "#000000",
          emissiveIntensity: evening ? 0.35 : 0,
        })
      : new MeshPhysicalMaterial({
          color: evening ? "#f2e2c4" : "#9ebcd0",
          transmission: evening ? 0.45 : 0.65,
          transparent: true,
          opacity: evening ? 0.55 : 0.55,
          roughness: 0.05,
          metalness: 0.08,
          thickness: 0.4,
          envMapIntensity: 1.5,
          emissive: evening ? "#ff9a3c" : "#000000",
          emissiveIntensity: evening ? 0.28 : 0,
        });
    const dark = new MeshStandardMaterial({
      color: "#2a2e33",
      roughness: 0.55,
      metalness: 0.2,
    });
    const wood = new MeshStandardMaterial({
      color: "#8b6a45",
      roughness: 0.7,
      metalness: 0.05,
    });
    const fabric = new MeshStandardMaterial({
      color: "#6b7a86",
      roughness: 0.9,
      metalness: 0,
    });
    const warm = new MeshStandardMaterial({
      color: "#f5f0e6",
      roughness: 0.85,
      metalness: 0,
      emissive: evening ? "#ffb060" : "#000000",
      emissiveIntensity: evening ? 0.85 : 0,
    });
    const grass = new MeshStandardMaterial({
      color: "#4f7a45",
      roughness: 1,
      metalness: 0,
    });
    const stone = new MeshStandardMaterial({
      color: "#8d8680",
      roughness: 0.92,
      metalness: 0.02,
    });
    const timber = new MeshStandardMaterial({
      color: "#6e4a32",
      roughness: 0.74,
      metalness: 0.04,
    });
    const glow = new MeshStandardMaterial({
      color: "#fff1d6",
      emissive: evening ? "#ffd29a" : "#fff6e8",
      emissiveIntensity: evening ? 2.4 : 0.35,
      roughness: 0.4,
    });
    return { plaster, concrete, frame, glass, dark, wood, fabric, warm, grass, stone, timber, glow };
  }, [evening, mobileGlass]);

  // Front facade openings (local X relative to facade centre, Y from slab)
  const groundOpenings = useMemo(() => {
    const panels = 4;
    const gap = 0.35;
    const usable = w - 1.2;
    const pw = (usable - gap * (panels - 1)) / panels;
    const list: Array<{ x: number; y: number; w: number; h: number }> = [];
    for (let i = 0; i < panels; i++) {
      const x = -usable / 2 + pw / 2 + i * (pw + gap);
      list.push({ x, y: groundH * 0.52, w: pw, h: groundH * 0.78 });
    }
    return list;
  }, [w, groundH]);

  const upperOpenings = useMemo(() => {
    if (floors < 2) return [];
    const panels = 5;
    const gap = 0.28;
    const usable = upperW - 1.0;
    const pw = (usable - gap * (panels - 1)) / panels;
    const list: Array<{ x: number; y: number; w: number; h: number }> = [];
    for (let i = 0; i < panels; i++) {
      const x = -usable / 2 + pw / 2 + i * (pw + gap);
      list.push({ x, y: upperH * 0.5, w: pw, h: upperH * 0.82 });
    }
    return list;
  }, [floors, upperW, upperH]);

  const frontZ = d / 2;
  const upperFrontZ = frontZ - cantilever * 0.15;

  return (
    <group>
      <SiteDressing
        width={w}
        depth={d}
        polygon={plotPolygon}
        grass={mats.grass}
        concrete={mats.concrete}
        dark={mats.dark}
      />

      {/* Ground floor volume */}
      <M position={[0, groundH / 2 + 0.08, 0]} args={[w, groundH, d]} material={mats.plaster} />

      {/* Front punched glazing wall (slightly proud) */}
      <PunchedFacade
        width={w - 0.15}
        height={groundH - 0.15}
        thickness={0.18}
        openings={groundOpenings}
        wallMat={mats.plaster}
        position={[0, 0.15, frontZ - 0.05]}
      />
      {groundOpenings.map((o, i) => (
        <GlassPanel
          key={`g-${i}`}
          position={[o.x, o.y + 0.08, frontZ + 0.02]}
          args={[o.w * 0.98, o.h * 0.98, 0.12]}
          glass={mats.glass}
          frame={mats.frame}
        />
      ))}

      {/* Side ribbon windows */}
      <GlassPanel
        position={[-w / 2 - 0.02, groundH * 0.55, 0]}
        args={[0.1, groundH * 0.7, d * 0.55]}
        glass={mats.glass}
        frame={mats.frame}
      />
      <GlassPanel
        position={[w / 2 + 0.02, groundH * 0.55, 0]}
        args={[0.1, groundH * 0.7, d * 0.55]}
        glass={mats.glass}
        frame={mats.frame}
      />

      {/* Interior silhouettes (visible through glass) */}
      <group position={[0, 0.08, frontZ - 1.8]}>
        <M position={[-w * 0.22, 0.4, d * 0.15]} args={[1.6, 0.08, 0.9]} material={mats.wood} castShadow={false} />
        {[-0.5, 0, 0.5].map((dx) => (
          <M
            key={dx}
            position={[-w * 0.22 + dx, 0.55, d * 0.15 + 0.45]}
            args={[0.35, 0.85, 0.35]}
            material={mats.dark}
            castShadow={false}
          />
        ))}
        <M position={[w * 0.2, 0.35, d * 0.05]} args={[2.2, 0.45, 0.9]} material={mats.fabric} castShadow={false} />
        <M position={[w * 0.2, 0.55, d * 0.05 - 0.35]} args={[2.0, 0.55, 0.2]} material={mats.fabric} castShadow={false} />
        <M position={[0, groundH * 0.92, 0]} args={[w * 0.7, 0.04, d * 0.5]} material={mats.warm} castShadow={false} />
        <M position={[-w * 0.28, 0.42, -d * 0.22]} args={[1.8, 0.4, 2.1]} material={mats.fabric} castShadow={false} />
        {[-0.4, 0.4].map((dx) => (
          <M
            key={`spot-${dx}`}
            position={[dx * w * 0.3, groundH - 0.12, 0]}
            args={[0.18, 0.04, 0.18]}
            material={mats.glow}
            castShadow={false}
          />
        ))}
      </group>

      {/* Timber cladding strip + stone feature */}
      <M position={[w / 2 - 0.04, groundH * 0.55, -d * 0.1]} args={[0.08, groundH * 0.7, d * 0.35]} material={mats.timber} />
      <M position={[-w / 2 + 0.02, groundH * 0.4, -d * 0.28]} args={[0.1, groundH * 0.55, d * 0.28]} material={mats.stone} />

      {/* Door, canopy, AC */}
      <M position={[-w * 0.32, 1.15, frontZ + 0.04]} args={[0.95, 2.15, 0.08]} material={mats.dark} />
      <M position={[-w * 0.32, 2.35, frontZ + 0.55]} args={[1.6, 0.08, 1.1]} material={mats.concrete} />
      <M position={[w / 2 + 0.12, groundH * 0.72, d * 0.15]} args={[0.22, 0.35, 0.7]} material={mats.dark} castShadow={false} />
      <M position={[w / 2 + 0.12, groundH * 0.72, -d * 0.2]} args={[0.22, 0.35, 0.7]} material={mats.dark} castShadow={false} />

      {/* Intermediate floor slab + cantilever overhang */}
      {floors > 1 && (
        <>
          <M
            position={[0, groundH + slabT / 2 + 0.08, cantilever / 2]}
            args={[w + 0.35, slabT, d + cantilever]}
            material={mats.concrete}
          />
          {/* Upper volume set back */}
          <M
            position={[0, groundH + slabT + upperH / 2 + 0.08, -cantilever * 0.2]}
            args={[upperW, upperH, upperD]}
            material={mats.plaster}
          />
          <PunchedFacade
            width={upperW - 0.1}
            height={upperH - 0.1}
            thickness={0.16}
            openings={upperOpenings}
            wallMat={mats.plaster}
            position={[0, groundH + slabT + 0.12, upperFrontZ - 0.35]}
          />
          {upperOpenings.map((o, i) => (
            <GlassPanel
              key={`u-${i}`}
              position={[o.x, groundH + slabT + 0.12 + o.y, upperFrontZ - 0.28]}
              args={[o.w * 0.98, o.h * 0.98, 0.1]}
              glass={mats.glass}
              frame={mats.frame}
            />
          ))}

          {/* Upper terrace glass railing on cantilever */}
          {(features.terrace || features.balcony) && (
            <GlassRailing
              width={w * 0.9}
              z={frontZ + cantilever * 0.35}
              y={groundH + slabT + 0.08}
              glass={mats.glass}
              rail={mats.frame}
            />
          )}

          {/* Flat roof + thin parapet */}
          <M
            position={[0, groundH + slabT + upperH + slabT / 2 + 0.08, -cantilever * 0.2]}
            args={[upperW + 0.25, slabT, upperD + 0.25]}
            material={mats.concrete}
          />
          <M
            position={[0, groundH + slabT + upperH + slabT + parapet / 2 + 0.08, -cantilever * 0.2]}
            args={[upperW + 0.35, parapet, 0.08]}
            material={mats.concrete}
          />
          <M
            position={[0, groundH + slabT + upperH + slabT + parapet / 2 + 0.08, -cantilever * 0.2]}
            args={[0.08, parapet, upperD + 0.35]}
            material={mats.concrete}
          />
          <M
            position={[-upperW / 2, groundH + slabT + upperH + slabT + parapet / 2 + 0.08, -cantilever * 0.2]}
            args={[0.08, parapet, upperD + 0.35]}
            material={mats.concrete}
          />
          <M
            position={[upperW / 2, groundH + slabT + upperH + slabT + parapet / 2 + 0.08, -cantilever * 0.2]}
            args={[0.08, parapet, upperD + 0.35]}
            material={mats.concrete}
          />
        </>
      )}

      {floors === 1 && (
        <>
          <M
            position={[0, groundH + slabT / 2 + 0.08, 0]}
            args={[w + 0.3, slabT, d + 0.3]}
            material={mats.concrete}
          />
          <M
            position={[0, groundH + slabT + parapet / 2 + 0.08, d / 2]}
            args={[w + 0.35, parapet, 0.08]}
            material={mats.concrete}
          />
        </>
      )}

      {/* Vertical downpipe */}
      <M
        position={[w / 2 - 0.12, (floors > 1 ? groundH + upperH : groundH) / 2 + 0.4, frontZ - 0.15]}
        args={[0.07, floors > 1 ? groundH + upperH + 0.6 : groundH + 0.4, 0.07]}
        material={mats.dark}
        castShadow={false}
      />

      {/* Entry canopy / garage hint */}
      {features.garage && (
        <M
          position={[w * 0.28, 1.15, -d / 2 - 0.3]}
          args={[w * 0.42, 2.2, 0.12]}
          material={mats.dark}
        />
      )}
    </group>
  );
}
