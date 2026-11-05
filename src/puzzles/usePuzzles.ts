// The puzzle screen's state: the puzzle set, the player's rating and the puzzle being played,
// with the opponent's moves played after a short pause.
import { useEffect, useMemo, useRef, useState } from 'react';
import { resultFeedback, tapFeedback } from '../app/platform';
import { moveSound, playSound, type SoundKind } from '../app/sound';
import { loadPuzzles, type Puzzle } from './data';
import { dailyPuzzle, dateKey, pickPuzzle } from './pick';
import { opponentMove, retry, reveal, showHint, solvedClean, solverMove, startRun, type Run } from './run';
import { DIFFICULTY_OFFSET, loadProfile, recordResult, saveProfile, type Difficulty, type PuzzleProfile } from './store';

/** pause before the opponent's move that sets up the puzzle, and before its replies */
const SETUP_MS = 700;
const REPLY_MS = 450;
/** a theme is offered as a filter when the set has at least this many of its puzzles */
const MIN_THEME_PUZZLES = 30;

export function usePuzzles(sounds: boolean) {
  const [puzzles, setPuzzles] = useState<Puzzle[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [profile, setProfileState] = useState<PuzzleProfile>(loadProfile);
  const [run, setRun] = useState<Run | null>(null);
  const [isDaily, setIsDaily] = useState(false);
  /** rating change of the current puzzle: undefined until it counts, null if it had counted before */
  const [delta, setDelta] = useState<number | null | undefined>(undefined);
  const profileRef = useRef(profile);
  const counted = useRef(false);

  const setProfile = (p: PuzzleProfile) => {
    profileRef.current = p;
    setProfileState(p);
    saveProfile(p);
  };

  const sound = (kind: SoundKind, delay = 0) => {
    if (!sounds) return;
    if (delay) setTimeout(() => playSound(kind), delay);
    else playSound(kind);
  };

  const begin = (p: Puzzle, daily: boolean) => {
    counted.current = false;
    setRun(startRun(p));
    setIsDaily(daily);
    setDelta(undefined);
    setProfile({ ...profileRef.current, current: p.id });
  };

  const today = dateKey();
  const daily = useMemo(() => (puzzles ? dailyPuzzle(puzzles, today) : null), [puzzles, today]);

  const pickNext = (all: Puzzle[], exclude?: string, p = profileRef.current) =>
    pickPuzzle(all, {
      target: p.glicko.rating + DIFFICULTY_OFFSET[p.difficulty],
      theme: p.theme,
      played: new Set(p.played),
      exclude,
    });

  const load = () => {
    setLoadError(false);
    loadPuzzles().then(setPuzzles, () => setLoadError(true));
  };
  useEffect(load, []);

  // the first puzzle: the one left unfinished, or a new one
  useEffect(() => {
    if (!puzzles || run) return;
    const left = puzzles.find((p) => p.id === profileRef.current.current);
    const p = left ?? pickNext(puzzles);
    if (p) begin(p, !!left && left.id === daily?.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puzzles]);

  // the opponent's moves
  useEffect(() => {
    if (run?.phase !== 'waiting') return;
    const t = setTimeout(
      () => {
        const next = opponentMove(run);
        setRun(next);
        const san = next.line.moves[next.line.ply - 1]?.san;
        if (san) sound(moveSound(san));
        if (next.phase === 'done') update(next);
      },
      run.next === 0 ? SETUP_MS : REPLY_MS,
    );
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run]);

  /** Counts the puzzle the first time it fails or when it's solved; forgets it when it's over. */
  const update = (next: Run) => {
    setRun(next);
    let p = profileRef.current;
    if (!counted.current && (next.failed || solvedClean(next))) {
      counted.current = true;
      const win = !next.failed;
      const out = recordResult(p, next.puzzle, win);
      p = out.profile;
      if (isDaily) p = { ...p, daily: { date: today, id: next.puzzle.id, solved: win } };
      setDelta(out.delta);
    }
    if (next.phase === 'done') p = { ...p, current: undefined };
    if (p !== profileRef.current) setProfile(p);
  };

  const onMove = (uci: string) => {
    if (run?.phase !== 'play') return;
    const next = solverMove(run, uci);
    if (next === run) return;
    tapFeedback();
    const san = next.line.moves[next.line.ply - 1].san;
    sound(moveSound(san));
    if (next.phase === 'wrong') {
      sound('wrong', 150);
      resultFeedback(false);
    } else if (next.phase === 'done') {
      sound('right', 150);
      resultFeedback(true);
    }
    update(next);
  };

  const nextPuzzle = () => {
    if (!puzzles) return;
    const p = pickNext(puzzles, run?.puzzle.id);
    if (p) begin(p, false);
  };

  /** Filters apply at once: a new puzzle (the unfinished one doesn't count). */
  const setFilters = (f: { theme?: string; difficulty?: Difficulty }) => {
    const p = { ...profileRef.current, ...f };
    setProfile(p);
    if (!puzzles) return;
    const next = pickNext(puzzles, run?.puzzle.id, p);
    if (next) begin(next, false);
  };

  const themeCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of puzzles ?? []) for (const t of p.themes) m.set(t, (m.get(t) ?? 0) + 1);
    return m;
  }, [puzzles]);

  return {
    loading: !puzzles && !loadError,
    loadError,
    reload: load,
    run,
    profile,
    delta,
    isDaily,
    daily,
    dailyDone: profile.daily?.date === today ? profile.daily : null,
    hasTheme: (t: string) => (themeCounts.get(t) ?? 0) >= MIN_THEME_PUZZLES,
    onMove,
    retry: () => run && update(retry(run)),
    hint: () => run && update(showHint(run)),
    reveal: () => run && update(reveal(run)),
    /** browse the moves once the puzzle is over */
    setPly: (ply: number) => run?.phase === 'done' && setRun({ ...run, line: { ...run.line, ply } }),
    nextPuzzle,
    playDaily: () => daily && begin(daily, true),
    setTheme: (theme: string) => setFilters({ theme }),
    setDifficulty: (difficulty: Difficulty) => setFilters({ difficulty }),
  };
}
