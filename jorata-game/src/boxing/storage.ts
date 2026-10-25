import { DEFAULT_BINDINGS, findBindingConflicts, type DualKeyBindings, type FighterId, type GameMode } from './engine';

const BINDINGS_KEY = 'jorata.boxing.bindings.v1';
const RECORD_KEY = 'jorata.boxing.record.v1';

export interface BoxingRecord {
  matchesPlayed: number;
  local1v1Matches: number;
  aiWins: number;
  aiLosses: number;
  p1Wins: number;
  p2Wins: number;
  totalKOs: number;
}

const DEFAULT_RECORD: BoxingRecord = {
  matchesPlayed: 0,
  local1v1Matches: 0,
  aiWins: 0,
  aiLosses: 0,
  p1Wins: 0,
  p2Wins: 0,
  totalKOs: 0,
};

function isValidBindingSet(obj: unknown): obj is DualKeyBindings['p1'] {
  if (!obj || typeof obj !== 'object') return false;
  const r = obj as Record<string, unknown>;
  return (
    typeof r.left === 'string' &&
    r.left.length > 0 &&
    typeof r.right === 'string' &&
    r.right.length > 0 &&
    typeof r.block === 'string' &&
    r.block.length > 0 &&
    typeof r.punch === 'string' &&
    r.punch.length > 0
  );
}

export function loadBindings(): DualKeyBindings {
  try {
    const raw = localStorage.getItem(BINDINGS_KEY);
    if (!raw) return structuredClone(DEFAULT_BINDINGS);
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return structuredClone(DEFAULT_BINDINGS);
    const candidate = parsed as Record<string, unknown>;
    if (!isValidBindingSet(candidate.p1) || !isValidBindingSet(candidate.p2)) {
      return structuredClone(DEFAULT_BINDINGS);
    }
    const bindings: DualKeyBindings = {
      p1: { ...candidate.p1 },
      p2: { ...candidate.p2 },
    };
    if (findBindingConflicts(bindings).length > 0) {
      return structuredClone(DEFAULT_BINDINGS);
    }
    return bindings;
  } catch {
    return structuredClone(DEFAULT_BINDINGS);
  }
}

export function saveBindings(bindings: DualKeyBindings): boolean {
  try {
    localStorage.setItem(BINDINGS_KEY, JSON.stringify(bindings));
    return true;
  } catch {
    return false;
  }
}

export function loadRecord(): BoxingRecord {
  try {
    const raw = localStorage.getItem(RECORD_KEY);
    if (!raw) return { ...DEFAULT_RECORD };
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_RECORD };
    const r = parsed as Record<string, unknown>;
    return {
      matchesPlayed: Number.isFinite(r.matchesPlayed) ? Number(r.matchesPlayed) : 0,
      local1v1Matches: Number.isFinite(r.local1v1Matches) ? Number(r.local1v1Matches) : 0,
      aiWins: Number.isFinite(r.aiWins) ? Number(r.aiWins) : 0,
      aiLosses: Number.isFinite(r.aiLosses) ? Number(r.aiLosses) : 0,
      p1Wins: Number.isFinite(r.p1Wins) ? Number(r.p1Wins) : 0,
      p2Wins: Number.isFinite(r.p2Wins) ? Number(r.p2Wins) : 0,
      totalKOs: Number.isFinite(r.totalKOs) ? Number(r.totalKOs) : 0,
    };
  } catch {
    return { ...DEFAULT_RECORD };
  }
}

export function recordMatchResult(
  current: BoxingRecord,
  mode: GameMode,
  winner: FighterId | 'draw' | null,
  byKO: boolean
): BoxingRecord {
  const next: BoxingRecord = {
    ...current,
    matchesPlayed: current.matchesPlayed + 1,
    local1v1Matches: current.local1v1Matches + (mode === 'local1v1' ? 1 : 0),
    aiWins: current.aiWins + (mode === 'ai' && winner === 'p1' ? 1 : 0),
    aiLosses: current.aiLosses + (mode === 'ai' && winner === 'p2' ? 1 : 0),
    p1Wins: current.p1Wins + (winner === 'p1' ? 1 : 0),
    p2Wins: current.p2Wins + (winner === 'p2' ? 1 : 0),
    totalKOs: current.totalKOs + (byKO ? 1 : 0),
  };
  try {
    localStorage.setItem(RECORD_KEY, JSON.stringify(next));
  } catch {
    // Non-blocking storage
  }
  return next;
}
