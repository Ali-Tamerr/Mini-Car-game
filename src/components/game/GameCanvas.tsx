"use client";

import { Environment } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Physics, type RapierRigidBody } from "@react-three/rapier";
import { useRef } from "react";
import { CarFbx } from "./CarFbx";
import { FixedCamera } from "./FixedCamera";
import { TrackFigureEight } from "./TrackFigureEight";

type GameCanvasProps = {
  cameraZoom: number;
  onCarLoaded?: () => void;
  onCarAssetMissing?: () => void;
};

export function GameCanvas({
  cameraZoom,
  onCarLoaded,
  onCarAssetMissing,
}: GameCanvasProps) {
  const bodyRef = useRef<RapierRigidBody | null>(null);

  return (
    <Canvas
      shadows
      dpr={[1, 1.5]}
      gl={{ antialias: true }}
      style={{ width: "100%", height: "100%" }}
    >
      <color attach="background" args={["#d8b486"]} />

      <FixedCamera bodyRef={bodyRef} zoomTarget={cameraZoom} />

      <ambientLight intensity={0.55} />
      <directionalLight
        castShadow
        position={[24, 36, 22]}
        intensity={1.35}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />

      <Environment preset="sunset" background={false} />

      <Physics gravity={[0, -9.81, 0]} timeStep={1 / 60}>
        <TrackFigureEight />
        <CarFbx
          bodyRef={bodyRef}
          onLoaded={onCarLoaded}
          onAssetMissing={onCarAssetMissing}
        />
      </Physics>
    </Canvas>
  );
}
