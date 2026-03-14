"use client";

import { useLoader } from "@react-three/fiber";
import { CuboidCollider, RigidBody, type RapierRigidBody } from "@react-three/rapier";
import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import {
  Box3,
  BufferGeometry,
  Material,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Vector3,
} from "three";
import { FBXLoader, GLTFLoader } from "three-stdlib";
import { CarController } from "./CarController";

const CAR_GLB_PATH = "/models/car/car.glb";
const CAR_FBX_PATH = "/models/car/car.fbx";
const VISUAL_GROUND_CLEARANCE = 0.20;
const SPAWN_POSITION: [number, number, number] = [0, 9.2, 0];
const SPAWN_YAW = Math.PI * 0.5;

type CarAssetFormat = "glb" | "fbx" | "none";
type CarFbxProps = {
  bodyRef: MutableRefObject<RapierRigidBody | null>;
  onLoaded?: () => void;
  onAssetMissing?: () => void;
};

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

function tuneMaterial(input: Material): Material {
  const material = input.clone();
  const candidate = material as MeshStandardMaterial;

  if ("metalness" in candidate && typeof candidate.metalness === "number") {
    candidate.metalness = Math.min(candidate.metalness, 0.25);
  }
  if ("roughness" in candidate && typeof candidate.roughness === "number") {
    candidate.roughness = Math.max(candidate.roughness, 0.62);
  }

  material.needsUpdate = true;
  return material;
}

function hasInvalidVertices(geometry: BufferGeometry): boolean {
  const position = geometry.getAttribute("position");
  if (!position || position.count === 0) {
    return true;
  }

  const values = position.array as ArrayLike<number>;
  const sampleStep = Math.max(3, Math.floor(values.length / 900));

  for (let i = 0; i < values.length; i += sampleStep) {
    const value = values[i];
    if (!Number.isFinite(value)) {
      return true;
    }
  }

  return false;
}

function normalizeModel(root: Object3D): Object3D {
  const model = root.clone(true);
  model.traverse((child) => {
    const maybeMesh = child as Mesh;
    if (maybeMesh.isMesh) {
      const geometry = maybeMesh.geometry as BufferGeometry;
      if (!geometry || hasInvalidVertices(geometry)) {
        maybeMesh.visible = false;
        return;
      }

      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      geometry.computeVertexNormals();

      const sphere = geometry.boundingSphere;
      if (!sphere || !Number.isFinite(sphere.radius) || sphere.radius <= 0) {
        maybeMesh.visible = false;
        return;
      }

      if (Array.isArray(maybeMesh.material)) {
        maybeMesh.material = maybeMesh.material.map((material) => tuneMaterial(material));
      } else if (maybeMesh.material) {
        maybeMesh.material = tuneMaterial(maybeMesh.material);
      }

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
  model.position.y += VISUAL_GROUND_CLEARANCE;

  return model;
}

function LoadedFbxModel({ path, onLoaded }: { path: string; onLoaded?: () => void }) {
  const fbx = useLoader(FBXLoader, path);

  const normalizedModel = useMemo(() => normalizeModel(fbx), [fbx]);

  useEffect(() => {
    onLoaded?.();
  }, [onLoaded]);

  return <primitive object={normalizedModel} />;
}

function LoadedGlbModel({ path, onLoaded }: { path: string; onLoaded?: () => void }) {
  const gltf = useLoader(GLTFLoader, path);

  const normalizedModel = useMemo(() => normalizeModel(gltf.scene), [gltf]);

  useEffect(() => {
    onLoaded?.();
  }, [onLoaded]);

  return <primitive object={normalizedModel} />;
}

export function CarFbx({ bodyRef, onLoaded, onAssetMissing }: CarFbxProps) {
  const [assetFormat, setAssetFormat] = useState<CarAssetFormat>("none");
  const hasNotifiedLoaded = useRef(false);

  const spawn = useMemo(
    () => ({
      position: SPAWN_POSITION,
      yaw: SPAWN_YAW,
    }),
    [],
  );

  useEffect(() => {
    let isActive = true;

    const selectAssetFormat = async () => {
      try {
        const glbRes = await fetch(CAR_GLB_PATH, { method: "HEAD" });
        if (isActive && glbRes.ok) {
          setAssetFormat("glb");
          return;
        }

        const fbxRes = await fetch(CAR_FBX_PATH, { method: "HEAD" });
        if (isActive && fbxRes.ok) {
          setAssetFormat("fbx");
          return;
        }

        if (isActive) {
          setAssetFormat("none");
        }
      } catch {
        if (isActive) {
          setAssetFormat("none");
        }
      }
    };

    void selectAssetFormat();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (assetFormat === "none") {
      onAssetMissing?.();
    }
  }, [assetFormat, onAssetMissing]);

  const notifyLoadedOnce = () => {
    if (!hasNotifiedLoaded.current) {
      hasNotifiedLoaded.current = true;
      onLoaded?.();
    }
  };

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
        enabledRotations={[true, true, false]}
      >
        <CuboidCollider
          args={[0.9, 0.33, 1.7]}
          position={[0, 0.33, 0]}
          friction={1.2}
          restitution={0.01}
        />

        {assetFormat === "glb" ? (
          <Suspense fallback={<CarPlaceholder />}>
            <LoadedGlbModel path={CAR_GLB_PATH} onLoaded={notifyLoadedOnce} />
          </Suspense>
        ) : assetFormat === "fbx" ? (
          <Suspense fallback={<CarPlaceholder />}>
            <LoadedFbxModel path={CAR_FBX_PATH} onLoaded={notifyLoadedOnce} />
          </Suspense>
        ) : (
          <CarPlaceholder />
        )}
      </RigidBody>

      <CarController bodyRef={bodyRef} spawnPosition={spawn.position} spawnYaw={spawn.yaw} />
    </>
  );
}
