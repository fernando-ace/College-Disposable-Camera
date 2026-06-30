function dateTime(value) {
  if (!value) return Number.NEGATIVE_INFINITY;
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(time) ? time : Number.NEGATIVE_INFINITY;
}

function latestDate(values) {
  const latest = values.reduce((current, value) => (dateTime(value) > dateTime(current) ? value : current), null);
  return latest ? new Date(latest) : null;
}

function isVisibleUpload(photo) {
  return photo && !photo.deletedAt && (!photo.visibilityStatus || photo.visibilityStatus === "VISIBLE");
}

function getEventLastActivityAt(event) {
  const visibleUploads = Array.isArray(event.photos)
    ? event.photos.filter(isVisibleUpload).map((photo) => photo.createdAt)
    : [];
  return latestDate([event.updatedAt, event.createdAt, ...visibleUploads]) || new Date(0);
}

function compareEventsByRecentActivity(first, second) {
  const activityDelta = dateTime(second.lastActivityAt || getEventLastActivityAt(second)) - dateTime(first.lastActivityAt || getEventLastActivityAt(first));
  if (activityDelta !== 0) return activityDelta;

  const createdDelta = dateTime(second.createdAt) - dateTime(first.createdAt);
  if (createdDelta !== 0) return createdDelta;

  const nameDelta = String(first.name || "").localeCompare(String(second.name || ""));
  if (nameDelta !== 0) return nameDelta;

  return String(first.id || "").localeCompare(String(second.id || ""));
}

function sortEventsByRecentActivity(events) {
  return [...events].sort(compareEventsByRecentActivity);
}

module.exports = {
  compareEventsByRecentActivity,
  getEventLastActivityAt,
  sortEventsByRecentActivity,
};
