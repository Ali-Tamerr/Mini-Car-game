"use client";

import { useGLTF } from "@react-three/drei";
import { RigidBody } from "@react-three/rapier";
import { useEffect, useMemo } from "react";
import { Mesh, Object3D } from "three";
import { publicAssetPath } from "./publicAssetPath";

const TRACK_GLB_PATH = publicAssetPath("/track/mini_race_track_figure_8.glb");
const TRACK_HORIZONTAL_STRETCH = 1.3;
const COLLIDER_EXCLUDED_NAME_SNIPPETS = [
  "wiremesh",
  "railing_metal",
  "ground",
  "pillars",
];

function prepareTrackScene(root: Object3D): Object3D {
  const scene = root.clone(true);
  scene.scale.set(TRACK_HORIZONTAL_STRETCH, 1, 1.5);
  scene.updateMatrixWorld(true);

  const nodesToRemove: Object3D[] = [];

  scene.traverse((node) => {
    const maybeMesh = node as Mesh;
    if (!maybeMesh.isMesh) {
      return;
    }

    const meshName = maybeMesh.name.toLowerCase();
    const shouldExclude = COLLIDER_EXCLUDED_NAME_SNIPPETS.some((snippet) =>
      meshName.includes(snippet),
    );

    if (shouldExclude) {
      nodesToRemove.push(maybeMesh);
      return;
    }

    maybeMesh.castShadow = true;
    maybeMesh.receiveShadow = true;
  });

  for (const node of nodesToRemove) {
    node.parent?.remove(node);
  }

  scene.updateMatrixWorld(true);

  return scene;
}

type TrackFigureEightProps = {
  onLoaded?: () => void;
};

export function TrackFigureEight({ onLoaded }: TrackFigureEightProps) {
  const gltf = useGLTF(TRACK_GLB_PATH);
  const trackScene = useMemo(() => prepareTrackScene(gltf.scene), [gltf.scene]);

  useEffect(() => {
    onLoaded?.();
  }, [onLoaded, trackScene]);

  return (
    <RigidBody
      type="fixed"
      colliders="trimesh"
      friction={1.25}
      restitution={0.02}
    >
      <primitive object={trackScene} />
    </RigidBody>
  );
}

useGLTF.preload(TRACK_GLB_PATH);
