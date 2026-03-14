"use client";

import { KeyboardControls } from "@react-three/drei";
import { useState } from "react";
import { GameCanvas } from "./GameCanvas";
import { keyboardMap } from "./controls";

export default function GameExperience() {
  const [isCarLoaded, setIsCarLoaded] = useState(false);
  const [assetMissing, setAssetMissing] = useState(false);
  const [cameraZoom, setCameraZoom] = useState(0.9);

  return (
    <div className="game-root">
      <KeyboardControls map={keyboardMap}>
        <GameCanvas
          cameraZoom={cameraZoom}
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

      <div className="game-hud-wrap">
        <div className="game-hud">
          <strong>WASD</strong> drive & steer
          <span>R resets the car</span>
        </div>

        <div className="game-zoom-scroll" role="group" aria-label="Camera zoom control">
          <span className="game-zoom-scroll__label">Zoom</span>
          <div className="game-zoom-scroll__rail">
            <input
              className="game-zoom-scroll__input"
              aria-label="Camera zoom"
              type="range"
              min={0}
              max={100}
              step={1}
              value={Math.round(cameraZoom * 100)}
              onChange={(event) => {
                setCameraZoom(Number(event.currentTarget.value) / 100);
              }}
            />
          </div>
          <span className="game-zoom-scroll__value">{Math.round(cameraZoom * 100)}%</span>
        </div>
      </div>
    </div>
  );
}
