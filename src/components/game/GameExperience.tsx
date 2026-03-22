"use client";

import { KeyboardControls } from "@react-three/drei";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { GameCanvas, type LapProgressPayload, type RacePhase } from "./GameCanvas";
import { keyboardMap } from "./controls";

const MIN_LAPS = 1;
const MAX_LAPS = 12;

type GameExperienceProps = {
  initialLaps?: number;
};

function clampLaps(value: number): number {
  if (!Number.isFinite(value)) {
    return 4;
  }

  return Math.min(MAX_LAPS, Math.max(MIN_LAPS, Math.round(value)));
}

function formatRaceTime(ms: number): string {
  const safe = Math.max(0, ms);
  const totalSeconds = Math.floor(safe / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const centiseconds = Math.floor((safe % 1000) / 10);

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(centiseconds).padStart(2, "0")}`;
}

export default function GameExperience({ initialLaps = 4 }: GameExperienceProps) {
  const router = useRouter();
  const [isCarLoaded, setIsCarLoaded] = useState(false);
  const [isTrackLoaded, setIsTrackLoaded] = useState(false);
  const [assetMissing, setAssetMissing] = useState(false);
  const [cameraZoom, setCameraZoom] = useState(0.9);
  const [racePhase, setRacePhase] = useState<RacePhase>("setup");
  const [raceSessionId] = useState(0);
  const [targetLaps, setTargetLaps] = useState(() => clampLaps(initialLaps));
  const [completedLaps, setCompletedLaps] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [lastLapMs, setLastLapMs] = useState<number | null>(null);
  const [bestLapMs, setBestLapMs] = useState<number | null>(null);
  const [finishTimeMs, setFinishTimeMs] = useState<number | null>(null);
  const raceStartMsRef = useRef<number | null>(null);
  const carLoadedRef = useRef(false);
  const trackLoadedRef = useRef(false);
  const assetMissingRef = useRef(false);
  const racePhaseRef = useRef<RacePhase>("setup");
  const sceneReady = isCarLoaded && isTrackLoaded && !assetMissing;

  useEffect(() => {
    const lapsParam = new URLSearchParams(window.location.search).get("laps");
    if (lapsParam !== null) {
      setTargetLaps(clampLaps(Number(lapsParam)));
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const navigationEntry = window.performance
      .getEntriesByType("navigation")
      .at(0) as PerformanceNavigationTiming | undefined;
    const isReload = navigationEntry?.type === "reload";

    let initialDocumentPathname: string | null = null;
    if (navigationEntry?.name) {
      try {
        initialDocumentPathname = new URL(navigationEntry.name).pathname;
      } catch {
        initialDocumentPathname = null;
      }
    }

    const loadedRaceDocument =
      initialDocumentPathname === "/race" ||
      initialDocumentPathname === "/race/" ||
      initialDocumentPathname?.startsWith("/race/") === true;

    if (!isReload || !loadedRaceDocument) {
      return;
    }

    router.replace("/");
  }, [router]);

  const beginRaceIfReady = () => {
    if (racePhaseRef.current !== "setup") {
      return;
    }

    if (!carLoadedRef.current || !trackLoadedRef.current || assetMissingRef.current) {
      return;
    }

    raceStartMsRef.current = performance.now();
    racePhaseRef.current = "racing";
    setRacePhase("racing");
  };

  useEffect(() => {
    if (racePhase !== "racing") {
      return;
    }

    const intervalId = window.setInterval(() => {
      if (raceStartMsRef.current === null) {
        return;
      }

      setElapsedMs(performance.now() - raceStartMsRef.current);
    }, 50);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [racePhase]);

  const handleLapProgress = (payload: LapProgressPayload) => {
    if (racePhase !== "racing") {
      return;
    }

    setCompletedLaps(payload.completedLaps);
    setElapsedMs(payload.totalTimeMs);
    setLastLapMs(payload.lapTimeMs);
    setBestLapMs((previous) => {
      if (previous === null) {
        return payload.lapTimeMs;
      }
      return Math.min(previous, payload.lapTimeMs);
    });

    if (payload.completedLaps >= targetLaps) {
      raceStartMsRef.current = null;
      racePhaseRef.current = "finished";
      setRacePhase("finished");
      setFinishTimeMs(payload.totalTimeMs);
    }
  };

  const currentRaceTimeMs = racePhase === "finished"
    ? (finishTimeMs ?? elapsedMs)
    : elapsedMs;

  const showRaceHud = racePhase === "racing";
  const showLoadingScreen = racePhase === "setup" || !sceneReady;

  return (
    <div className="game-root">
      <KeyboardControls map={keyboardMap}>
        <GameCanvas
          cameraZoom={cameraZoom}
          racePhase={racePhase}
          raceSessionId={raceSessionId}
          targetLaps={targetLaps}
          controlsEnabled={racePhase === "racing"}
          onLapProgress={handleLapProgress}
          onTrackLoaded={() => {
            trackLoadedRef.current = true;
            setIsTrackLoaded(true);
            beginRaceIfReady();
          }}
          onCarLoaded={() => {
            carLoadedRef.current = true;
            assetMissingRef.current = false;
            setIsCarLoaded(true);
            setAssetMissing(false);
            beginRaceIfReady();
          }}
          onCarAssetMissing={() => {
            assetMissingRef.current = true;
            setAssetMissing(true);
          }}
        />
      </KeyboardControls>

      {showRaceHud && (
        <>
          <div className="game-hud-wrap">
            <div className="setup-panel setup-panel--hud game-hud">
              <strong>WASD</strong> drive & steer
              <span>R resets the car</span>
            </div>

            <div
              className="setup-panel setup-panel--hud game-zoom-scroll"
              role="group"
              aria-label="Camera zoom control"
            >
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

          <div className="setup-panel setup-panel--hud race-hud" role="status" aria-live="polite">
            <div className="race-hud__row">
              <span>Laps</span>
              <strong>{completedLaps}/{targetLaps}</strong>
            </div>
            <div className="race-hud__row">
              <span>Time</span>
              <strong>{formatRaceTime(currentRaceTimeMs)}</strong>
            </div>
            <div className="race-hud__row">
              <span>Last lap</span>
              <strong>{lastLapMs === null ? "--:--.--" : formatRaceTime(lastLapMs)}</strong>
            </div>
          </div>
        </>
      )}

      {racePhase === "finished" && (
        <div className="win-overlay">
          <div className="setup-panel setup-panel--win win-panel">
                       

            <h2>You Win!</h2>
            <p>{targetLaps} laps completed.</p>

            <div className="win-stats">
              <div className="win-stats__row">
                <span>Final time</span>
                <strong>{formatRaceTime(finishTimeMs ?? elapsedMs)}</strong>
              </div>
              <div className="win-stats__row">
                <span>Best lap</span>
                <strong>{bestLapMs === null ? "--:--.--" : formatRaceTime(bestLapMs)}</strong>
              </div>
            </div>

            <div className="win-actions">
              <button
                type="button"
                className="setup-start-button setup-start-button--win win-action-primary"
                onClick={() => {
                  router.push("/");
                }}
              >
                Race again
              </button>
            </div>
          </div>
        </div>
      )}

      {showLoadingScreen && (
        <div className="runtime-loading-overlay">
          <h2>loading...</h2>
          {assetMissing && (
            <p>
              Custom car asset was not found in public/models/car.
              Add car.glb or car.fbx.
            </p>
          )}
          {!assetMissing && (
            <p>Please wait until track and car are fully loaded.</p>
          )}
        </div>
      )}
    </div>
  );
}
