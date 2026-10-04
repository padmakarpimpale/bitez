import type { Location } from "./types";
import { inSingapore } from "./utils";
export async function currentLocation(): Promise<Location> {
  if (!navigator.geolocation)
    throw new Error(
      "Location is unavailable. Select an area or enter pickup coordinates.",
    );
  const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(
      resolve,
      () =>
        reject(
          new Error(
            "Could not access location. Check permission, or select an area instead.",
          ),
        ),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    ),
  );
  if (!inSingapore(pos.coords.latitude, pos.coords.longitude))
    throw new Error(
      "Bitez currently supports Singapore. Select a Singapore area instead.",
    );
  return {
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    label: `Current location (±${Math.round(pos.coords.accuracy)} m)`,
  };
}
