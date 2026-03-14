"use client";

import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Box3,
  BufferGeometry,
  Group,
  Material,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Vector3,
} from "three";
import { FBXLoader, GLTFLoader } from "three-stdlib";

const CAR_GLB_PATH = "/models/car/car.glb";
const CAR_FBX_PATH = "/models/car/car.fbx";
const SHOWCASE_GROUND_CLEARANCE = 0.08;

type CarAssetFormat = "glb" | "fbx" | "none";

type CarShowcaseProps = {
  onLoaded?: () => void;
  onAssetMissing?: () => void;
};

type CarAssetProbeState = "checking" | CarAssetFormat;

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
    if (!maybeMesh.isMesh) {
      return;
    }

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
  });

  const box = new Box3().setFromObject(model);
  const size = new Vector3();
  const center = new Vector3();
  box.getSize(size);

  const maxDimension = Math.max(size.x, size.y, size.z) || 1;
  const targetLength = 2.9;
  model.scale.setScalar(targetLength / maxDimension);

  box.setFromObject(model);
  box.getCenter(center);
  model.position.sub(center);

  box.setFromObject(model);
  model.position.y -= box.min.y;
  model.position.y += SHOWCASE_GROUND_CLEARANCE;

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

function SlowSpin({ children }: { children: ReactNode }) {
  const groupRef = useRef<Group | null>(null);

  useFrame((_, delta) => {
    if (!groupRef.current) {
      return;
    }

    groupRef.current.rotation.y += delta * 0.24;
  });

  return <group ref={groupRef}>{children}</group>;
}

export function CarShowcase({ onLoaded, onAssetMissing }: CarShowcaseProps) {
  const [assetFormat, setAssetFormat] = useState<CarAssetProbeState>("checking");
  const hasNotifiedLoadedRef = useRef(false);

  const notifyLoadedOnce = () => {
    if (hasNotifiedLoadedRef.current) {
      return;
    }

    hasNotifiedLoadedRef.current = true;
    onLoaded?.();
  };

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

  return (
    <div className="setup-car-canvas">
      <Canvas
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
        camera={{ position: [0, 1.15, 3.3], fov: 35 }}
        style={{ width: "100%", height: "100%" }}
      >
        <ambientLight intensity={0.95} />
        <directionalLight position={[4, 6, 4]} intensity={1.2} />
        <directionalLight position={[-3, 4, -2]} intensity={0.45} />

        <Suspense fallback={null}>
          <SlowSpin>
            {assetFormat === "glb" ? (
              <LoadedGlbModel path={CAR_GLB_PATH} onLoaded={notifyLoadedOnce} />
            ) : assetFormat === "fbx" ? (
              <LoadedFbxModel path={CAR_FBX_PATH} onLoaded={notifyLoadedOnce} />
            ) : (
              <group />
            )}
          </SlowSpin>
        </Suspense>
      </Canvas>
    </div>
  );
}
