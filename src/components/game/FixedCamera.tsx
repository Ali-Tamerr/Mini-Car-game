"use client";

import { PerspectiveCamera } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { PerspectiveCamera as PerspectiveCameraImpl } from "three";

const CAMERA_POSITION: [number, number, number] = [0, 31, 42];

export function FixedCamera() {
  const cameraRef = useRef<PerspectiveCameraImpl | null>(null);

  useFrame(() => {
    cameraRef.current?.lookAt(0, 0, 0);
  });

  return <PerspectiveCamera ref={cameraRef} makeDefault fov={33} position={CAMERA_POSITION} />;
}
