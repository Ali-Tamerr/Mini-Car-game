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
  FINISH_GATE_ARM_FORWARD_DISTANCE,
  FINISH_GATE_ARM_SIDE_DISTANCE,
  FINISH_GATE_HALF_WIDTH,
  FINISH_GATE_HEIGHT_TOLERANCE,
  FINISH_GATE_MIN_DIRECTION_SPEED,
  FINISH_GATE_MIN_LAP_DISTANCE,
  FINISH_GATE_MIN_LAP_INTERVAL_MS,
  FINISH_GATE_TRIGGER_DEPTH,
  FINISH_LINE_POSITION,
  FINISH_LINE_VISUAL_THICKNESS,
  FINISH_LINE_VISUAL_WIDTH,
  FINISH_LINE_YAW,
  SHOW_FINISH_LINE_MARKER,
} from "./raceConfig";

export type RacePhase = "setup" | "racing" | "finished";

export type LapProgressPayload = {
  completedLaps: number;
  lapTimeMs: number;
  totalTimeMs: number;
};

const UP = new Vector3(0, 1, 0);
const frameDelta = new Vector3();
const gateOffset = new Vector3();
const planarVelocity = new Vector3();
const MAX_EFFECTIVE_FINISH_HEIGHT_TOLERANCE = 4.2;
const FINISH_DECK_LOCK_TOLERANCE = 1.05;
const FINISH_CENTER = new Vector3(
  FINISH_LINE_POSITION[0],
  FINISH_LINE_POSITION[1],
  FINISH_LINE_POSITION[2],
);
const FINISH_FORWARD = new Vector3(
  Math.sin(FINISH_LINE_YAW),
  0,
  Math.cos(FINISH_LINE_YAW),
).normalize();
const FINISH_SIDE = new Vector3().crossVectors(UP, FINISH_FORWARD).normalize();

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
  const lapArmedRef = useRef(false);
  const previousForwardOffsetRef = useRef<number | null>(null);
  const previousSideOffsetRef = useRef<number | null>(null);
  const previousHeightOffsetRef = useRef<number | null>(null);
  const lockedFinishHeightOffsetRef = useRef<number | null>(null);
  const lockedCrossingDirectionRef = useRef<number | null>(null);
  const distanceSinceLapRef = useRef(0);
  const previousPositionRef = useRef<Vector3 | null>(null);
  const raceFinishedRef = useRef(false);

  useEffect(() => {
    completedLapsRef.current = 0;
    raceStartMsRef.current = null;
    lastLapTimestampRef.current = null;
    lapArmedRef.current = false;
    previousForwardOffsetRef.current = null;
    previousSideOffsetRef.current = null;
    previousHeightOffsetRef.current = null;
    lockedFinishHeightOffsetRef.current = null;
    lockedCrossingDirectionRef.current = null;
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
    lapArmedRef.current = false;
    previousForwardOffsetRef.current = null;
    previousSideOffsetRef.current = null;
    previousHeightOffsetRef.current = null;
    lockedFinishHeightOffsetRef.current = null;
    lockedCrossingDirectionRef.current = null;
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

    gateOffset.set(
      translation.x - FINISH_CENTER.x,
      translation.y - FINISH_CENTER.y,
      translation.z - FINISH_CENTER.z,
    );
    const forwardOffset = gateOffset.dot(FINISH_FORWARD);
    const sideOffset = gateOffset.dot(FINISH_SIDE);
    const heightOffset = translation.y - FINISH_CENTER.y;
    const radialOffset = Math.hypot(forwardOffset, sideOffset);

    const effectiveHeightTolerance = Math.min(
      FINISH_GATE_HEIGHT_TOLERANCE,
      MAX_EFFECTIVE_FINISH_HEIGHT_TOLERANCE,
    );
    const laneTolerance =
      FINISH_GATE_HALF_WIDTH + Math.max(0.14, FINISH_GATE_TRIGGER_DEPTH * 0.08);

    const armDistanceThreshold = Math.max(
      FINISH_GATE_ARM_FORWARD_DISTANCE,
      FINISH_GATE_ARM_SIDE_DISTANCE,
    );
    const farEnoughToArm =
      radialOffset >= armDistanceThreshold ||
      distanceSinceLapRef.current >= FINISH_GATE_MIN_LAP_DISTANCE * 0.3;
    if (!lapArmedRef.current && farEnoughToArm) {
      lapArmedRef.current = true;
    }

    const previousForwardOffset = previousForwardOffsetRef.current;
    const previousSideOffset = previousSideOffsetRef.current;
    const previousHeightOffset = previousHeightOffsetRef.current;

    let crossingT: number | null = null;
    let crossingDirection: number | null = null;
    let crossedFinishLine = false;
    if (previousForwardOffset !== null) {
      const deltaForward = forwardOffset - previousForwardOffset;
      if (Math.abs(deltaForward) > 1e-5) {
        const candidateT = -previousForwardOffset / deltaForward;
        const crossesSegment = candidateT >= 0 && candidateT <= 1;
        crossedFinishLine = crossesSegment;
        if (crossedFinishLine) {
          crossingT = candidateT;
          crossingDirection = deltaForward > 0 ? 1 : -1;
        }
      }
    }

    let sideAtCross = sideOffset;
    let heightAtCross = heightOffset;
    if (
      crossingT !== null &&
      previousSideOffset !== null &&
      previousHeightOffset !== null
    ) {
      sideAtCross = previousSideOffset + (sideOffset - previousSideOffset) * crossingT;
      heightAtCross =
        previousHeightOffset + (heightOffset - previousHeightOffset) * crossingT;
    }

    const inGeneralHeightBand =
      Math.abs(heightAtCross) <= effectiveHeightTolerance;
    const lockedFinishHeightOffset = lockedFinishHeightOffsetRef.current;
    const inLockedHeightBand =
      lockedFinishHeightOffset === null ||
      Math.abs(heightAtCross - lockedFinishHeightOffset) <=
        FINISH_DECK_LOCK_TOLERANCE;
    const inHeightBand = inGeneralHeightBand && inLockedHeightBand;
    const withinFinishLane = Math.abs(sideAtCross) <= laneTolerance;
    const crossingDirectionAvailable = crossingDirection !== null;
    const lockedCrossingDirection = lockedCrossingDirectionRef.current;
    const crossingDirectionMatchesLock =
      lockedCrossingDirection === null ||
      crossingDirection === lockedCrossingDirection;

    previousForwardOffsetRef.current = forwardOffset;
    previousSideOffsetRef.current = sideOffset;
    previousHeightOffsetRef.current = heightOffset;

    if (
      !crossedFinishLine ||
      !crossingDirectionAvailable ||
      !crossingDirectionMatchesLock ||
      !lapArmedRef.current ||
      !withinFinishLane ||
      !inHeightBand
    ) {
      return;
    }

    let velocity;
    try {
      velocity = body.linvel();
    } catch {
      return;
    }
    planarVelocity.set(velocity.x, 0, velocity.z);
    const velocityAlongFinishForward = planarVelocity.dot(FINISH_FORWARD);
    const crossingSpeed = Math.abs(velocityAlongFinishForward);
    const minimumDirectionSpeed = Math.max(
      0.18,
      FINISH_GATE_MIN_DIRECTION_SPEED * 0.15,
    );
    const velocityDirection = velocityAlongFinishForward >= 0 ? 1 : -1;
    const directionAgreesWithCrossing = velocityDirection === crossingDirection;
    if (crossingSpeed < minimumDirectionSpeed || !directionAgreesWithCrossing) {
      return;
    }

    const now = performance.now();
    const lastLapTimestamp = lastLapTimestampRef.current ?? now;
    const cooldownPassed =
      now - lastLapTimestamp >= FINISH_GATE_MIN_LAP_INTERVAL_MS;

    if (
      !cooldownPassed ||
      distanceSinceLapRef.current < FINISH_GATE_MIN_LAP_DISTANCE
    ) {
      return;
    }

    completedLapsRef.current += 1;

    const lapTimeMs = now - lastLapTimestamp;
    const totalTimeMs = now - (raceStartMsRef.current ?? now);

    lastLapTimestampRef.current = now;
    distanceSinceLapRef.current = 0;
    lapArmedRef.current = false;
    if (lockedFinishHeightOffsetRef.current === null) {
      lockedFinishHeightOffsetRef.current = heightAtCross;
    }
    if (lockedCrossingDirectionRef.current === null) {
      lockedCrossingDirectionRef.current = crossingDirection;
    }

    onLapProgress?.({
      completedLaps: completedLapsRef.current,
      lapTimeMs,
      totalTimeMs,
    });

    if (completedLapsRef.current >= targetLaps) {
      raceFinishedRef.current = true;
    }
  });

  return null;
}

function FinishLineMarker() {
  if (!SHOW_FINISH_LINE_MARKER) {
    return null;
  }

  return (
    <group position={FINISH_LINE_POSITION} rotation={[0, FINISH_LINE_YAW, 0]}>
      <mesh position={[0, 1.08, 0]} renderOrder={10}>
        <boxGeometry args={[FINISH_LINE_VISUAL_WIDTH, 1.035, FINISH_LINE_VISUAL_THICKNESS]} />
        <meshStandardMaterial
          color="#2ef2ff"
          emissive="#11414a"
          emissiveIntensity={0.8}
          toneMapped={false}
        />
      </mesh>

      <mesh position={[-FINISH_GATE_HALF_WIDTH, 1.14, 0]} renderOrder={10}>
        <boxGeometry args={[0.22, 1.14, 0.22]} />
        <meshStandardMaterial
          color="#ff6f3d"
          emissive="#462010"
          emissiveIntensity={0.7}
          toneMapped={false}
        />
      </mesh>

      <mesh position={[FINISH_GATE_HALF_WIDTH, 1.14, 0]} renderOrder={10}>
        <boxGeometry args={[0.22, 1.14, 0.22]} />
        <meshStandardMaterial
          color="#ff6f3d"
          emissive="#462010"
          emissiveIntensity={0.7}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
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

      <FinishLineMarker />

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
