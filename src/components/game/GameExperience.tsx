"use client";

import { KeyboardControls } from "@react-three/drei";
import { useState } from "react";
import { GameCanvas } from "./GameCanvas";
import { keyboardMap } from "./controls";

export default function GameExperience() {
  const [isCarLoaded, setIsCarLoaded] = useState(false);
  const [assetMissing, setAssetMissing] = useState(false);

  return (
    <div className="game-root">
      <KeyboardControls map={keyboardMap}>
        <GameCanvas
          onCarLoaded={() => {
            setIsCarLoaded(true);
            setAssetMissing(false);
          }}
          onCarAssetMissing={() => {
            setAssetMissing(true);
          }}
        />
      </KeyboardControls>

      {!isCarLoaded && (
        <div className="car-loading-overlay">
          <h2>Loading Car Model...</h2>
          <p>
            {assetMissing
              ? "No car model found in public/models/car. Drop car.glb or car.fbx there."
              : "Preparing your imported car. This screen disappears after a successful load."}
          </p>
        </div>
      )}

      <div className="game-hud">
        <strong>WASD</strong> drive & steer
        <span>R resets the car</span>
      </div>
    </div>
  );
}
