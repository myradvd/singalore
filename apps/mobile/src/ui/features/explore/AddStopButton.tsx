import { dispatchFlow, useFlowStore } from '@/modules/flow/flowStore';
import { COPY } from '../../copy';
import { IconButton } from '../../primitives/IconButton';
import { showToast } from '../../toastStore';

// Adds a landmark to the itinerary and confirms when the stop was really added.
export function AddStopButton({ landmarkId, landmarkName, testID }: { landmarkId: string; landmarkName: string; testID: string })
{
  const addStop = () =>
  {
    const stopCountBefore = useFlowStore.getState().state.itinerary.length;
    dispatchFlow({ type: 'addToItinerary', landmarkId });
    if (useFlowStore.getState().state.itinerary.length > stopCountBefore)
    {
      showToast(COPY.stopAddedToRoute);
    }
  };
  return <IconButton testID={testID} icon="plus" accessibilityLabel={`Add ${landmarkName} to route`} onPress={addStop} />;
}
