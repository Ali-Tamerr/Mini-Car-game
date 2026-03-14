"use client";

import { PerspectiveCamera } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import type { RapierRigidBody } from "@react-three/rapier";
import { useRef, type MutableRefObject } from "react";
import {
  PerspectiveCamera as PerspectiveCameraImpl,
  Vector3,
} from "three";

type FixedCameraProps = {
  bodyRef: MutableRefObject<RapierRigidBody | null>;
  zoomTarget: number;
};

const FAR_OFFSET = new Vector3(-82, 54, 90);
const CLOSE_OFFSET = new Vector3(-16, 11, 13);
const LOOK_AT_HEIGHT = 0.9;
const POSITION_FOLLOW_SPEED = 4.2;
const LOOK_FOLLOW_SPEED = 7.2;
const ZOOM_FOLLOW_SPEED = 3.3;
const FAR_FOV = 35;
const CLOSE_FOV = 23;

const fallbackCarPosition = new Vector3(0, 0, 0);
const desiredOffset = new Vector3();
const desiredLookAt = new Vector3();
const desiredCameraPosition = new Vector3();
const smoothedLookAt = new Vector3();

export function FixedCamera({ bodyRef, zoomTarget }: FixedCameraProps) {
  const cameraRef = useRef<PerspectiveCameraImpl | null>(null);
  const zoomProgressRef = useRef(0);
  const hasInitializedRef = useRef(false);

  useFrame((_, delta) => {
    const camera = cameraRef.current;
    if (!camera) {
      return;
    }

    const rb = bodyRef.current;
    const carTranslation = rb?.translation();
    const carPosition = carTranslation
      ? fallbackCarPosition.set(carTranslation.x, carTranslation.y, carTranslation.z)
      : fallbackCarPosition.set(0, 0, 0);

    const zoomClamped = Math.max(0, Math.min(1, zoomTarget));
    const zoomAlpha = 1 - Math.exp(-delta * ZOOM_FOLLOW_SPEED);
    zoomProgressRef.current += (zoomClamped - zoomProgressRef.current) * zoomAlpha;

    desiredOffset.lerpVectors(FAR_OFFSET, CLOSE_OFFSET, zoomProgressRef.current);
    desiredLookAt.set(carPosition.x, carPosition.y + LOOK_AT_HEIGHT, carPosition.z);
    desiredCameraPosition.copy(desiredLookAt).add(desiredOffset);

    if (!hasInitializedRef.current) {
      camera.position.copy(desiredCameraPosition);
      smoothedLookAt.copy(desiredLookAt);
      hasInitializedRef.current = true;
    }

    const followAlpha = 1 - Math.exp(-delta * POSITION_FOLLOW_SPEED);
    const lookAlpha = 1 - Math.exp(-delta * LOOK_FOLLOW_SPEED);

    camera.position.lerp(desiredCameraPosition, followAlpha);
    smoothedLookAt.lerp(desiredLookAt, lookAlpha);

    const targetFov = FAR_FOV + (CLOSE_FOV - FAR_FOV) * zoomProgressRef.current;
    camera.fov += (targetFov - camera.fov) * zoomAlpha;
    camera.updateProjectionMatrix();
    camera.lookAt(smoothedLookAt);
  });

  return (
    <PerspectiveCamera
      ref={cameraRef}
      makeDefault
      fov={FAR_FOV}
      near={0.1}
      far={320}
      position={[FAR_OFFSET.x, FAR_OFFSET.y, FAR_OFFSET.z]}
    />
  );
}
