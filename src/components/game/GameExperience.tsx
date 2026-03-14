"use client";

import { KeyboardControls } from "@react-three/drei";
import { GameCanvas } from "./GameCanvas";
import { keyboardMap } from "./controls";

export default function GameExperience() {
  return (
    <div className="game-root">
      <KeyboardControls map={keyboardMap}>
        <GameCanvas />
      </KeyboardControls>

      <div className="game-hud">
        <strong>WASD</strong> drive & steer
        <span>R resets the car</span>
      </div>
    </div>
  );
}
