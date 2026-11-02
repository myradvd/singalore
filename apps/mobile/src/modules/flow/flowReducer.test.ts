import { DUPLICATE_STOP_MESSAGE, EMPTY_ROUTE_MESSAGE, INITIAL_FLOW_STATE, ROUTE_STOP_LIMIT_MESSAGE, TOUR_ACTIVE_MESSAGE, flowReducer, nextUnvisitedStop, toFlowCache } from './flowReducer';
import type { FlowEvent, FlowState } from './flowTypes';

const A = 'landmark-a';
const B = 'landmark-b';
const C = 'landmark-c';

function run(state: FlowState, ...events: FlowEvent[]): FlowState
{
  return events.reduce((current, event) => flowReducer(current, event).state, state);
}

const homeEmpty = INITIAL_FLOW_STATE;
const homeDraft = run(homeEmpty, { type: 'addToItinerary', landmarkId: A }, { type: 'addToItinerary', landmarkId: B });
const routeEditor = run(homeDraft, { type: 'openRouteEditor' });
const routeConfirm = run(routeEditor, { type: 'saveAndContinue' });
const navigation = run(routeConfirm, { type: 'startNavigation', at: 1000 });
const homeInProgress = run(navigation, { type: 'pauseNavigation' });

function describeState(state: FlowState): string
{
  const top = state.overlays[state.overlays.length - 1];
  if (state.modal !== null)
  {
    return state.modal.kind === 'confirmExit' ? `ConfirmDiscard(${state.modal.origin})` : 'ConfirmTour';
  }
  if (top === 'sidebar')
  {
    return 'Sidebar';
  }
  if (top === 'search')
  {
    return 'Search';
  }
  switch (state.screen)
  {
    case 'home':
      return state.base === 'inProgress' ? 'Home_RIP' : state.base === 'draft' ? 'Home_REO' : 'Home_Empty';
    case 'expandedMap':
      return 'ExpMap';
    case 'routeEditor':
      return 'RouteEd';
    case 'routeConfirm':
      return 'RouteConfirm';
    case 'navigation':
      return 'MainNav';
  }
}

describe('dialog-map-latest.puml transition table', () =>
{
  const named: Record<string, FlowState> = {
    Home_Empty: homeEmpty,
    Home_REO: homeDraft,
    Home_RIP: homeInProgress,
    RouteEd: routeEditor,
    RouteConfirm: routeConfirm,
    MainNav: navigation,
  };

  it('fixtures are in the expected states', () =>
  {
    for (const [name, state] of Object.entries(named))
    {
      expect(describeState(state)).toBe(name);
    }
  });

  it.each([
    ['empty cache', null, 'Home_Empty'],
    ['draft cache', { mode: 'route_editor', itinerary: [A], visitedLandmarkIds: [], tourStartedAt: null }, 'Home_REO'],
    ['tour cache', { mode: 'route_in_progress', itinerary: [A, B], visitedLandmarkIds: [A], tourStartedAt: 5 }, 'Home_RIP'],
  ] as const)('[*] to home from %s', (_label, cache, expected) =>
  {
    const result = flowReducer(INITIAL_FLOW_STATE, { type: 'restoreFromCache', cache: cache === null ? null : { ...cache, itinerary: [...cache.itinerary], visitedLandmarkIds: [...cache.visitedLandmarkIds] } });
    expect(describeState(result.state)).toBe(expected);
  });

  it('restoring a tour restarts tour tracking and keeps progress', () =>
  {
    const result = flowReducer(INITIAL_FLOW_STATE, { type: 'restoreFromCache', cache: { mode: 'route_in_progress', itinerary: [A, B], visitedLandmarkIds: [A], tourStartedAt: 5 } });
    expect(result.effects).toEqual([{ type: 'startTourTracking' }]);
    expect(result.state.visitedLandmarkIds).toEqual([A]);
    expect(result.state.tourStartedAt).toBe(5);
  });

  it.each(['Home_Empty', 'Home_REO', 'Home_RIP'])('%s -> Sidebar (tapHamburger) -> origin (closeSidebar)', (origin) =>
  {
    const start = named[origin] as FlowState;
    const opened = run(start, { type: 'openSidebar' });
    expect(describeState(opened)).toBe('Sidebar');
    expect(describeState(run(opened, { type: 'closeSidebar' }))).toBe(origin);
  });

  it.each(['Home_Empty', 'Home_REO', 'Home_RIP'])('%s -> Search (tapSearchBar) -> origin (collapseSearch)', (origin) =>
  {
    const start = named[origin] as FlowState;
    const opened = run(start, { type: 'openSearch', purpose: 'browse' });
    expect(describeState(opened)).toBe('Search');
    expect(opened.searchPurpose).toBe('browse');
    expect(describeState(run(opened, { type: 'closeSearch' }))).toBe(origin);
  });

  it.each(['Home_Empty', 'Home_REO'])('%s -> ExpMap (tapMapButton [noActiveRoute]) -> origin (tapCompressButton)', (origin) =>
  {
    const start = named[origin] as FlowState;
    const expanded = run(start, { type: 'openExpandedMap' });
    expect(describeState(expanded)).toBe('ExpMap');
    expect(describeState(run(expanded, { type: 'closeExpandedMap' }))).toBe(origin);
  });

  it('Home_RIP cannot open ExpMap; tapMapButton [routeActive] goes to MainNav instead', () =>
  {
    expect(describeState(run(homeInProgress, { type: 'openExpandedMap' }))).toBe('Home_RIP');
    expect(describeState(run(homeInProgress, { type: 'resumeNavigation' }))).toBe('MainNav');
  });

  it('Home_REO -> RouteEd (tapRouteEditorStrip) -> Home_REO (tapMinimizeBar)', () =>
  {
    expect(describeState(routeEditor)).toBe('RouteEd');
    expect(describeState(run(routeEditor, { type: 'minimizeRouteEditor' }))).toBe('Home_REO');
  });

  it('RouteEd -> Search (tapAddSite) -> RouteEd (collapseSearch [origin=RouteEditor] / addToRoute(sites))', () =>
  {
    const searching = run(routeEditor, { type: 'openSearch', purpose: 'browse' });
    expect(describeState(searching)).toBe('Search');
    expect(searching.searchPurpose).toBe('addToRoute');
    const back = flowReducer(searching, { type: 'closeSearch', addLandmarkIds: [C, A] });
    expect(describeState(back.state)).toBe('RouteEd');
    expect(back.state.itinerary).toEqual([A, B, C]);
    expect(back.effects).toEqual([{ type: 'toast', message: DUPLICATE_STOP_MESSAGE }]);
  });

  it('RouteEd tapClearAll / clearAll() then tapRestore / restore()', () =>
  {
    const cleared = run(routeEditor, { type: 'clearAll' });
    expect(describeState(cleared)).toBe('RouteEd');
    expect(cleared.itinerary).toEqual([]);
    const restored = run(cleared, { type: 'restoreItinerary' });
    expect(restored.itinerary).toEqual([A, B]);
    expect(run(restored, { type: 'restoreItinerary' }).itinerary).toEqual([]);
  });

  it('Home_Empty -> Home_REO (tapPlusRoute(site) / addToItinerary(site))', () =>
  {
    const result = run(homeEmpty, { type: 'addToItinerary', landmarkId: C });
    expect(describeState(result)).toBe('Home_REO');
    expect(result.itinerary).toEqual([C]);
  });

  it('MainNav -> Home_RIP (tapPauseNav) and MainNav -> RouteEd (tapEditRoute)', () =>
  {
    expect(describeState(homeInProgress)).toBe('Home_RIP');
    const editing = run(navigation, { type: 'openRouteEditor' });
    expect(describeState(editing)).toBe('RouteEd');
    expect(editing.base).toBe('inProgress');
  });

  it.each([
    ['MainNav', navigation, 'requestExitNavigation'],
    ['RouteEd', routeEditor, 'requestCloseRouteEditor'],
  ] as const)('%s -> ConfirmDiscard -> origin (cancelDiscard)', (origin, start, eventType) =>
  {
    const confirming = run(start, { type: eventType });
    expect(describeState(confirming)).toMatch(/^ConfirmDiscard/);
    expect(describeState(run(confirming, { type: 'chooseExit', choice: 'cancel', at: 2000 }))).toBe(origin);
  });

  it('ConfirmDiscard -> Home_Empty (confirmDiscard / discardRoute()) from navigation records abandoned history', () =>
  {
    const confirming = run(navigation, { type: 'requestExitNavigation' });
    const result = flowReducer(confirming, { type: 'chooseExit', choice: 'discard', at: 5000 });
    expect(describeState(result.state)).toBe('Home_Empty');
    expect(result.effects).toEqual([
      { type: 'recordHistory', landmarkIds: [A, B], visitedLandmarkIds: [], startedAt: 1000, endedAt: 5000, status: 'abandoned' },
      { type: 'stopTourTracking' },
    ]);
  });

  it('Save and Exit saves the itinerary and records history (A6, mockup 04)', () =>
  {
    const visitedAll = run(navigation, { type: 'markVisited', landmarkId: A, at: 2 }, { type: 'markVisited', landmarkId: B, at: 3 });
    const result = flowReducer(run(visitedAll, { type: 'requestExitNavigation' }), { type: 'chooseExit', choice: 'save', at: 9000 });
    expect(result.effects).toEqual([
      { type: 'saveItinerary', landmarkIds: [A, B] },
      { type: 'recordHistory', landmarkIds: [A, B], visitedLandmarkIds: [A, B], startedAt: 1000, endedAt: 9000, status: 'completed' },
      { type: 'stopTourTracking' },
    ]);
  });

  it('closing a draft editor with Save and Exit saves without history', () =>
  {
    const result = flowReducer(run(routeEditor, { type: 'requestCloseRouteEditor' }), { type: 'chooseExit', choice: 'save', at: 1 });
    expect(result.effects).toEqual([{ type: 'saveItinerary', landmarkIds: [A, B] }]);
    expect(describeState(result.state)).toBe('Home_Empty');
  });

  it('Home_Empty -> RouteConfirm (tapStartTour(site) [noActiveRoute])', () =>
  {
    const result = run(homeEmpty, { type: 'startTourFromSite', landmarkId: C });
    expect(describeState(result)).toBe('RouteConfirm');
    expect(result.itinerary).toEqual([C]);
  });

  it('tapStartTour(site) [activeRouteExists] -> ConfirmTour -> cancel / confirm', () =>
  {
    for (const start of [homeDraft, homeInProgress])
    {
      const confirming = run(start, { type: 'startTourFromSite', landmarkId: C });
      expect(describeState(confirming)).toBe('ConfirmTour');
      expect(describeState(run(confirming, { type: 'cancelStartTour' }))).toBe(describeState(start));
      const confirmed = flowReducer(confirming, { type: 'confirmStartTour', at: 7000 });
      expect(describeState(confirmed.state)).toBe('RouteConfirm');
      expect(confirmed.state.itinerary).toEqual([C]);
      if (start.base === 'inProgress')
      {
        expect(confirmed.effects).toEqual([
          { type: 'recordHistory', landmarkIds: [A, B], visitedLandmarkIds: [], startedAt: 1000, endedAt: 7000, status: 'abandoned' },
          { type: 'stopTourTracking' },
        ]);
      }
    }
  });

  it('RouteEd -> RouteConfirm (tapSaveAndContinue) -> RouteEd (tapBack) and -> MainNav (tapStartNavigation)', () =>
  {
    expect(describeState(routeConfirm)).toBe('RouteConfirm');
    expect(describeState(run(routeConfirm, { type: 'backFromConfirmation' }))).toBe('RouteEd');
    const started = flowReducer(routeConfirm, { type: 'startNavigation', at: 1000 });
    expect(describeState(started.state)).toBe('MainNav');
    expect(started.effects).toEqual([{ type: 'startTourTracking' }]);
  });
});

describe('guards and edge cases', () =>
{
  it('refuses to continue with an empty route', () =>
  {
    const emptyEditor = run(routeEditor, { type: 'clearAll' });
    const result = flowReducer(emptyEditor, { type: 'saveAndContinue' });
    expect(result.state.screen).toBe('routeEditor');
    expect(result.effects).toEqual([{ type: 'toast', message: EMPTY_ROUTE_MESSAGE }]);
  });

  it('closing an empty draft editor needs no confirmation', () =>
  {
    const emptyEditor = run(routeEditor, { type: 'clearAll' });
    expect(run(emptyEditor, { type: 'requestCloseRouteEditor' })).toEqual(INITIAL_FLOW_STATE);
  });

  it('minimizing an emptied editor returns to Home_Empty', () =>
  {
    expect(run(routeEditor, { type: 'clearAll' }, { type: 'minimizeRouteEditor' }).base).toBe('empty');
  });

  it('warns on duplicate stops (UC 1.5.1.1)', () =>
  {
    const result = flowReducer(homeDraft, { type: 'addToItinerary', landmarkId: A });
    expect(result.state.itinerary).toEqual([A, B]);
    expect(result.effects).toEqual([{ type: 'toast', message: DUPLICATE_STOP_MESSAGE }]);
  });

  it('reorders, removes and applies Auto-Order with an undo point', () =>
  {
    const three = run(routeEditor, { type: 'addToItinerary', landmarkId: C });
    const reordered = run(three, { type: 'reorderItinerary', fromIndex: 2, toIndex: 0 });
    expect(reordered.itinerary).toEqual([C, A, B]);
    expect(run(reordered, { type: 'restoreItinerary' }).itinerary).toEqual([A, B, C]);
    expect(run(three, { type: 'removeFromItinerary', landmarkId: B }).itinerary).toEqual([A, C]);
    expect(run(three, { type: 'applyOrder', landmarkIds: [B, C, A] }).itinerary).toEqual([B, C, A]);
    expect(run(three, { type: 'applyOrder', landmarkIds: [B, C] }).itinerary).toEqual([A, B, C]);
    expect(run(three, { type: 'reorderItinerary', fromIndex: 0, toIndex: 9 }).itinerary).toEqual([A, B, C]);
  });

  it('marks stops visited and reports completion once', () =>
  {
    const first = flowReducer(navigation, { type: 'markVisited', landmarkId: A, at: 1 });
    expect(first.effects).toEqual([]);
    expect(nextUnvisitedStop(first.state)).toBe(B);
    const second = flowReducer(first.state, { type: 'markVisited', landmarkId: B, at: 2 });
    expect(second.effects).toEqual([{ type: 'tourCompleted' }]);
    expect(flowReducer(second.state, { type: 'markVisited', landmarkId: B, at: 3 }).effects).toEqual([]);
    expect(flowReducer(homeDraft, { type: 'markVisited', landmarkId: A, at: 1 }).state).toBe(homeDraft);
  });

  it('ignores overlays while a modal is open and blocks nested search', () =>
  {
    const confirming = run(navigation, { type: 'requestExitNavigation' });
    expect(run(confirming, { type: 'openSidebar' })).toBe(confirming);
    const searching = run(homeEmpty, { type: 'openSearch', purpose: 'browse' });
    expect(run(searching, { type: 'openSearch', purpose: 'browse' })).toBe(searching);
  });

  it('serialises to the three cache modes and back without user coordinates', () =>
  {
    expect(toFlowCache(homeEmpty)).toEqual({ mode: 'empty', itinerary: [], visitedLandmarkIds: [], tourStartedAt: null });
    expect(toFlowCache(homeDraft).mode).toBe('route_editor');
    const cached = toFlowCache(run(navigation, { type: 'markVisited', landmarkId: A, at: 1 }));
    expect(cached).toEqual({ mode: 'route_in_progress', itinerary: [A, B], visitedLandmarkIds: [A], tourStartedAt: 1000 });
    expect(JSON.stringify(cached)).not.toMatch(/lat|lng/);
    const restored = flowReducer(INITIAL_FLOW_STATE, { type: 'restoreFromCache', cache: cached }).state;
    expect(restored.itinerary).toEqual([A, B]);
    expect(restored.base).toBe('inProgress');
  });
});

describe('route stop cap (FR 5.1, D35)', () =>
{
  const capToast = { type: 'toast', message: 'A route can have at most 11 stops.' };

  // Builds a list of distinct landmark ids.
  function stopIds(count: number, prefix = 'stop'): string[]
  {
    return Array.from({ length: count }, (_, index) => `${prefix}-${index}`);
  }

  // Builds a draft route holding the given number of stops.
  function draftWithStops(count: number): FlowState
  {
    return flowReducer(homeEmpty, { type: 'loadItinerary', landmarkIds: stopIds(count) }).state;
  }

  it('uses the exact agreed message', () =>
  {
    expect(ROUTE_STOP_LIMIT_MESSAGE).toBe('A route can have at most 11 stops.');
  });

  it.each([
    ['below the cap: 9 + 1 gives 10', 9, 10],
    ['on the cap: 10 + 1 gives 11', 10, 11],
  ])('valid EC, no toast, %s', (_label, startCount, expectedCount) =>
  {
    const result = flowReducer(draftWithStops(startCount), { type: 'addToItinerary', landmarkId: 'new-stop' });
    expect(result.state.itinerary).toHaveLength(expectedCount);
    expect(result.effects).toEqual([]);
  });

  it('invalid EC, above the cap: 11 + 1 stays 11 with one cap toast', () =>
  {
    const start = draftWithStops(11);
    const result = flowReducer(start, { type: 'addToItinerary', landmarkId: 'new-stop' });
    expect(result.state.itinerary).toEqual(start.itinerary);
    expect(result.effects).toEqual([capToast]);
  });

  it('search batch: 10 + 3 adds only the first and shows one cap toast', () =>
  {
    const searching = run(draftWithStops(10), { type: 'openSearch', purpose: 'addToRoute' });
    const result = flowReducer(searching, { type: 'closeSearch', addLandmarkIds: stopIds(3, 'new') });
    expect(result.state.itinerary).toEqual([...stopIds(10), 'new-0']);
    expect(result.effects).toEqual([capToast]);
  });

  it('duplicate at the cap shows only the exact duplicate toast', () =>
  {
    const result = flowReducer(draftWithStops(11), { type: 'addToItinerary', landmarkId: 'stop-0' });
    expect(result.state.itinerary).toHaveLength(11);
    expect(result.effects).toEqual([{ type: 'toast', message: 'Landmark is already in your route.' }]);
  });

  it('batch at the cap with a duplicate and a new stop shows one toast of each kind', () =>
  {
    const searching = run(draftWithStops(11), { type: 'openSearch', purpose: 'addToRoute' });
    const result = flowReducer(searching, { type: 'closeSearch', addLandmarkIds: ['new-0', 'stop-0', 'new-1'] });
    expect(result.state.itinerary).toHaveLength(11);
    expect(result.effects).toEqual([{ type: 'toast', message: DUPLICATE_STOP_MESSAGE }, capToast]);
  });

  it('applies during a tour too', () =>
  {
    const touring = run(draftWithStops(11), { type: 'saveAndContinue' }, { type: 'startNavigation', at: 1 });
    const result = flowReducer(touring, { type: 'addToItinerary', landmarkId: 'new-stop' });
    expect(result.state.itinerary).toHaveLength(11);
    expect(result.effects).toEqual([capToast]);
  });

  it.each([
    ['below the cap', 10],
    ['on the cap', 11],
  ])('valid EC, no toast, saved route %s loads whole', (_label, count) =>
  {
    const result = flowReducer(homeEmpty, { type: 'loadItinerary', landmarkIds: stopIds(count) });
    expect(result.state.itinerary).toEqual(stopIds(count));
    expect(result.effects).toEqual([]);
  });

  it('invalid EC, saved route of 12 loads its first 11 with one cap toast', () =>
  {
    const result = flowReducer(homeEmpty, { type: 'loadItinerary', landmarkIds: stopIds(12) });
    expect(result.state.itinerary).toEqual(stopIds(11));
    expect(result.effects).toEqual([capToast]);
  });

  it('counts a saved route after removing repeats: 12 ids with 11 distinct loads whole, no toast', () =>
  {
    const result = flowReducer(homeEmpty, { type: 'loadItinerary', landmarkIds: [...stopIds(11), 'stop-0'] });
    expect(result.state.itinerary).toEqual(stopIds(11));
    expect(result.effects).toEqual([]);
  });

  it('Start Tour from a site replaces a full route with that one stop', () =>
  {
    const confirming = run(draftWithStops(11), { type: 'minimizeRouteEditor' }, { type: 'startTourFromSite', landmarkId: 'new-stop' });
    const result = flowReducer(confirming, { type: 'confirmStartTour', at: 1 });
    expect(result.state.itinerary).toEqual(['new-stop']);
    expect(result.effects).toEqual([]);
  });
});

describe('loadItinerary (saved routes)', () =>
{
  it('opens a saved route in the editor and keeps the old draft as the restore point', () =>
  {
    const loaded = flowReducer(homeDraft, { type: 'loadItinerary', landmarkIds: [C, A, C] }).state;
    expect(loaded.screen).toBe('routeEditor');
    expect(loaded.base).toBe('draft');
    expect(loaded.itinerary).toEqual([C, A]);
    expect(loaded.restorePoint).toEqual([A, B]);
  });

  it('refuses during a tour and for an empty route', () =>
  {
    const duringTour = flowReducer(navigation, { type: 'loadItinerary', landmarkIds: [C] });
    expect(duringTour.state).toBe(navigation);
    expect(duringTour.effects).toEqual([{ type: 'toast', message: TOUR_ACTIVE_MESSAGE }]);
    const empty = flowReducer(homeEmpty, { type: 'loadItinerary', landmarkIds: [] });
    expect(empty.effects).toEqual([{ type: 'toast', message: EMPTY_ROUTE_MESSAGE }]);
  });
});
