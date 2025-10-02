export function haversineDistance(latlngA, latlngB) {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(latlngB.lat - latlngA.lat);
  const dLng = toRad(latlngB.lng - latlngA.lng);
  const lat1 = toRad(latlngA.lat);
  const lat2 = toRad(latlngB.lat);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function polylineLength(points) {
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += haversineDistance(points[i - 1], points[i]);
  }
  return total;
}

export function distancePointToSegment(point, a, b) {
  const apx = point.x - a.x;
  const apy = point.y - a.y;
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const ab2 = abx * abx + aby * aby;
  const dot = apx * abx + apy * aby;
  const t = ab2 !== 0 ? Math.max(0, Math.min(1, dot / ab2)) : 0;
  const closest = { x: a.x + abx * t, y: a.y + aby * t };
  const dx = point.x - closest.x;
  const dy = point.y - closest.y;
  return { distance: Math.hypot(dx, dy), t, closest };
}

export function distancePointToPolyline(point, polyline) {
  let closestSegment = null;
  let minDist = Infinity;
  let accumLength = 0;
  let tAlong = 0;

  for (let i = 1; i < polyline.length; i += 1) {
    const a = polyline[i - 1];
    const b = polyline[i];
    const { distance, t } = distancePointToSegment(point, a, b);
    if (distance < minDist) {
      minDist = distance;
      closestSegment = { index: i - 1, tOnSegment: t };
      tAlong = accumLength + t;
    }
    accumLength += 1;
  }

  return {
    distance: minDist,
    segmentIndex: closestSegment?.index ?? 0,
    t: tAlong,
    tOnSegment: closestSegment?.tOnSegment ?? 0,
  };
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
