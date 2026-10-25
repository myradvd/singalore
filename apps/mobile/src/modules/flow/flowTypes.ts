export type FlowBase = 'empty' | 'draft' | 'inProgress';
export type FlowScreen = 'home' | 'expandedMap' | 'routeEditor' | 'routeConfirm' | 'navigation';
export type FlowOverlay = 'sidebar' | 'search';
export type SearchPurpose = 'browse' | 'addToRoute';

export type FlowModal =
  | { kind: 'confirmStartTour'; landmarkId: string }
  | { kind: 'confirmExit'; origin: 'routeEditor' | 'navigation' };

export interface FlowState
{
  base: FlowBase;
  screen: FlowScreen;
  overlays: FlowOverlay[];
  searchPurpose: SearchPurpose;
  modal: FlowModal | null;
  itinerary: string[];
  restorePoint: string[] | null;
  selectedLandmarkId: string | null;
  tourStartedAt: number | null;
  visitedLandmarkIds: string[];
}

export type ExitChoice = 'save' | 'discard' | 'cancel';

export type FlowEvent =
  | { type: 'restoreFromCache'; cache: FlowCachePayload | null }
  | { type: 'openSidebar' }
  | { type: 'closeSidebar' }
  | { type: 'openSearch'; purpose: SearchPurpose }
  | { type: 'closeSearch'; addLandmarkIds?: string[] }
  | { type: 'selectLandmark'; landmarkId: string | null }
  | { type: 'addToItinerary'; landmarkId: string }
  | { type: 'removeFromItinerary'; landmarkId: string }
  | { type: 'reorderItinerary'; fromIndex: number; toIndex: number }
  | { type: 'applyOrder'; landmarkIds: string[] }
  | { type: 'loadItinerary'; landmarkIds: string[] }
  | { type: 'clearAll' }
  | { type: 'restoreItinerary' }
  | { type: 'openExpandedMap' }
  | { type: 'closeExpandedMap' }
  | { type: 'openRouteEditor' }
  | { type: 'minimizeRouteEditor' }
  | { type: 'requestCloseRouteEditor' }
  | { type: 'saveAndContinue' }
  | { type: 'backFromConfirmation' }
  | { type: 'startTourFromSite'; landmarkId: string }
  | { type: 'confirmStartTour'; at: number }
  | { type: 'cancelStartTour' }
  | { type: 'startNavigation'; at: number }
  | { type: 'pauseNavigation' }
  | { type: 'resumeNavigation' }
  | { type: 'requestExitNavigation' }
  | { type: 'chooseExit'; choice: ExitChoice; at: number }
  | { type: 'markVisited'; landmarkId: string; at: number };

export type FlowEffect =
  | { type: 'toast'; message: string }
  | { type: 'saveItinerary'; landmarkIds: string[] }
  | { type: 'recordHistory'; landmarkIds: string[]; visitedLandmarkIds: string[]; startedAt: number; endedAt: number; status: 'completed' | 'abandoned' }
  | { type: 'startTourTracking' }
  | { type: 'stopTourTracking' }
  | { type: 'tourCompleted' };

export interface FlowCachePayload
{
  mode: 'empty' | 'route_editor' | 'route_in_progress';
  itinerary: string[];
  visitedLandmarkIds: string[];
  tourStartedAt: number | null;
}

export interface FlowTransition
{
  state: FlowState;
  effects: FlowEffect[];
}
