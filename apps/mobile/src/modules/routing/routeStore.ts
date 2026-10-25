import { create } from 'zustand';
import { INITIAL_ROUTE_STATE, type RouteNavigator, type RouteState } from './RouteNavigator';

export const useRouteStore = create<RouteState>(() => INITIAL_ROUTE_STATE);

export function bindRouteStore(navigator: RouteNavigator): () => void
{
  useRouteStore.setState(navigator.getState());
  return navigator.subscribe((state) => useRouteStore.setState(state));
}
