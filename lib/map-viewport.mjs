/** Keep the sidebar and map in sync without altering any source coordinates. */
export function withinViewport(point, viewport) {
  if (!viewport) return true;
  const {north,south,east,west}=viewport;
  return point.latitude>=south && point.latitude<=north && point.longitude>=west && point.longitude<=east;
}
export function uniqueNoticesInViewport(entries, viewport) {
  const ids=new Set();
  return entries.filter(point=>withinViewport(point,viewport) && !ids.has(point.id) && (ids.add(point.id),true));
}
