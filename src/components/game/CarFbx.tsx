"use client";

import { useLoader } from "@react-three/fiber";
import { CuboidCollider, RigidBody, type RapierRigidBody } from "@react-three/rapier";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Box3, Mesh, Vector3 } from "three";
import { FBXLoader } from "three-stdlib";
import { CarController } from "./CarController";
import { getFigureEightFrame, getFigureEightPoint } from "./trackMath";

const CAR_MODEL_PATH = "/models/car/car.fbx";
const SPAWN_T = Math.PI;

function CarPlaceholder() {
  return (
    <group>
      <mesh castShadow receiveShadow position={[0, 0.65, 0]}>
        <boxGeometry args={[2, 0.75, 3.5]} />
        <meshStandardMaterial color="#2f87ff" metalness={0.35} roughness={0.42} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, 1.05, -0.2]}>
        <boxGeometry args={[1.4, 0.55, 1.8]} />
        <meshStandardMaterial color="#0f2b5d" metalness={0.28} roughness={0.36} />
      </mesh>
    </group>
  );
}

function LoadedFbxModel({ path }: { path: string }) {
  const fbx = useLoader(FBXLoader, path);

  const normalizedModel = useMemo(() => {
    const model = fbx.clone(true);
    model.traverse((child) => {
      const maybeMesh = child as Mesh;
      if (maybeMesh.isMesh) {
        maybeMesh.castShadow = true;
        maybeMesh.receiveShadow = true;
      }
    });

    const box = new Box3().setFromObject(model);
    const size = new Vector3();
    const center = new Vector3();
    box.getSize(size);

    const maxDimension = Math.max(size.x, size.y, size.z) || 1;
    const targetLength = 3.5;
    const scale = targetLength / maxDimension;
    model.scale.setScalar(scale);

    box.setFromObject(model);
    box.getCenter(center);
    model.position.sub(center);

    box.setFromObject(model);
    model.position.y -= box.min.y;

    return model;
  }, [fbx]);

  return <primitive object={normalizedModel} />;
}

export function CarFbx() {
  const bodyRef = useRef<RapierRigidBody | null>(null);
  const [assetExists, setAssetExists] = useState<boolean | null>(null);

  const spawn = useMemo(() => {
    const frame = getFigureEightFrame(SPAWN_T);
    const point = getFigureEightPoint(SPAWN_T).add(new Vector3(0, 0.78, 0));
    const yaw = Math.atan2(frame.tangent.x, frame.tangent.z);

    return {
      position: [point.x, point.y, point.z] as [number, number, number],
      yaw,
    };
  }, []);

  useEffect(() => {
    let isActive = true;

    fetch(CAR_MODEL_PATH, { method: "HEAD" })
      .then((res) => {
        if (isActive) {
          setAssetExists(res.ok);
        }
      })
      .catch(() => {
        if (isActive) {
          setAssetExists(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  return (
    <>
      <RigidBody
        ref={bodyRef}
        type="dynamic"
        colliders={false}
        position={spawn.position}
        rotation={[0, spawn.yaw, 0]}
        mass={1.9}
        friction={1.05}
        restitution={0.02}
        linearDamping={0.8}
        angularDamping={3.4}
        ccd
        canSleep={false}
        enabledRotations={[false, true, false]}
      >
        <CuboidCollider
          args={[0.9, 0.33, 1.7]}
          position={[0, 0.4, 0]}
          friction={1.2}
          restitution={0.01}
        />

        {assetExists ? (
          <Suspense fallback={<CarPlaceholder />}>
            <LoadedFbxModel path={CAR_MODEL_PATH} />
          </Suspense>
        ) : (
          <CarPlaceholder />
        )}
      </RigidBody>

      <CarController bodyRef={bodyRef} spawnPosition={spawn.position} spawnYaw={spawn.yaw} />
    </>
  );
}
