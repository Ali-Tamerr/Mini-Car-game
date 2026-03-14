"use client";

import { useKeyboardControls } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import type { RapierRigidBody } from "@react-three/rapier";
import { useEffect, useRef, type MutableRefObject } from "react";
import { Quaternion, Vector3 } from "three";
import { DriveControl } from "./controls";

type CarControllerProps = {
  bodyRef: MutableRefObject<RapierRigidBody | null>;
  spawnPosition: [number, number, number];
  spawnYaw: number;
};

const forwardDir = new Vector3();
const driveDir = new Vector3();
const sideDir = new Vector3();
const planarVelocity = new Vector3();
const rotationQuat = new Quaternion();
const resetQuat = new Quaternion();
const UP = new Vector3(0, 1, 0);

const MAX_SPEED = 24;
const ENGINE_FORCE = 118;
const REVERSE_FORCE = 92;
const TURN_RATE = 2.6;
const LATERAL_GRIP = 5.4;
const COAST_DRAG = 1.1;
const IDLE_YAW_DAMP = 0.86;

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

export function CarController({
  bodyRef,
  spawnPosition,
  spawnYaw,
}: CarControllerProps) {
  const [, getKeys] = useKeyboardControls<DriveControl>();
  const rawKeysRef = useRef<RawKeyState>({ ...defaultRawKeys });

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

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  useFrame((_, delta) => {
    const body = bodyRef.current;
    if (!body) {
      return;
    }

    const keyState = getKeys();
    const rawKeys = rawKeysRef.current;

    const isForward = keyState[DriveControl.Forward] || rawKeys.forward;
    const isBackward = keyState[DriveControl.Backward] || rawKeys.backward;
    const isLeft = keyState[DriveControl.Left] || rawKeys.left;
    const isRight = keyState[DriveControl.Right] || rawKeys.right;
    const isReset = keyState[DriveControl.Reset] || rawKeys.reset;

    if (isReset) {
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

    sideDir.copy(forwardDir).cross(UP).normalize();

    const velocity = body.linvel();
    const planarSpeed = Math.hypot(velocity.x, velocity.z);
    const sideSpeed = velocity.x * sideDir.x + velocity.z * sideDir.z;

    let throttle = 0;
    if (isForward) throttle += 1;
    if (isBackward) throttle -= 1;

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
      const gripImpulse = sideDir
        .clone()
        .multiplyScalar(-sideSpeed * LATERAL_GRIP * delta);
      body.applyImpulse({ x: gripImpulse.x, y: 0, z: gripImpulse.z }, true);
    }

    let steer = 0;
    if (isLeft) steer += 1;
    if (isRight) steer -= 1;

    const angularVelocity = body.angvel();

    if (steer !== 0) {
      const turnScale = Math.max(0.35, Math.min(1.2, planarSpeed / 5));
      const yawSpeed = steer * TURN_RATE * turnScale;
      body.setAngvel({ x: 0, y: yawSpeed, z: 0 }, true);
    } else {
      body.setAngvel({ x: 0, y: angularVelocity.y * IDLE_YAW_DAMP, z: 0 }, true);
    }

    if (planarSpeed > MAX_SPEED) {
      const ratio = MAX_SPEED / planarSpeed;
      body.setLinvel(
        { x: velocity.x * ratio, y: velocity.y, z: velocity.z * ratio },
        true,
      );
    }

    // Keep pitch/roll available for ramp transitions. Angular damping handles stabilization.
  });

  return null;
}
