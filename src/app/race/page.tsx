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

type RacePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function RacePage({ searchParams }: RacePageProps) {
  const resolvedSearchParams = await searchParams;
  const rawLaps = resolvedSearchParams?.laps;
  const lapsValue = Array.isArray(rawLaps) ? rawLaps[0] : rawLaps;
  const initialLaps = parseLaps(lapsValue ?? null);

  return (
    <main className="game-page">
      <GameExperience initialLaps={initialLaps} />
    </main>
  );
}
