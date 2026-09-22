"use client";

import { useMemo } from "react";
import { ExtrudeGeometry, MeshStandardMaterial, Shape, type Material } from "three";

import type { HouseConfig } from "./materials";
import { useArchMaterials } from "./materials";

function Box({
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

/** Solid gable roof prism (no floating V slabs). */
function GableRoof({
  width,
  depth,
  eaveY,
  rise,
  material,
  overhang = 0.45,
}: {
  width: number;
  depth: number;
  eaveY: number;
  rise: number;
  material: Material;
  overhang?: number;
}) {
  const geom = useMemo(() => {
    const hd = depth / 2 + overhang;
    const shape = new Shape();
    shape.moveTo(-hd, 0);
    shape.lineTo(hd, 0);
    shape.lineTo(0, rise);
    shape.closePath();
    const g = new ExtrudeGeometry(shape, {
      depth: width + overhang * 2,
      bevelEnabled: false,
    });
    g.translate(0, 0, -(width + overhang * 2) / 2);
    g.rotateY(Math.PI / 2);
    g.computeVertexNormals();
    return g;
  }, [width, depth, rise, overhang]);

  return (
    <mesh
      position={[0, eaveY, 0]}
      geometry={geom}
      material={material}
      castShadow
      receiveShadow
    />
  );
}

function RecessedWindow({
  x,
  y,
  z,
  w,
  h,
  glass,
  trim,
  shutter,
  withShutters = false,
  rotationY = 0,
}: {
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  glass: Material;
  trim: Material;
  shutter?: Material;
  withShutters?: boolean;
  rotationY?: number;
}) {
  return (
    <group position={[x, y, z]} rotation={[0, rotationY, 0]}>
      <Box position={[0, 0, 0]} args={[w + 0.18, h + 0.18, 0.1]} material={trim} />
      <Box position={[0, 0, 0.04]} args={[w, h, 0.06]} material={glass} castShadow={false} />
      <Box position={[0, 0, 0.07]} args={[0.05, h, 0.04]} material={trim} castShadow={false} />
      <Box position={[0, 0, 0.07]} args={[w, 0.05, 0.04]} material={trim} castShadow={false} />
      {withShutters && shutter && (
        <>
          <Box position={[-(w / 2 + 0.22), 0, 0.02]} args={[0.28, h + 0.05, 0.06]} material={shutter} />
          <Box position={[w / 2 + 0.22, 0, 0.02]} args={[0.28, h + 0.05, 0.06]} material={shutter} />
        </>
      )}
      <Box position={[0, -h / 2 - 0.08, 0.08]} args={[w + 0.3, 0.08, 0.18]} material={trim} />
    </group>
  );
}

function Quoins({
  w,
  d,
  h,
  material,
}: {
  w: number;
  d: number;
  h: number;
  material: Material;
}) {
  const block = 0.55;
  const ys = [0.7, 1.9, 3.1, 4.3, 5.5].filter((y) => y < h);
  const corners: [number, number][] = [
    [-w / 2, -d / 2],
    [w / 2, -d / 2],
    [-w / 2, d / 2],
    [w / 2, d / 2],
  ];
  return (
    <group>
      {corners.flatMap(([cx, cz], i) =>
        ys.map((y) => (
          <Box
            key={`${i}-${y}`}
            position={[cx, y, cz]}
            args={[block, 0.95, block]}
            material={material}
          />
        )),
      )}
    </group>
  );
}

function Column({
  x,
  z,
  baseY,
  h,
  material,
  capital,
}: {
  x: number;
  z: number;
  baseY: number;
  h: number;
  material: Material;
  capital: Material;
}) {
  return (
    <group position={[x, baseY, z]}>
      <mesh position={[0, 0.12, 0]} castShadow material={capital}>
        <boxGeometry args={[0.55, 0.24, 0.55]} />
      </mesh>
      <mesh position={[0, h / 2, 0]} castShadow material={material}>
        <cylinderGeometry args={[0.2, 0.24, h - 0.35, 16]} />
      </mesh>
      <mesh position={[0, h - 0.12, 0]} castShadow material={capital}>
        <boxGeometry args={[0.58, 0.22, 0.58]} />
      </mesh>
    </group>
  );
}

function Tree({ x, z, trunk, canopy }: { x: number; z: number; trunk: Material; canopy: Material }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.7, 0]} castShadow material={trunk}>
        <cylinderGeometry args={[0.12, 0.18, 1.4, 8]} />
      </mesh>
      <mesh position={[0, 2.1, 0]} castShadow material={canopy}>
        <sphereGeometry args={[1.05, 12, 10]} />
      </mesh>
      <mesh position={[0.35, 2.4, 0.2]} castShadow material={canopy}>
        <sphereGeometry args={[0.7, 10, 8]} />
      </mesh>
    </group>
  );
}

/**
 * Procedural architectural house — metres, origin at footprint centre, y=0 ground.
 * Built for convincing real-time visualization (not photoreal CGI).
 */
export function ArchitecturalHouse({
  config,
  evening = false,
}: {
  config: HouseConfig;
  evening?: boolean;
}) {
  const style = String(config.style || "modern").toLowerCase();
  const floors = Math.max(1, Number(config.floors) || 2);
  const w = Math.max(7, Number(config.footprint?.width) || 10);
  const d = Math.max(7, Number(config.footprint?.depth) || 10);
  const features = config.features || {};
  const mats = useArchMaterials(style, evening);

  const shutter = useMemo(
    () =>
      new MeshStandardMaterial({
        color: "#2f5a45",
        roughness: 0.85,
        metalness: 0.05,
      }),
    [],
  );
  const terracotta = useMemo(
    () =>
      new MeshStandardMaterial({
        color: "#a0452c",
        roughness: 0.78,
        metalness: 0.04,
      }),
    [],
  );
  const stoneLite = useMemo(
    () =>
      new MeshStandardMaterial({
        color: "#d8cfc0",
        roughness: 0.82,
        metalness: 0.03,
      }),
    [],
  );

  const storey = 3.15;
  const totalH = floors * storey;
  const frontZ = d / 2;
  const isItalian = style.includes("italian");
  const isCottage = style.includes("cottage");
  const isAmerican = style.includes("american");
  const isTraditional = style.includes("traditional");
  const isLuxury = style.includes("luxury");
  const isContemporary = style.includes("contemporary");
  const isModern = style.includes("modern") && !isContemporary;
  const pitched = isItalian || isCottage || isAmerican || isTraditional;

  return (
    <group>
      {/* Site */}
      <Box
        position={[0, -0.06, 0.4]}
        args={[w + 14, 0.12, d + 16]}
        material={mats.grass}
        castShadow={false}
      />
      <Box
        position={[0, 0.01, frontZ + 2.8]}
        args={[Math.min(w + 1, 7.5), 0.08, 5]}
        material={mats.pave}
        castShadow={false}
      />

      {/* Plinth / foundation */}
      <Box position={[0, 0.2, 0]} args={[w + 0.45, 0.4, d + 0.45]} material={mats.accent} />
      <Box
        position={[0, 0.02, 0]}
        args={[w + 1.2, 0.08, d + 1.2]}
        material={mats.pave}
        castShadow={false}
      />

      {/* Low perimeter fence (site boundary cue) */}
      <Box
        position={[0, 0.55, frontZ + 5.2]}
        args={[w + 10, 0.9, 0.12]}
        material={mats.accent}
      />
      <Box
        position={[-(w / 2 + 5), 0.55, 0]}
        args={[0.12, 0.9, d + 8]}
        material={mats.accent}
      />
      <Box
        position={[w / 2 + 5, 0.55, 0]}
        args={[0.12, 0.9, d + 8]}
        material={mats.accent}
      />

      {/* Main volume — Italian uses storey setback; others are a single prism */}
      {isItalian && floors > 1 ? (
        <>
          <Box position={[0, storey / 2 + 0.35, 0]} args={[w, storey, d]} material={mats.wall} />
          <Box
            position={[0, storey + storey / 2 + 0.35, 0]}
            args={[w - 0.4, storey, d - 0.4]}
            material={mats.wall}
          />
          <Box
            position={[0, storey + 0.35, 0]}
            args={[w + 0.28, 0.22, d + 0.28]}
            material={stoneLite}
          />
          <Quoins w={w} d={d} h={totalH + 0.4} material={stoneLite} />
        </>
      ) : (
        <Box position={[0, totalH / 2 + 0.35, 0]} args={[w, totalH, d]} material={mats.wall} />
      )}

      {/* Modern / luxury cantilever wing */}
      {(features.cantilever || isModern || isContemporary || isLuxury) && !isItalian && (
        <Box
          position={[w * 0.22, storey + storey * 0.42 + 0.35, d * 0.08]}
          args={[w * 0.58, storey * 0.85, d * 0.52]}
          material={mats.accent}
        />
      )}

      {/* Garage */}
      {(features.garage || isAmerican) && (
        <group position={[w * 0.52 + 0.4, 0.35, frontZ * 0.15]}>
          <Box position={[0, 1.45, 0]} args={[4.4, 2.9, 5.8]} material={mats.wall} />
          <Box position={[0, 1.2, 2.92]} args={[3.3, 2.15, 0.14]} material={mats.dark} />
          {pitched && (
            <GableRoof
              width={4.6}
              depth={5.9}
              eaveY={2.95}
              rise={1.4}
              material={mats.roof}
              overhang={0.25}
            />
          )}
        </group>
      )}

      {/* Roof */}
      {pitched ? (
        <GableRoof
          width={w}
          depth={d}
          eaveY={totalH + 0.35}
          rise={isCottage ? 2.0 : isItalian ? 2.45 : 2.2}
          material={isItalian ? terracotta : mats.roof}
          overhang={0.55}
        />
      ) : (
        <>
          <Box
            position={[0, totalH + 0.42, 0]}
            args={[w + 0.7, 0.28, d + 0.7]}
            material={mats.roof}
          />
          <Box
            position={[0, totalH + 0.55, 0]}
            args={[w + 0.35, 0.12, d + 0.35]}
            material={mats.accent}
          />
        </>
      )}

      {/* Italian / traditional portico */}
      {(features.columns || isItalian || isTraditional) && (
        <group>
          <Box
            position={[0, 0.42, frontZ + 1.05]}
            args={[5.6, 0.28, 2.1]}
            material={stoneLite}
          />
          {[-2.05, -0.7, 0.7, 2.05].map((x) => (
            <Column
              key={x}
              x={x}
              z={frontZ + 1.35}
              baseY={0.55}
              h={storey * 1.75}
              material={mats.trim}
              capital={stoneLite}
            />
          ))}
          <Box
            position={[0, storey * 1.75 + 0.55, frontZ + 1.2]}
            args={[5.8, 0.32, 2.3]}
            material={stoneLite}
          />
          {isItalian && (
            <GableRoof
              width={5.9}
              depth={1.1}
              eaveY={storey * 1.75 + 0.72}
              rise={1.35}
              material={terracotta}
              overhang={0.15}
            />
          )}
          {/* Upper balcony rail */}
          <Box
            position={[0, storey + 0.45, frontZ + 0.75]}
            args={[4.8, 0.12, 1.1]}
            material={stoneLite}
          />
          <Box
            position={[0, storey + 0.9, frontZ + 1.2]}
            args={[4.8, 0.08, 0.08]}
            material={mats.trim}
          />
          {[-2, -1, 0, 1, 2].map((x) => (
            <Box
              key={`bal-${x}`}
              position={[x, storey + 0.7, frontZ + 1.2]}
              args={[0.07, 0.4, 0.07]}
              material={mats.trim}
            />
          ))}
        </group>
      )}

      {/* American / cottage porch */}
      {(features.porch || isAmerican || isCottage) && !isItalian && (
        <group>
          <Box position={[0, 0.4, frontZ + 1.15]} args={[4.8, 0.18, 2.1]} material={mats.pave} />
          <Box position={[-1.9, 1.5, frontZ + 1.7]} args={[0.18, 2.5, 0.18]} material={mats.trim} />
          <Box position={[1.9, 1.5, frontZ + 1.7]} args={[0.18, 2.5, 0.18]} material={mats.trim} />
          <Box position={[0, 2.8, frontZ + 1.4]} args={[4.5, 0.16, 2.3]} material={mats.roof} />
        </group>
      )}

      {/* Entrance door */}
      <Box position={[0, 1.35, frontZ + 0.06]} args={[1.25, 2.35, 0.14]} material={mats.dark} />
      <Box position={[0.35, 1.35, frontZ + 0.14]} args={[0.08, 0.08, 0.08]} material={mats.trim} />

      {/* Ground windows */}
      <RecessedWindow
        x={-w * 0.3}
        y={1.85}
        z={frontZ + 0.05}
        w={isModern || isLuxury ? 2.2 : 1.45}
        h={isModern || isLuxury ? 2.0 : 1.45}
        glass={mats.glass}
        trim={mats.trim}
        shutter={shutter}
        withShutters={isItalian || isCottage || isTraditional}
      />
      <RecessedWindow
        x={w * 0.3}
        y={1.85}
        z={frontZ + 0.05}
        w={isModern || isLuxury ? 2.2 : 1.45}
        h={isModern || isLuxury ? 2.0 : 1.45}
        glass={mats.glass}
        trim={mats.trim}
        shutter={shutter}
        withShutters={isItalian || isCottage || isTraditional}
      />

      {/* Upper windows */}
      {floors > 1 &&
        [-w * 0.3, 0, w * 0.3].map((x) => (
          <RecessedWindow
            key={`u-${x}`}
            x={x}
            y={storey + 1.75}
            z={frontZ + 0.05}
            w={1.25}
            h={1.55}
            glass={mats.glass}
            trim={mats.trim}
            shutter={shutter}
            withShutters={isItalian || isTraditional}
          />
        ))}

      {/* Side windows */}
      <RecessedWindow
        x={w / 2 + 0.05}
        y={1.9}
        z={0}
        w={1.3}
        h={1.5}
        glass={mats.glass}
        trim={mats.trim}
        rotationY={Math.PI / 2}
      />
      {floors > 1 && (
        <RecessedWindow
          x={w / 2 + 0.05}
          y={storey + 1.7}
          z={-d * 0.15}
          w={1.2}
          h={1.4}
          glass={mats.glass}
          trim={mats.trim}
          rotationY={Math.PI / 2}
        />
      )}

      {/* Modern glass band */}
      {(isModern || isContemporary || isLuxury) && (
        <Box
          position={[-(w / 2) - 0.04, storey * 0.95, 0]}
          args={[0.08, storey * 1.35, d * 0.5]}
          material={mats.glass}
          castShadow={false}
        />
      )}

      {/* Rear terrace */}
      {(features.terrace || isItalian || isLuxury) && (
        <Box
          position={[0, 0.18, -d / 2 - 1.35]}
          args={[w * 0.75, 0.16, 2.6]}
          material={mats.pave}
        />
      )}

      {/* Pool */}
      {features.pool && (
        <group position={[0, 0.08, -d / 2 - 4.5]}>
          <Box position={[0, 0, 0]} args={[8.2, 0.4, 3.8]} material={mats.accent} />
          <Box position={[0, 0.14, 0]} args={[7.4, 0.22, 3.1]} material={mats.water} castShadow={false} />
          <mesh position={[3.2, 1.1, 1.4]} castShadow material={mats.trim}>
            <cylinderGeometry args={[0.06, 0.06, 2.0, 8]} />
          </mesh>
        </group>
      )}

      <Tree x={-w / 2 - 2.8} z={frontZ - 1} trunk={mats.dark} canopy={mats.grass} />
      <Tree x={w / 2 + 2.8} z={frontZ - 1.5} trunk={mats.dark} canopy={mats.grass} />
      <Tree x={-w / 2 - 2.2} z={-d / 2 + 0.5} trunk={mats.dark} canopy={mats.grass} />

      {/* Hedge */}
      <Box
        position={[0, 0.45, -d / 2 - 6.5]}
        args={[w + 6, 0.9, 0.45]}
        material={mats.grass}
      />

      {evening && (
        <>
          <pointLight
            position={[-2.2, 2.4, frontZ + 1.6]}
            intensity={2.2}
            color="#ffd2a1"
            distance={10}
            castShadow={false}
          />
          <pointLight
            position={[2.2, 2.4, frontZ + 1.6]}
            intensity={2.2}
            color="#ffd2a1"
            distance={10}
            castShadow={false}
          />
          <spotLight
            position={[0, 9, frontZ + 4]}
            angle={0.55}
            penumbra={0.6}
            intensity={1.4}
            color="#ffe6c5"
            castShadow={false}
          />
        </>
      )}
    </group>
  );
}
