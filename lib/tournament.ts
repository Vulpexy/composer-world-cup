import { composers, DEFAULT_COMPOSER_IDS } from './composers';

export const GROUP_NAMES = 'ABCDEFGHIJKL'.split('');
export const GROUP_PITCHES = ['C','C♯／D♭','D','D♯／E♭','E','F','F♯／G♭','G','G♯／A♭','A','A♯／B♭','B'];

export type TournamentPhase = 'roster' | 'draw' | 'group-selection' | 'repechage' | 'finished' | 'knockout' | 'round-transition' | 'result';
export type KnockoutMatch = { a:string; b:string; winner?:string };
export type KnockoutRound = { entrants:string[]; matches:KnockoutMatch[] };
export type KnockoutState = { rounds:KnockoutRound[]; currentRound:number; currentMatch:number };

export type TournamentState = {
  version: 5;
  phase: TournamentPhase;
  groups: string[][];
  activeGroup: number;
  groupPicks: string[][];
  repechagePicks: string[];
  knockout?: KnockoutState;
  champion?: string;
  statisticsSubmissionId?: string;
  namedResultSaved?: boolean;
  savedDisplayName?: string;
};

export function drawGroups(selectedIds:string[]=DEFAULT_COMPOSER_IDS): string[][] {
  const ids = [...selectedIds];
  for (let index = ids.length - 1; index > 0; index -= 1) {
    const swapWith = Math.floor(Math.random() * (index + 1));
    [ids[index], ids[swapWith]] = [ids[swapWith], ids[index]];
  }
  return GROUP_NAMES.map((_, index) => ids.slice(index * 4, index * 4 + 4));
}

export function createTournament(selectedIds:string[]=DEFAULT_COMPOSER_IDS,phase:TournamentPhase='roster'): TournamentState {
  const validIds=new Set(composers.map((composer)=>composer.id));const roster=[...new Set(selectedIds)].filter((id)=>validIds.has(id));const ids=roster.length===48?roster:DEFAULT_COMPOSER_IDS;
  return { version: 5, phase, groups: drawGroups(ids), activeGroup: 0, groupPicks: [], repechagePicks: [] };
}

function validBase(state:{groups?:unknown;groupPicks?:unknown;repechagePicks?:unknown}) {
  const validIds = new Set(composers.map((composer) => composer.id));
  const groups = Array.isArray(state.groups) ? state.groups as string[][] : [];
  const groupedIds = groups.flat();
  return groups.length === 12 && groups.every((group) => Array.isArray(group) && group.length === 4) &&
    groupedIds.length === 48 && new Set(groupedIds).size === 48 && groupedIds.every((id) => validIds.has(id)) &&
    Array.isArray(state.groupPicks) && Array.isArray(state.repechagePicks);
}

export function restoreTournament(value: unknown): TournamentState | null {
  if (!value || typeof value !== 'object') return null;
  const state = value as Record<string,unknown>;
  if (!validBase(state)) return null;
  if (state.version === 2 || state.version === 3 || state.version === 4) return { ...(state as unknown as Omit<TournamentState,'version'>), version:5 };
  if (state.version !== 5 || !['roster','draw','group-selection','repechage','finished','knockout','round-transition','result'].includes(String(state.phase))) return null;
  return state as unknown as TournamentState;
}

export function directQualifiers(state: TournamentState) { return state.groupPicks.flat(); }

export function eliminatedComposers(state: TournamentState) {
  const qualified = new Set(directQualifiers(state));
  return state.groups.flat().filter((id) => !qualified.has(id));
}

export function roundLabel(count:number) {
  if (count === 32) return '32强赛';
  if (count === 16) return '16强赛';
  if (count === 8) return '四分之一决赛';
  if (count === 4) return '半决赛';
  return '决赛';
}

export function makeRound(entrants:string[]):KnockoutRound {
  return { entrants:[...entrants], matches:Array.from({length:entrants.length/2},(_,index)=>({a:entrants[index*2],b:entrants[index*2+1]})) };
}

export function shuffledKnockoutEntrants(state:TournamentState) {
  const entrants=[...directQualifiers(state),...state.repechagePicks];
  for(let index=entrants.length-1;index>0;index-=1){const swapWith=Math.floor(Math.random()*(index+1));[entrants[index],entrants[swapWith]]=[entrants[swapWith],entrants[index]]}
  return entrants;
}

