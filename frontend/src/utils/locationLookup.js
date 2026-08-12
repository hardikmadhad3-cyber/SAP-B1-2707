export const getLocationCode = (location = {}) =>
  String(location.code ?? location.Code ?? location.LocationCode ?? '').trim();

export const getLocationName = (location = {}) =>
  String(location.name ?? location.Location ?? location.Name ?? location.LocationName ?? location.locationName ?? '').trim();

export const buildLocationLookupOptions = (locations = []) =>
  (Array.isArray(locations) ? locations : [])
    .map((location) => {
      const value = getLocationCode(location);
      const locationName = getLocationName(location);
      return {
        value,
        description: locationName,
        label: locationName ? `${value} - ${locationName}` : value,
        code: value,
        locationName,
      };
    })
    .filter((option) => option.value);

export const resolveLocationDisplayName = (value, locations = []) => {
  const code = String(value ?? '').trim();
  if (!code) return '';

  const match = buildLocationLookupOptions(locations).find(
    (location) => String(location.value) === code
  );

  return match?.locationName || code;
};
