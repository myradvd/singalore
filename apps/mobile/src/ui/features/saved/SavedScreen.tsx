import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAppServices } from '@/composition/AppServicesContext';
import { useCatalogStore } from '@/modules/catalog/catalogStore';
import { dispatchFlow } from '@/modules/flow/flowStore';
import type { SavedItinerary, SavedRepository } from '@/modules/saved/SavedRepository';
import { IconButton } from '../../primitives/IconButton';
import { ListRow } from '../../primitives/ListRow';
import { EmptyState, ErrorState } from '../../primitives/States';
import { colors, spacing, typography } from '../../theme/tokens';
import { showToast } from '../../toastStore';
import { ScreenScaffold, SectionTitle } from '../shell/ScreenScaffold';

type LoadState =
  | { status: 'loading' }
  | { status: 'failed' }
  | { status: 'ready'; routes: SavedItinerary[]; landmarkIds: string[] };

async function loadSaved(saved: SavedRepository): Promise<LoadState>
{
  try
  {
    const [routes, landmarkIds] = await Promise.all([saved.savedItineraries(), saved.savedLandmarkIds()]);
    return { status: 'ready', routes, landmarkIds };
  }
  catch
  {
    return { status: 'failed' };
  }
}

export function SavedScreen()
{
  const router = useRouter();
  const services = useAppServices();
  const landmarksById = useCatalogStore((state) => state.landmarksById);
  const parksById = useCatalogStore((state) => state.parksById);
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });

  const refresh = useCallback(async () => setLoad(await loadSaved(services.saved)), [services]);

  useEffect(() =>
  {
    void loadSaved(services.saved).then(setLoad);
  }, [services]);

  const openRoute = (route: SavedItinerary) =>
  {
    const known = route.landmarkIds.filter((id) => landmarksById.has(id));
    if (known.length < route.landmarkIds.length)
    {
      showToast('Some stops are no longer available and were left out.');
    }
    dispatchFlow({ type: 'loadItinerary', landmarkIds: known });
    router.back();
  };

  const deleteRoute = async (route: SavedItinerary) =>
  {
    await services.saved.deleteItinerary(route.id);
    showToast(`Deleted ${route.title}.`);
    await refresh();
  };

  const showSite = (landmarkId: string) =>
  {
    dispatchFlow({ type: 'selectLandmark', landmarkId });
    router.back();
  };

  const removeSite = async (landmarkId: string) =>
  {
    await services.saved.toggleLandmark(landmarkId);
    await refresh();
  };

  return (
    <ScreenScaffold testID="saved-screen" title="Saved Routes and Sites" onBack={() => router.back()}>
      {load.status === 'failed' && <ErrorState icon="alert-circle-outline" title="Could not load saved items" message="Please try again." actionLabel="Retry" onAction={() => void refresh()} />}
      {load.status === 'ready' && load.routes.length === 0 && load.landmarkIds.length === 0 && (
        <EmptyState testID="saved-empty" icon="bookmark-outline" title="Nothing saved yet" message="Save a site from its summary card, or choose Save and Exit when you leave a tour." />
      )}
      {load.status === 'ready' && load.routes.length > 0 && (
        <View>
          <SectionTitle label="Saved routes" />
          {load.routes.map((route) => (
            <ListRow
              key={route.id}
              testID={`saved-route-${route.id}`}
              icon="map-marker-path"
              title={route.title}
              subtitle={`${route.landmarkIds.length} ${route.landmarkIds.length === 1 ? 'stop' : 'stops'}  ·  saved ${new Date(route.createdAt).toLocaleDateString()}`}
              onPress={() => openRoute(route)}
              accessibilityHint="Opens this route in the route editor"
              trailing={<IconButton testID={`saved-route-delete-${route.id}`} icon="delete-outline" accessibilityLabel={`Delete ${route.title}`} onPress={() => void deleteRoute(route)} variant="plain" />}
              showChevron={false}
            />
          ))}
        </View>
      )}
      {load.status === 'ready' && load.landmarkIds.length > 0 && (
        <View>
          <SectionTitle label="Saved sites" />
          {load.landmarkIds.map((landmarkId) =>
          {
            const landmark = landmarksById.get(landmarkId);
            if (landmark === undefined)
            {
              return (
                <ListRow
                  key={landmarkId}
                  icon="map-marker-question-outline"
                  title="Site no longer available"
                  trailing={<IconButton icon="delete-outline" accessibilityLabel="Remove unavailable site" onPress={() => void removeSite(landmarkId)} variant="plain" />}
                  showChevron={false}
                />
              );
            }
            return (
              <ListRow
                key={landmarkId}
                testID={`saved-site-${landmarkId}`}
                icon="bookmark"
                title={landmark.name}
                subtitle={parksById.get(landmark.parkId)?.name ?? ''}
                onPress={() => showSite(landmarkId)}
                accessibilityHint="Shows this site on the map"
                trailing={<IconButton testID={`saved-site-remove-${landmarkId}`} icon="bookmark-remove-outline" accessibilityLabel={`Remove ${landmark.name} from saved sites`} onPress={() => void removeSite(landmarkId)} variant="plain" />}
                showChevron={false}
              />
            );
          })}
        </View>
      )}
      {load.status === 'loading' && <Text style={[typography.caption, styles.loading]}>Loading...</Text>}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  loading: { color: colors.textMuted, padding: spacing.xl },
});
