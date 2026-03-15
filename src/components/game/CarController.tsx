"use client";

import { useFrame } from "@react-three/fiber";
import type { RapierRigidBody } from "@react-three/rapier";
import { useEffect, useRef, type MutableRefObject } from "react";
import { Quaternion, Vector3 } from "three";

type CarControllerProps = {
  bodyRef: MutableRefObject<RapierRigidBody | null>;
  spawnPosition: [number, number, number];
  spawnYaw: number;
  controlsEnabled: boolean;
};

const forwardDir = new Vector3();
const driveDir = new Vector3();
const rightDir = new Vector3();
const sideDir = new Vector3();
const planarVelocity = new Vector3();
const rotationQuat = new Quaternion();
const inverseRotationQuat = new Quaternion();
const resetQuat = new Quaternion();
const worldAngularVelocityVec = new Vector3();
const localAngularVelocityVec = new Vector3();
const desiredAngularVelocityVec = new Vector3();
const pitchAngularVelocityVec = new Vector3();
const rollAngularVelocityVec = new Vector3();
const UP = new Vector3(0, 1, 0);

const MAX_SPEED = 10;
const ENGINE_FORCE = 118;
const REVERSE_FORCE = 92;
const TURN_RATE = 1.6;
const LATERAL_GRIP = 4.4;
const STRAIGHT_LINE_GRIP = 10.8;
const COAST_DRAG = 1.1;
const IDLE_YAW_DAMP = 0.86;
const STRAIGHT_ASSIST_MIN_SPEED = 1.3;
const STRAIGHT_ASSIST_GAIN = 5.8;
const STRAIGHT_ASSIST_MAX_YAW_SPEED = 2.1;
const STRAIGHT_ASSIST_ANGULAR_DAMP = 0.62;
const PITCH_RATE_DAMP = 0.45;
const MAX_NOSE_DOWN_ANGLE = 0.16;
const MAX_NOSE_UP_ANGLE = 0.24;
const PITCH_RETURN_GAIN = 14;
const MAX_PITCH_RATE = 2.4;
const ROLL_RATE_DAMP = 0.38;
const MAX_ROLL_ANGLE = 0.12;
const ROLL_RETURN_GAIN = 14;
const MAX_ROLL_RATE = 2.2;
const SPAWN_GUARD_SECONDS = 12;
const SPAWN_GUARD_MIN_Y = -0.25;
const SPAWN_GUARD_RADIUS = 16;

type RawKeyState = {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  reset: boolean;
};

const defaultRawKeys: RawKeyState = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  reset: false,
};

function isArrowCode(code: string): boolean {
  return (
    code === "ArrowUp" ||
    code === "ArrowDown" ||
    code === "ArrowLeft" ||
    code === "ArrowRight"
  );
}

function normalizeAngle(value: number): number {
  return Math.atan2(Math.sin(value), Math.cos(value));
}

export function CarController({
  bodyRef,
  spawnPosition,
  spawnYaw,
  controlsEnabled,
}: CarControllerProps) {
  const rawKeysRef = useRef<RawKeyState>({ ...defaultRawKeys });
  const spawnGuardElapsedRef = useRef(0);
  const headingLockYawRef = useRef<number | null>(null);

  const resetToSpawn = (body: RapierRigidBody) => {
    spawnGuardElapsedRef.current = 0;
    headingLockYawRef.current = null;
    body.setTranslation(
      { x: spawnPosition[0], y: spawnPosition[1], z: spawnPosition[2] },
      true,
    );
    body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    resetQuat.setFromAxisAngle(new Vector3(0, 1, 0), spawnYaw);
    body.setRotation(
      {
        x: resetQuat.x,
        y: resetQuat.y,
        z: resetQuat.z,
        w: resetQuat.w,
      },
      true,
    );
  };

  useEffect(() => {
    const setRawKey = (code: string, pressed: boolean) => {
      const rawKeys = rawKeysRef.current;

      switch (code) {
        case "KeyW":
        case "ArrowUp":
          rawKeys.forward = pressed;
          break;
        case "KeyS":
        case "ArrowDown":
          rawKeys.backward = pressed;
          break;
        case "KeyA":
        case "ArrowLeft":
          rawKeys.left = pressed;
          break;
        case "KeyD":
        case "ArrowRight":
          rawKeys.right = pressed;
          break;
        case "KeyR":
          rawKeys.reset = pressed;
          break;
        default:
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isArrowCode(event.code)) {
        event.preventDefault();
      }
      setRawKey(event.code, true);
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (isArrowCode(event.code)) {
        event.preventDefault();
      }
      setRawKey(event.code, false);
    };

    const handleBlur = () => {
      rawKeysRef.current = { ...defaultRawKeys };
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, []);

  useFrame((_, delta) => {
    const body = bodyRef.current;
    if (!body) {
      return;
    }

    spawnGuardElapsedRef.current += delta;
    const rawKeys = rawKeysRef.current;

    const isForward = rawKeys.forward;
    const isBackward = rawKeys.backward;
    const isLeft = rawKeys.left;
    const isRight = rawKeys.right;
    const isReset = rawKeys.reset;

    const translation = body.translation();
    const distanceFromSpawn = Math.hypot(
      translation.x - spawnPosition[0],
      translation.z - spawnPosition[2],
    );
    if (
      spawnGuardElapsedRef.current < SPAWN_GUARD_SECONDS &&
      translation.y < SPAWN_GUARD_MIN_Y &&
      distanceFromSpawn < SPAWN_GUARD_RADIUS
    ) {
      resetToSpawn(body);
      return;
    }

    if (isReset) {
      resetToSpawn(body);
      return;
    }

    if (!controlsEnabled) {
      headingLockYawRef.current = null;
      const velocity = body.linvel();
      const angularVelocity = body.angvel();
      body.setLinvel(
        { x: velocity.x * 0.86, y: velocity.y, z: velocity.z * 0.86 },
        true,
      );
      body.setAngvel(
        { x: angularVelocity.x * 0.4, y: angularVelocity.y * 0.4, z: angularVelocity.z * 0.4 },
        true,
      );
      return;
    }

    const worldRotation = body.rotation();
    rotationQuat.set(
      worldRotation.x,
      worldRotation.y,
      worldRotation.z,
      worldRotation.w,
    );

    driveDir.set(0, 0, 1).applyQuaternion(rotationQuat);
    if (driveDir.lengthSq() > 1e-6) {
      driveDir.normalize();
    }

    forwardDir.copy(driveDir).setY(0);
    if (forwardDir.lengthSq() > 1e-6) {
      forwardDir.normalize();
    } else {
      forwardDir.set(0, 0, 1);
    }

    rightDir.set(1, 0, 0).applyQuaternion(rotationQuat);
    if (rightDir.lengthSq() > 1e-6) {
      rightDir.normalize();
    } else {
      rightDir.set(1, 0, 0);
    }

    sideDir.copy(forwardDir).cross(UP).normalize();

    const velocity = body.linvel();
    const planarSpeed = Math.hypot(velocity.x, velocity.z);
    const sideSpeed = velocity.x * sideDir.x + velocity.z * sideDir.z;
    const headingYaw = Math.atan2(forwardDir.x, forwardDir.z);

    let throttle = 0;
    if (isForward) throttle += 1;
    if (isBackward) throttle -= 1;

    let steer = 0;
    if (isLeft) steer += 1;
    if (isRight) steer -= 1;

    if (steer !== 0 && throttle < 0) {
      steer *= -1;
    }

    if (throttle !== 0) {
      const driveForce = throttle > 0 ? ENGINE_FORCE : REVERSE_FORCE;
      // Use local forward (including slope direction) so the car can climb the overpass smoothly.
      const impulse = driveDir.clone().multiplyScalar(throttle * driveForce * delta);
      body.applyImpulse({ x: impulse.x, y: impulse.y, z: impulse.z }, true);
    } else if (planarSpeed > 0.02) {
      planarVelocity.set(velocity.x, 0, velocity.z).multiplyScalar(-COAST_DRAG * delta);
      body.applyImpulse(
        { x: planarVelocity.x, y: 0, z: planarVelocity.z },
        true,
      );
    }

    // Reduce sideways skid so steering feels intentional with a single-body car.
    if (Math.abs(sideSpeed) > 0.01) {
      const activeGrip = steer === 0 && throttle !== 0 ? STRAIGHT_LINE_GRIP : LATERAL_GRIP;
      const gripImpulse = sideDir
        .clone()
        .multiplyScalar(-sideSpeed * activeGrip * delta);
      body.applyImpulse({ x: gripImpulse.x, y: 0, z: gripImpulse.z }, true);
    }

    const angularVelocity = body.angvel();
    worldAngularVelocityVec.set(
      angularVelocity.x,
      angularVelocity.y,
      angularVelocity.z,
    );
    inverseRotationQuat.copy(rotationQuat).invert();
    localAngularVelocityVec
      .copy(worldAngularVelocityVec)
      .applyQuaternion(inverseRotationQuat);

    const localPitchRate = localAngularVelocityVec.x;
    const localRollRate = localAngularVelocityVec.z;
    const pitchAngle = Math.asin(Math.max(-1, Math.min(1, driveDir.y)));
    const rollAngle = Math.asin(Math.max(-1, Math.min(1, rightDir.y)));

    let pitchCorrection = 0;
    if (pitchAngle < -MAX_NOSE_DOWN_ANGLE) {
      // Negative x angular velocity lifts the nose for this +Z-forward convention.
      pitchCorrection = -(-MAX_NOSE_DOWN_ANGLE - pitchAngle) * PITCH_RETURN_GAIN;
    } else if (pitchAngle > MAX_NOSE_UP_ANGLE) {
      // Positive x angular velocity lowers the nose back toward neutral.
      pitchCorrection = (pitchAngle - MAX_NOSE_UP_ANGLE) * PITCH_RETURN_GAIN;
    }

    const stabilizedPitchRate = Math.max(
      -MAX_PITCH_RATE,
      Math.min(MAX_PITCH_RATE, localPitchRate * PITCH_RATE_DAMP + pitchCorrection),
    );

    let rollCorrection = 0;
    if (rollAngle < -MAX_ROLL_ANGLE) {
      rollCorrection = -(-MAX_ROLL_ANGLE - rollAngle) * ROLL_RETURN_GAIN;
    } else if (rollAngle > MAX_ROLL_ANGLE) {
      rollCorrection = (rollAngle - MAX_ROLL_ANGLE) * ROLL_RETURN_GAIN;
    }

    const stabilizedRollRate = Math.max(
      -MAX_ROLL_RATE,
      Math.min(MAX_ROLL_RATE, localRollRate * ROLL_RATE_DAMP + rollCorrection),
    );

    let yawCommand = angularVelocity.y * IDLE_YAW_DAMP;

    if (steer !== 0) {
      headingLockYawRef.current = headingYaw;
      const turnScale = Math.max(0.35, Math.min(1.2, planarSpeed / 5));
      yawCommand = steer * TURN_RATE * turnScale;
    } else {
      const shouldAssistStraight = throttle !== 0 && planarSpeed > STRAIGHT_ASSIST_MIN_SPEED;

      if (shouldAssistStraight) {
        if (headingLockYawRef.current === null) {
          headingLockYawRef.current = headingYaw;
        }

        const yawError = normalizeAngle(headingLockYawRef.current - headingYaw);
        const yawAssist = Math.max(
          -STRAIGHT_ASSIST_MAX_YAW_SPEED,
          Math.min(STRAIGHT_ASSIST_MAX_YAW_SPEED, yawError * STRAIGHT_ASSIST_GAIN),
        );
        yawCommand = yawAssist + angularVelocity.y * STRAIGHT_ASSIST_ANGULAR_DAMP;
      } else {
        headingLockYawRef.current = null;
        yawCommand = angularVelocity.y * IDLE_YAW_DAMP;
      }
    }

    desiredAngularVelocityVec.copy(UP).multiplyScalar(yawCommand);
    pitchAngularVelocityVec.copy(rightDir).multiplyScalar(stabilizedPitchRate);
    rollAngularVelocityVec.copy(driveDir).multiplyScalar(stabilizedRollRate);
    desiredAngularVelocityVec.add(pitchAngularVelocityVec).add(rollAngularVelocityVec);

    body.setAngvel(
      {
        x: desiredAngularVelocityVec.x,
        y: desiredAngularVelocityVec.y,
        z: desiredAngularVelocityVec.z,
      },
      true,
    );

    if (planarSpeed > MAX_SPEED) {
      const ratio = MAX_SPEED / planarSpeed;
      body.setLinvel(
        { x: velocity.x * ratio, y: velocity.y, z: velocity.z * ratio },
        true,
      );
    }

    // Keep pitch/roll available for ramp transitions while local-axis stabilization prevents side lean.
  });

  return null;
}
