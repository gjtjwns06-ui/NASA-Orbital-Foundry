import { forecastFlight } from "./flight-advisor";
import type { SimulationState } from "./sim/types";
self.onmessage = (
  event: MessageEvent<{ requestId: number; state: SimulationState }>,
) => {
  const { requestId, state } = event.data;
  try {
    self.postMessage({ requestId, forecast: forecastFlight(state) });
  } catch (error) {
    self.postMessage({
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
