import type { KeyboardControlsEntry } from "@react-three/drei";

export enum DriveControl {
  Forward = "forward",
  Backward = "backward",
  Left = "left",
  Right = "right",
  Reset = "reset",
}

export const keyboardMap: KeyboardControlsEntry<DriveControl>[] = [
  { name: DriveControl.Forward, keys: ["KeyW", "ArrowUp"] },
  { name: DriveControl.Backward, keys: ["KeyS", "ArrowDown"] },
  { name: DriveControl.Left, keys: ["KeyA", "ArrowLeft"] },
  { name: DriveControl.Right, keys: ["KeyD", "ArrowRight"] },
  { name: DriveControl.Reset, keys: ["KeyR"] },
];
