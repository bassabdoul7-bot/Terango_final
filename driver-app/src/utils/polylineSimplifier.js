// Douglas-Peucker line simplification algorithm
// Reduces polyline points for straighter, cleaner routes

const getPerpendicularDistance = (point, lineStart, lineEnd) => {
  const { latitude: lat, longitude: lon } = point;
  const { latitude: lat1, longitude: lon1 } = lineStart;
  const { latitude: lat2, longitude: lon2 } = lineEnd;

  // Convert lat/lon to approximate meters for accurate distance calculation
  const midLat = (lat1 + lat2) / 2;
  const latScale = 111320; // meters per degree latitude
  const lonScale = 111320 * Math.cos(midLat * Math.PI / 180); // meters per degree longitude

  const x = lat * latScale;
  const y = lon * lonScale;
  const x1 = lat1 * latScale;
  const y1 = lon1 * lonScale;
  const x2 = lat2 * latScale;
  const y2 = lon2 * lonScale;

  const A = x - x1;
  const B = y - y1;
  const C = x2 - x1;
  const D = y2 - y1;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;

  if (lenSq !== 0) param = dot / lenSq;

  let xx, yy;

  if (param < 0) {
    xx = x1;
    yy = y1;
  } else if (param > 1) {
    xx = x2;
    yy = y2;
  } else {
    xx = x1 + param * C;
    yy = y1 + param * D;
  }

  const dx = x - xx;
  const dy = y - yy;
  return Math.sqrt(dx * dx + dy * dy);
};

const douglasPeucker = (points, tolerance) => {
  if (points.length <= 2) return points;

  let maxDistance = 0;
  let index = 0;
  const end = points.length - 1;

  for (let i = 1; i < end; i++) {
    const distance = getPerpendicularDistance(points[i], points[0], points[end]);
    if (distance > maxDistance) {
      index = i;
      maxDistance = distance;
    }
  }

  if (maxDistance > tolerance) {
    const left = douglasPeucker(points.slice(0, index + 1), tolerance);
    const right = douglasPeucker(points.slice(index), tolerance);
    return [...left.slice(0, -1), ...right];
  }

  return [points[0], points[end]];
};

export const simplifyPolyline = (coordinates, tolerance = 5.5) => {
  if (!coordinates || coordinates.length < 3) return coordinates;
  return douglasPeucker(coordinates, tolerance);
};
