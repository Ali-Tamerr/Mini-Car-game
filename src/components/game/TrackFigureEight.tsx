"use client";

import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { useMemo } from "react";
import {
  createTrackColliderSegments,
  createTrackStripGeometry,
  getFigureEightFrame,
  TRACK_BORDER_WIDTH,
  TRACK_ROAD_WIDTH,
} from "./trackMath";

type CurbBlock = {
  position: [number, number, number];
  yaw: number;
  color: string;
};

type LaneDashBlock = {
  position: [number, number, number];
  yaw: number;
};

function buildCurbBlocks(): CurbBlock[] {
  const blocks: CurbBlock[] = [];
  const samples = 220;

  for (let i = 0; i < samples; i += 1) {
    const t = (i / samples) * Math.PI * 2;
    const { center, tangent, side } = getFigureEightFrame(t);
    const yaw = Math.atan2(tangent.x, tangent.z);
    const color = i % 2 === 0 ? "#f33434" : "#ffffff";

    const curbOffset = TRACK_ROAD_WIDTH * 0.5 + 0.47;

    const left = center
      .clone()
      .add(side.clone().multiplyScalar(curbOffset));
    const right = center
      .clone()
      .add(side.clone().multiplyScalar(-curbOffset));

    left.y += 0.09;
    right.y += 0.09;

    blocks.push({
      position: [left.x, left.y, left.z],
      yaw,
      color,
    });
    blocks.push({
      position: [right.x, right.y, right.z],
      yaw,
      color,
    });
  }

  return blocks;
}

function buildLaneDashBlocks(offset: number): LaneDashBlock[] {
  const blocks: LaneDashBlock[] = [];
  const samples = 300;

  for (let i = 0; i < samples; i += 1) {
    if (i % 2 !== 0) {
      continue;
    }

    const t = (i / samples) * Math.PI * 2;
    const { center, tangent, side } = getFigureEightFrame(t);
    const yaw = Math.atan2(tangent.x, tangent.z);

    const point = center
      .clone()
      .add(side.clone().multiplyScalar(offset));
    point.y += 0.06;

    blocks.push({
      position: [point.x, point.y, point.z],
      yaw,
    });
  }

  return blocks;
}

export function TrackFigureEight() {
  const borderGeometry = useMemo(
    () => createTrackStripGeometry(TRACK_BORDER_WIDTH, 900, -0.04),
    [],
  );
  const roadGeometry = useMemo(
    () => createTrackStripGeometry(TRACK_ROAD_WIDTH, 900, 0.02),
    [],
  );
  const collisionSegments = useMemo(() => createTrackColliderSegments(760), []);

  const curbBlocks = useMemo(() => buildCurbBlocks(), []);
  const laneDashBlocks = useMemo(
    () => [-1.35, 1.35].flatMap((offset) => buildLaneDashBlocks(offset)),
    [],
  );

  return (
    <group>
      <RigidBody type="fixed" colliders={false} friction={1.35} restitution={0.02}>
        {collisionSegments.map((segment, index) => (
          <CuboidCollider
            key={index}
            args={[TRACK_ROAD_WIDTH * 0.5, 0.16, segment.halfLength]}
            position={segment.position}
            rotation={segment.rotation}
            friction={1.35}
            restitution={0}
          />
        ))}

        <mesh geometry={borderGeometry} castShadow receiveShadow>
          <meshStandardMaterial color="#f2f2f2" roughness={0.5} metalness={0.05} />
        </mesh>

        <mesh geometry={roadGeometry} castShadow receiveShadow>
          <meshStandardMaterial color="#11151d" roughness={0.94} metalness={0.02} />
        </mesh>
      </RigidBody>

      {laneDashBlocks.map((block, index) => (
        <mesh
          key={`lane-dash-${index}-${block.yaw}`}
          castShadow={false}
          receiveShadow
          position={block.position}
          rotation={[0, block.yaw, 0]}
        >
          <boxGeometry args={[0.2, 0.04, 1.05]} />
          <meshStandardMaterial color="#efefef" roughness={0.45} metalness={0.02} />
        </mesh>
      ))}

      {curbBlocks.map((block, index) => (
        <mesh
          key={`${index}-${block.yaw}`}
          castShadow
          receiveShadow
          position={block.position}
          rotation={[0, block.yaw, 0]}
        >
          <boxGeometry args={[0.9, 0.14, 0.34]} />
          <meshStandardMaterial color={block.color} roughness={0.65} metalness={0.02} />
        </mesh>
      ))}
    </group>
  );
}
