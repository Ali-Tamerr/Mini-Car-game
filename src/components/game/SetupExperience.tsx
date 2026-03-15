"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CarShowcase } from "./CarShowcase";

const MIN_LAPS = 1;
const MAX_LAPS = 12;

export default function SetupExperience() {
  const router = useRouter();
  const [targetLaps, setTargetLaps] = useState(1);
  const [isCarReady, setIsCarReady] = useState(false);
  const [assetMissing, setAssetMissing] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  const showLoading = !isCarReady || isStarting;

  return (
    <main className="setup-page-root">
      <div className={`setup-panel setup-panel--page${showLoading ? " setup-panel--hidden" : ""}`}>
        <div className="setup-grid">
          <section className="setup-block">
            <h2>Choose car</h2>

            <div className="setup-selector-row">
              <button
                type="button"
                className="setup-arrow-button"
                disabled
                aria-label="Previous car"
              >
                &lt;
              </button>

              <div className="setup-car-preview">
                <CarShowcase
                  onLoaded={() => {
                    setIsCarReady(true);
                  }}
                  onAssetMissing={() => {
                    setAssetMissing(true);
                  }}
                />
              </div>

              <button
                type="button"
                className="setup-arrow-button"
                disabled
                aria-label="Next car"
              >
                &gt;
              </button>
            </div>

            <p className="setup-note">
              The only car in the collection for now.
              Car arrows stay disabled until more cars are added.
            </p>
          </section>

          <section className="setup-block">
            <h2>Number of laps</h2>

            <div className="setup-selector-row setup-lap-row">
              <button
                type="button"
                className="setup-arrow-button"
                disabled={targetLaps <= MIN_LAPS}
                aria-label="Decrease laps"
                onClick={() => {
                  setTargetLaps((previous) => Math.max(MIN_LAPS, previous - 1));
                }}
              >
                &lt;
              </button>

              <strong className="setup-lap-value">{targetLaps}</strong>

              <button
                type="button"
                className="setup-arrow-button"
                disabled={targetLaps >= MAX_LAPS}
                aria-label="Increase laps"
                onClick={() => {
                  setTargetLaps((previous) => Math.min(MAX_LAPS, previous + 1));
                }}
              >
                &gt;
              </button>
            </div>
          </section>
        </div>

        <button
          type="button"
          className="setup-start-button"
          disabled={!isCarReady || isStarting || assetMissing}
          onClick={() => {
            setIsStarting(true);
            router.push(`/race?laps=${targetLaps}`);
          }}
        >
          Start!
        </button>
      </div>

      {showLoading && (
        <div className="runtime-loading-overlay">
          <h2>loading...</h2>
          {assetMissing && (
            <p>
              Custom car model was not found. Add car.glb or car.fbx to public/models/car.
            </p>
          )}
        </div>
      )}
    </main>
  );
}
