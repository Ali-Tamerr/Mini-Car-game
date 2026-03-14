"use client";

import { useSearchParams } from "next/navigation";
import GameExperience from "@/components/game/GameExperience";

const MIN_LAPS = 1;
const MAX_LAPS = 12;

function parseLaps(raw: string | null): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return 4;
  }

  return Math.min(MAX_LAPS, Math.max(MIN_LAPS, Math.round(parsed)));
}

export default function RacePage() {
  const searchParams = useSearchParams();
  const initialLaps = parseLaps(searchParams.get("laps"));

  return (
    <main className="game-page">
      <GameExperience initialLaps={initialLaps} />
    </main>
  );
}
