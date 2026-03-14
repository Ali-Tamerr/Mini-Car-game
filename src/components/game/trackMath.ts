import * as THREE from "three";

export const TRACK_ROAD_WIDTH = 8;
export const TRACK_BORDER_WIDTH = 8.9;

const STRAIGHT_HALF_LENGTH = 18;
const TURN_RADIUS = 10;
const TAU = Math.PI * 2;
const PI = Math.PI;
const UP = new THREE.Vector3(0, 1, 0);

const STRAIGHT_LENGTH = STRAIGHT_HALF_LENGTH * 2;
const ARC_LENGTH = PI * TURN_RADIUS;
const TOTAL_TRACK_LENGTH = STRAIGHT_LENGTH * 2 + ARC_LENGTH * 2;

export type TrackFrame = {
  center: THREE.Vector3;
  tangent: THREE.Vector3;
  side: THREE.Vector3;
};

export type TrackColliderSegment = {
  position: [number, number, number];
  rotation: [number, number, number];
  halfLength: number;
};

export function getFigureEightPoint(t: number): THREE.Vector3 {
  const wrapped = THREE.MathUtils.euclideanModulo(t, TAU);
  const distanceAlongTrack = (wrapped / TAU) * TOTAL_TRACK_LENGTH;

  if (distanceAlongTrack < STRAIGHT_LENGTH) {
    const x = -STRAIGHT_HALF_LENGTH + distanceAlongTrack;
    return new THREE.Vector3(x, 0, TURN_RADIUS);
  }

  if (distanceAlongTrack < STRAIGHT_LENGTH + ARC_LENGTH) {
    const localDistance = distanceAlongTrack - STRAIGHT_LENGTH;
    const angle = PI * 0.5 - localDistance / TURN_RADIUS;

    const x = STRAIGHT_HALF_LENGTH + Math.cos(angle) * TURN_RADIUS;
    const z = Math.sin(angle) * TURN_RADIUS;
    return new THREE.Vector3(x, 0, z);
  }

  if (distanceAlongTrack < STRAIGHT_LENGTH * 2 + ARC_LENGTH) {
    const localDistance = distanceAlongTrack - STRAIGHT_LENGTH - ARC_LENGTH;
    const x = STRAIGHT_HALF_LENGTH - localDistance;
    return new THREE.Vector3(x, 0, -TURN_RADIUS);
  }

  const localDistance = distanceAlongTrack - STRAIGHT_LENGTH * 2 - ARC_LENGTH;
  const angle = -PI * 0.5 - localDistance / TURN_RADIUS;

  const x = -STRAIGHT_HALF_LENGTH + Math.cos(angle) * TURN_RADIUS;
  const z = Math.sin(angle) * TURN_RADIUS;
  return new THREE.Vector3(x, 0, z);
}

export function getFigureEightFrame(t: number): TrackFrame {
  const delta = 0.0008;
  const center = getFigureEightPoint(t);

  const before = getFigureEightPoint(t - delta);
  const after = getFigureEightPoint(t + delta);

  const tangent = after.sub(before).normalize();
  const side = new THREE.Vector3().crossVectors(UP, tangent).normalize();

  if (side.lengthSq() < 1e-6) {
    side.set(1, 0, 0);
  }

  return { center, tangent, side };
}

export function createTrackStripGeometry(
  width: number,
  samples = 560,
  yOffset = 0,
  options?: { doubleSided?: boolean },
): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const doubleSided = options?.doubleSided ?? false;

  const heightOffset = new THREE.Vector3(0, yOffset, 0);

  for (let i = 0; i <= samples; i += 1) {
    const t = (i / samples) * TAU;
    const { center, side } = getFigureEightFrame(t);

    const left = center
      .clone()
      .add(side.clone().multiplyScalar(width * 0.5))
      .add(heightOffset);
    const right = center
      .clone()
      .add(side.clone().multiplyScalar(-width * 0.5))
      .add(heightOffset);

    positions.push(left.x, left.y, left.z);
    positions.push(right.x, right.y, right.z);

    uvs.push(0, i / samples);
    uvs.push(1, i / samples);
  }

  for (let i = 0; i < samples; i += 1) {
    const a = i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;

    indices.push(a, b, c);
    indices.push(b, d, c);

    if (doubleSided) {
      indices.push(c, b, a);
      indices.push(c, d, b);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return geometry;
}

export function createTrackColliderSegments(samples = 1200): TrackColliderSegment[] {
  const segments: TrackColliderSegment[] = [];

  for (let i = 0; i < samples; i += 1) {
    const t0 = (i / samples) * TAU;
    const t1 = ((i + 1) / samples) * TAU;

    const p0 = getFigureEightPoint(t0);
    const p1 = getFigureEightPoint(t1);
    const segmentVector = p1.clone().sub(p0);
    const segmentLength = segmentVector.length();

    if (segmentLength < 1e-4) {
      continue;
    }

    const tangent = segmentVector.clone().normalize();
    const midpoint = p0.clone().add(p1).multiplyScalar(0.5);

    const yaw = Math.atan2(tangent.x, tangent.z);
    const clampedY = Math.max(-1, Math.min(1, tangent.y));
    const pitch = -Math.asin(clampedY);

    segments.push({
      position: [midpoint.x, midpoint.y - 0.11, midpoint.z],
      rotation: [pitch, yaw, 0],
      halfLength: Math.max(0.09, segmentLength * 0.54),
    });
  }

  return segments;
}
