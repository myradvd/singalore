import type { FlowCachePayload, FlowEffect, FlowEvent, FlowOverlay, FlowState, FlowTransition } from './flowTypes';

export const DUPLICATE_STOP_MESSAGE = 'Landmark is already in your route.';
export const TOUR_ACTIVE_MESSAGE = 'Exit your current tour before opening another route.';
export const EMPTY_ROUTE_MESSAGE = 'Add at least one site to continue.';

export const INITIAL_FLOW_STATE: FlowState = {
  base: 'empty',
  screen: 'home',
  overlays: [],
  searchPurpose: 'browse',
  modal: null,
  itinerary: [],
  restorePoint: null,
  selectedLandmarkId: null,
  tourStartedAt: null,
  visitedLandmarkIds: [],
};

export const guards = {
  hasActiveRoute: (state: FlowState): boolean => state.base === 'inProgress',
  hasAnyRoute: (state: FlowState): boolean => state.base !== 'empty' || state.itinerary.length > 0,
  canExpandMap: (state: FlowState): boolean => state.base !== 'inProgress' && state.screen === 'home',
  hasStops: (state: FlowState): boolean => state.itinerary.length > 0,
  isTopOverlay: (state: FlowState, overlay: FlowOverlay): boolean => state.overlays[state.overlays.length - 1] === overlay,
};

function unchanged(state: FlowState): FlowTransition
{
  return { state, effects: [] };
}

function withoutTopOverlay(state: FlowState): FlowOverlay[]
{
  return state.overlays.slice(0, -1);
}

function baseForIdleItinerary(itinerary: readonly string[]): FlowState['base']
{
  return itinerary.length > 0 ? 'draft' : 'empty';
}

function resetToEmpty(): FlowState
{
  return { ...INITIAL_FLOW_STATE };
}

function historyEffect(state: FlowState, endedAt: number, status: 'completed' | 'abandoned'): FlowEffect[]
{
  if (state.base !== 'inProgress' || state.tourStartedAt === null)
  {
    return [];
  }
  return [{
    type: 'recordHistory',
    landmarkIds: [...state.itinerary],
    visitedLandmarkIds: [...state.visitedLandmarkIds],
    startedAt: state.tourStartedAt,
    endedAt,
    status,
  }];
}

function addStops(state: FlowState, landmarkIds: readonly string[]): FlowTransition
{
  const effects: FlowEffect[] = [];
  const itinerary = [...state.itinerary];
  for (const landmarkId of landmarkIds)
  {
    if (itinerary.includes(landmarkId))
    {
      effects.push({ type: 'toast', message: DUPLICATE_STOP_MESSAGE });
      continue;
    }
    itinerary.push(landmarkId);
  }
  const base = state.base === 'inProgress' ? 'inProgress' : baseForIdleItinerary(itinerary);
  return { state: { ...state, itinerary, base }, effects };
}

export function flowReducer(state: FlowState, event: FlowEvent): FlowTransition
{
  switch (event.type)
  {
    case 'restoreFromCache':
    {
      const cache = event.cache;
      if (cache === null || cache.mode === 'empty' || cache.itinerary.length === 0)
      {
        return { state: resetToEmpty(), effects: [] };
      }
      if (cache.mode === 'route_in_progress')
      {
        return {
          state: {
            ...resetToEmpty(),
            base: 'inProgress',
            itinerary: [...cache.itinerary],
            visitedLandmarkIds: [...cache.visitedLandmarkIds],
            tourStartedAt: cache.tourStartedAt,
          },
          effects: [{ type: 'startTourTracking' }],
        };
      }
      return { state: { ...resetToEmpty(), base: 'draft', itinerary: [...cache.itinerary] }, effects: [] };
    }
    case 'openSidebar':
      if (state.modal !== null || state.overlays.includes('sidebar') || !['home', 'expandedMap'].includes(state.screen))
      {
        return unchanged(state);
      }
      return { state: { ...state, overlays: [...state.overlays, 'sidebar'] }, effects: [] };
    case 'closeSidebar':
      return guards.isTopOverlay(state, 'sidebar') ? { state: { ...state, overlays: withoutTopOverlay(state) }, effects: [] } : unchanged(state);
    case 'openSearch':
    {
      if (state.modal !== null || state.overlays.includes('search'))
      {
        return unchanged(state);
      }
      const fromEditor = state.screen === 'routeEditor';
      if (!fromEditor && state.screen !== 'home')
      {
        return unchanged(state);
      }
      return {
        state: { ...state, overlays: [...state.overlays, 'search'], searchPurpose: fromEditor ? 'addToRoute' : event.purpose },
        effects: [],
      };
    }
    case 'closeSearch':
    {
      if (!guards.isTopOverlay(state, 'search'))
      {
        return unchanged(state);
      }
      const closed: FlowState = { ...state, overlays: withoutTopOverlay(state), searchPurpose: 'browse' };
      const additions = event.addLandmarkIds ?? [];
      return additions.length > 0 ? addStops(closed, additions) : { state: closed, effects: [] };
    }
    case 'selectLandmark':
      return { state: { ...state, selectedLandmarkId: event.landmarkId }, effects: [] };
    case 'addToItinerary':
      return addStops(state, [event.landmarkId]);
    case 'removeFromItinerary':
    {
      if (!state.itinerary.includes(event.landmarkId))
      {
        return unchanged(state);
      }
      const itinerary = state.itinerary.filter((id) => id !== event.landmarkId);
      return { state: { ...state, itinerary, restorePoint: [...state.itinerary] }, effects: [] };
    }
    case 'reorderItinerary':
    {
      const { fromIndex, toIndex } = event;
      if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= state.itinerary.length || toIndex >= state.itinerary.length)
      {
        return unchanged(state);
      }
      const itinerary = [...state.itinerary];
      const [moved] = itinerary.splice(fromIndex, 1);
      if (moved === undefined)
      {
        return unchanged(state);
      }
      itinerary.splice(toIndex, 0, moved);
      return { state: { ...state, itinerary, restorePoint: [...state.itinerary] }, effects: [] };
    }
    case 'applyOrder':
    {
      const sameSet = event.landmarkIds.length === state.itinerary.length && event.landmarkIds.every((id) => state.itinerary.includes(id));
      return sameSet ? { state: { ...state, itinerary: [...event.landmarkIds], restorePoint: [...state.itinerary] }, effects: [] } : unchanged(state);
    }
    case 'loadItinerary':
    {
      if (state.base === 'inProgress')
      {
        return { state, effects: [{ type: 'toast', message: TOUR_ACTIVE_MESSAGE }] };
      }
      const itinerary = [...new Set(event.landmarkIds)];
      if (itinerary.length === 0)
      {
        return { state, effects: [{ type: 'toast', message: EMPTY_ROUTE_MESSAGE }] };
      }
      return { state: { ...state, base: 'draft', screen: 'routeEditor', overlays: [], modal: null, itinerary, restorePoint: state.itinerary.length > 0 ? [...state.itinerary] : null }, effects: [] };
    }
    case 'clearAll':
      if (state.itinerary.length === 0)
      {
        return unchanged(state);
      }
      return { state: { ...state, itinerary: [], restorePoint: [...state.itinerary] }, effects: [] };
    case 'restoreItinerary':
      if (state.restorePoint === null)
      {
        return unchanged(state);
      }
      return { state: { ...state, itinerary: [...state.restorePoint], restorePoint: [...state.itinerary] }, effects: [] };
    case 'openExpandedMap':
      return guards.canExpandMap(state) && state.overlays.length === 0 ? { state: { ...state, screen: 'expandedMap' }, effects: [] } : unchanged(state);
    case 'closeExpandedMap':
      return state.screen === 'expandedMap' ? { state: { ...state, screen: 'home' }, effects: [] } : unchanged(state);
    case 'openRouteEditor':
      if (state.modal !== null || state.overlays.length > 0)
      {
        return unchanged(state);
      }
      if ((state.screen === 'home' && guards.hasAnyRoute(state)) || state.screen === 'navigation')
      {
        return { state: { ...state, screen: 'routeEditor', restorePoint: null }, effects: [] };
      }
      return unchanged(state);
    case 'minimizeRouteEditor':
    {
      if (state.screen !== 'routeEditor' || state.overlays.length > 0)
      {
        return unchanged(state);
      }
      const base = state.base === 'inProgress' ? 'inProgress' : baseForIdleItinerary(state.itinerary);
      return { state: { ...state, screen: 'home', base }, effects: [] };
    }
    case 'requestCloseRouteEditor':
      if (state.screen !== 'routeEditor' || state.modal !== null)
      {
        return unchanged(state);
      }
      if (state.itinerary.length === 0 && state.base !== 'inProgress')
      {
        return { state: resetToEmpty(), effects: [] };
      }
      return { state: { ...state, modal: { kind: 'confirmExit', origin: 'routeEditor' } }, effects: [] };
    case 'saveAndContinue':
      if (state.screen !== 'routeEditor')
      {
        return unchanged(state);
      }
      if (!guards.hasStops(state))
      {
        return { state, effects: [{ type: 'toast', message: EMPTY_ROUTE_MESSAGE }] };
      }
      return { state: { ...state, screen: 'routeConfirm' }, effects: [] };
    case 'backFromConfirmation':
      return state.screen === 'routeConfirm' && state.modal === null ? { state: { ...state, screen: 'routeEditor' }, effects: [] } : unchanged(state);
    case 'startTourFromSite':
      if (state.modal !== null || !['home', 'expandedMap'].includes(state.screen))
      {
        return unchanged(state);
      }
      if (guards.hasAnyRoute(state))
      {
        return { state: { ...state, modal: { kind: 'confirmStartTour', landmarkId: event.landmarkId } }, effects: [] };
      }
      return { state: { ...state, base: 'draft', itinerary: [event.landmarkId], screen: 'routeConfirm', overlays: [] }, effects: [] };
    case 'confirmStartTour':
    {
      if (state.modal?.kind !== 'confirmStartTour')
      {
        return unchanged(state);
      }
      const effects: FlowEffect[] = [];
      if (state.base === 'inProgress')
      {
        effects.push(...historyEffect(state, event.at, 'abandoned'), { type: 'stopTourTracking' });
      }
      return {
        state: { ...resetToEmpty(), base: 'draft', itinerary: [state.modal.landmarkId], screen: 'routeConfirm' },
        effects,
      };
    }
    case 'cancelStartTour':
      return state.modal?.kind === 'confirmStartTour' ? { state: { ...state, modal: null }, effects: [] } : unchanged(state);
    case 'startNavigation':
      if (state.screen !== 'routeConfirm' || !guards.hasStops(state))
      {
        return unchanged(state);
      }
      if (state.base === 'inProgress')
      {
        return { state: { ...state, screen: 'navigation' }, effects: [] };
      }
      return {
        state: { ...state, base: 'inProgress', screen: 'navigation', tourStartedAt: event.at, visitedLandmarkIds: [], restorePoint: null },
        effects: [{ type: 'startTourTracking' }],
      };
    case 'pauseNavigation':
      return state.screen === 'navigation' && state.modal === null ? { state: { ...state, screen: 'home' }, effects: [] } : unchanged(state);
    case 'resumeNavigation':
      return state.base === 'inProgress' && state.screen === 'home' && state.overlays.length === 0
        ? { state: { ...state, screen: 'navigation' }, effects: [] }
        : unchanged(state);
    case 'requestExitNavigation':
      if (state.base !== 'inProgress' || !['navigation', 'home'].includes(state.screen) || state.modal !== null)
      {
        return unchanged(state);
      }
      return { state: { ...state, modal: { kind: 'confirmExit', origin: 'navigation' } }, effects: [] };
    case 'chooseExit':
    {
      if (state.modal?.kind !== 'confirmExit')
      {
        return unchanged(state);
      }
      if (event.choice === 'cancel')
      {
        return { state: { ...state, modal: null }, effects: [] };
      }
      const effects: FlowEffect[] = [];
      if (event.choice === 'save' && state.itinerary.length > 0)
      {
        effects.push({ type: 'saveItinerary', landmarkIds: [...state.itinerary] });
      }
      if (state.base === 'inProgress')
      {
        const completed = state.itinerary.length > 0 && state.itinerary.every((id) => state.visitedLandmarkIds.includes(id));
        effects.push(...historyEffect(state, event.at, completed ? 'completed' : 'abandoned'), { type: 'stopTourTracking' });
      }
      return { state: resetToEmpty(), effects };
    }
    case 'markVisited':
    {
      if (state.base !== 'inProgress' || !state.itinerary.includes(event.landmarkId) || state.visitedLandmarkIds.includes(event.landmarkId))
      {
        return unchanged(state);
      }
      const visitedLandmarkIds = [...state.visitedLandmarkIds, event.landmarkId];
      const allVisited = state.itinerary.every((id) => visitedLandmarkIds.includes(id));
      return { state: { ...state, visitedLandmarkIds }, effects: allVisited ? [{ type: 'tourCompleted' }] : [] };
    }
    default:
      return unchanged(state);
  }
}

export function toFlowCache(state: FlowState): FlowCachePayload
{
  if (state.base === 'inProgress')
  {
    return { mode: 'route_in_progress', itinerary: [...state.itinerary], visitedLandmarkIds: [...state.visitedLandmarkIds], tourStartedAt: state.tourStartedAt };
  }
  if (state.itinerary.length > 0)
  {
    return { mode: 'route_editor', itinerary: [...state.itinerary], visitedLandmarkIds: [], tourStartedAt: null };
  }
  return { mode: 'empty', itinerary: [], visitedLandmarkIds: [], tourStartedAt: null };
}

export function nextUnvisitedStop(state: FlowState): string | null
{
  return state.itinerary.find((id) => !state.visitedLandmarkIds.includes(id)) ?? null;
}
