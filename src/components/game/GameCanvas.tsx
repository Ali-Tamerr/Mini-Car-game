"use client";

import { Environment } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { Physics, type RapierRigidBody } from "@react-three/rapier";
import { useEffect, useRef, type MutableRefObject } from "react";
import { Vector3 } from "three";
import { CarFbx } from "./CarFbx";
import { FixedCamera } from "./FixedCamera";
import { TrackFigureEight } from "./TrackFigureEight";
import {
  FINISH_GATE_MAX_Y,
  FINISH_GATE_MIN_LAP_DISTANCE,
  FINISH_GATE_MIN_LAP_INTERVAL_MS,
  FINISH_GATE_MIN_Y,
  FINISH_GATE_TRIGGER_RADIUS,
  RACE_SPAWN_POSITION,
  RACE_SPAWN_YAW,
} from "./raceConfig";

export type RacePhase = "setup" | "racing" | "finished";

export type LapProgressPayload = {
  completedLaps: number;
  lapTimeMs: number;
  totalTimeMs: number;
};

const UP = new Vector3(0, 1, 0);
const GATE_FORWARD = new Vector3(
  Math.sin(RACE_SPAWN_YAW),
  0,
  Math.cos(RACE_SPAWN_YAW),
).normalize();
const GATE_SIDE = new Vector3().crossVectors(UP, GATE_FORWARD).normalize();
const gateOffset = new Vector3();
const frameDelta = new Vector3();

function isBodyUsable(body: RapierRigidBody | null): body is RapierRigidBody {
  if (!body) {
    return false;
  }

  const maybeBody = body as RapierRigidBody & { isValid?: () => boolean };
  if (typeof maybeBody.isValid === "function") {
    return maybeBody.isValid();
  }

  return true;
}

type GameCanvasProps = {
  cameraZoom: number;
  racePhase: RacePhase;
  raceSessionId: number;
  targetLaps: number;
  controlsEnabled: boolean;
  onLapProgress?: (payload: LapProgressPayload) => void;
  onTrackLoaded?: () => void;
  onCarLoaded?: () => void;
  onCarAssetMissing?: () => void;
};

function RaceTracker({
  bodyRef,
  racePhase,
  raceSessionId,
  targetLaps,
  onLapProgress,
}: {
  bodyRef: MutableRefObject<RapierRigidBody | null>;
  racePhase: RacePhase;
  raceSessionId: number;
  targetLaps: number;
  onLapProgress?: (payload: LapProgressPayload) => void;
}) {
  const completedLapsRef = useRef(0);
  const raceStartMsRef = useRef<number | null>(null);
  const lastLapTimestampRef = useRef<number | null>(null);
  const wasInFinishZoneRef = useRef(false);
  const distanceSinceLapRef = useRef(0);
  const previousPositionRef = useRef<Vector3 | null>(null);
  const raceFinishedRef = useRef(false);

  useEffect(() => {
    completedLapsRef.current = 0;
    raceStartMsRef.current = null;
    lastLapTimestampRef.current = null;
    wasInFinishZoneRef.current = false;
    distanceSinceLapRef.current = 0;
    previousPositionRef.current = null;
    raceFinishedRef.current = false;
  }, [bodyRef, raceSessionId]);

  useEffect(() => {
    if (racePhase !== "racing") {
      raceStartMsRef.current = null;
      return;
    }

    const now = performance.now();
    completedLapsRef.current = 0;
    raceStartMsRef.current = now;
    lastLapTimestampRef.current = now;
    wasInFinishZoneRef.current = false;
    distanceSinceLapRef.current = 0;
    previousPositionRef.current = null;
    raceFinishedRef.current = false;
  }, [racePhase]);

  useFrame(() => {
    if (racePhase !== "racing" || raceFinishedRef.current) {
      return;
    }

    const body = bodyRef.current;
    if (!isBodyUsable(body)) {
      return;
    }

    let translation;
    try {
      translation = body.translation();
    } catch {
      return;
    }

    gateOffset.set(
      translation.x - RACE_SPAWN_POSITION[0],
      translation.y - RACE_SPAWN_POSITION[1],
      translation.z - RACE_SPAWN_POSITION[2],
    );

    const previousPosition = previousPositionRef.current;
    if (previousPosition !== null) {
      frameDelta.set(
        translation.x - previousPosition.x,
        0,
        translation.z - previousPosition.z,
      );
      distanceSinceLapRef.current += frameDelta.length();
    }
    if (previousPosition === null) {
      previousPositionRef.current = new Vector3(
        translation.x,
        translation.y,
        translation.z,
      );
    } else {
      previousPosition.set(translation.x, translation.y, translation.z);
    }

    const forwardOffset = gateOffset.dot(GATE_FORWARD);
    const sideOffset = gateOffset.dot(GATE_SIDE);
    const radialOffset = Math.hypot(forwardOffset, sideOffset);

    const inHeightBand =
      translation.y >= FINISH_GATE_MIN_Y &&
      translation.y <= FINISH_GATE_MAX_Y;
    const inFinishZone = radialOffset <= FINISH_GATE_TRIGGER_RADIUS && inHeightBand;

    const enteredFinishZone = inFinishZone && !wasInFinishZoneRef.current;
    const now = performance.now();

    if (enteredFinishZone && distanceSinceLapRef.current >= FINISH_GATE_MIN_LAP_DISTANCE) {
      const lastLapTimestamp = lastLapTimestampRef.current ?? now;
      const cooldownPassed =
        now - lastLapTimestamp >= FINISH_GATE_MIN_LAP_INTERVAL_MS;

      if (cooldownPassed) {
        completedLapsRef.current += 1;

        const lapTimeMs = now - lastLapTimestamp;
        const totalTimeMs = now - (raceStartMsRef.current ?? now);

        lastLapTimestampRef.current = now;
        distanceSinceLapRef.current = 0;

        onLapProgress?.({
          completedLaps: completedLapsRef.current,
          lapTimeMs,
          totalTimeMs,
        });

        if (completedLapsRef.current >= targetLaps) {
          raceFinishedRef.current = true;
        }
      }
    }

    wasInFinishZoneRef.current = inFinishZone;
  });

  return null;
}

export function GameCanvas({
  cameraZoom,
  racePhase,
  raceSessionId,
  targetLaps,
  controlsEnabled,
  onLapProgress,
  onTrackLoaded,
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
        <TrackFigureEight onLoaded={onTrackLoaded} />
        <RaceTracker
          bodyRef={bodyRef}
          racePhase={racePhase}
          raceSessionId={raceSessionId}
          targetLaps={targetLaps}
          onLapProgress={onLapProgress}
        />
        <CarFbx
          key={`car-session-${raceSessionId}`}
          bodyRef={bodyRef}
          controlsEnabled={controlsEnabled}
          onLoaded={onCarLoaded}
          onAssetMissing={onCarAssetMissing}
        />
      </Physics>
    </Canvas>
  );
}
