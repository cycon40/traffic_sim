import { logger } from "./utils/logger.js";
import { clamp } from "./utils/geoUtils.js";

function randomChoice(items) {
  if (!items.length) return null;
  const idx = Math.floor(Math.random() * items.length);
  return items[idx];
}

export class VehicleEngine {
  constructor(mapViewer, overlayManager, vehicleConfig) {
    this.mapViewer = mapViewer;
    this.map = mapViewer.map;
    this.overlayManager = overlayManager;
    this.vehicleConfig = vehicleConfig;
    this.vehicles = new Map();
    this.vehicleId = 0;
    this.running = false;
    this.paused = false;
    this.lastTimestamp = null;
    this.animationFrame = null;
    this.listeners = new Map();
    this.typeIterator = null;
    this.hasActiveVehicles = false;
  }

  on(event, callback) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(callback);
  }

  emit(event, payload) {
    this.listeners.get(event)?.forEach((callback) => callback(payload));
  }

  iterateTypes() {
    const types = Array.from(this.vehicleConfig.getTypes().values());
    if (!types.length) return null;
    if (!this.typeIterator || this.typeIterator.index >= types.length) {
      this.typeIterator = { index: 0, types };
    }
    const type = this.typeIterator.types[this.typeIterator.index % types.length];
    this.typeIterator.index += 1;
    return type;
  }

  spawnVehicles(segmentResult, count) {
    if (!segmentResult) return;
    const { segment, segmentIndex, tOnSegment } = segmentResult;
    const types = Array.from(this.vehicleConfig.getTypes().values());
    if (!types.length) {
      logger.warn("No vehicle types available");
      return;
    }
    for (let i = 0; i < count; i += 1) {
      const type = this.iterateTypes() || randomChoice(types);
      const vehicleId = `vehicle-${this.vehicleId += 1}`;
      const direction = 1;
      const baseDistance = this.distanceAt(segment, segmentIndex, tOnSegment);
      const jitter = (Math.random() * 8 - 4) * i;
      const initialDistance = clamp(baseDistance + jitter, 0, segment.totalLength);
      const marker = L.circleMarker(segment.latlngs[segmentIndex], {
        radius: 6,
        weight: 2,
        color: "#0f172a",
        fillColor: type.color,
        fillOpacity: 1,
        pane: "markerPane",
      }).addTo(this.map);
      marker.getElement()?.classList.add("vehicle-marker");
      const vehicle = {
        id: vehicleId,
        type,
        segmentId: segment.id,
        direction,
        distance: initialDistance,
        speedMps: clamp(type.avgSpeedMps * (0.85 + Math.random() * 0.3), 1, type.maxSpeedMps),
        status: "active",
        marker,
      };
      this.vehicles.set(vehicleId, vehicle);
      this.updateMarkerPosition(vehicle);
    }
    this.hasActiveVehicles = true;
    this.emitCounts();
    this.ensureLoop();
  }

  distanceAt(segment, segmentIndex, tOnSegment) {
    const clampedIndex = clamp(segmentIndex, 0, segment.cumulativeLengths.length - 2);
    const startDistance = segment.cumulativeLengths[clampedIndex];
    const segmentLength =
      segment.cumulativeLengths[clampedIndex + 1] - segment.cumulativeLengths[clampedIndex];
    return startDistance + segmentLength * clamp(tOnSegment, 0, 1);
  }

  ensureLoop() {
    if (this.animationFrame) return;
    this.running = true;
    const loop = (timestamp) => {
      if (!this.running) return;
      if (!this.lastTimestamp) this.lastTimestamp = timestamp;
      const delta = (timestamp - this.lastTimestamp) / 1000;
      this.lastTimestamp = timestamp;
      if (!this.paused) {
        this.update(delta);
      }
      this.animationFrame = requestAnimationFrame(loop);
    };
    this.animationFrame = requestAnimationFrame(loop);
  }

  start() {
    this.running = true;
    this.paused = false;
    this.lastTimestamp = null;
    this.vehicles.forEach((vehicle) => vehicle.marker.getElement()?.classList.remove("paused"));
    this.ensureLoop();
  }

  pause() {
    this.paused = true;
    this.vehicles.forEach((vehicle) => vehicle.marker.getElement()?.classList.add("paused"));
  }

  resume() {
    this.paused = false;
    this.lastTimestamp = null;
    this.vehicles.forEach((vehicle) => vehicle.marker.getElement()?.classList.remove("paused"));
  }

  stop(clearVehicles = true) {
    this.running = false;
    this.paused = false;
    if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
    this.animationFrame = null;
    this.lastTimestamp = null;
    if (clearVehicles) {
      this.clearVehicles();
    } else {
      this.vehicles.forEach((vehicle) => {
        vehicle.marker.getElement()?.classList.add("paused");
      });
      this.emitCounts();
    }
  }

  clearVehicles() {
    this.vehicles.forEach((vehicle) => vehicle.marker.remove());
    this.vehicles.clear();
    this.hasActiveVehicles = false;
    this.emitCounts();
  }

  update(delta) {
    if (delta <= 0) return;
    const bounds = this.map.getBounds().pad(0.2);
    this.vehicles.forEach((vehicle) => {
      if (vehicle.status === "exited") return;
      if (vehicle.status === "blocked") {
        if (!this.overlayManager.isSegmentBlocked(vehicle.segmentId)) {
          vehicle.status = "active";
          vehicle.marker.getElement()?.classList.remove("paused");
        } else {
          return;
        }
      }
      if (this.overlayManager.isSegmentBlocked(vehicle.segmentId)) {
        vehicle.status = "blocked";
        vehicle.marker.getElement()?.classList.add("paused");
        return;
      }

      let remaining = vehicle.speedMps * delta;
      while (remaining > 0 && vehicle.status === "active") {
        const segment = this.overlayManager.getSegment(vehicle.segmentId);
        if (!segment) {
          vehicle.status = "exited";
          break;
        }
        const targetDistance = vehicle.direction === 1 ? segment.totalLength : 0;
        const distanceToTarget = Math.abs(targetDistance - vehicle.distance);
        if (distanceToTarget > remaining) {
          vehicle.distance += vehicle.direction * remaining;
          remaining = 0;
        } else {
          vehicle.distance = targetDistance;
          remaining -= distanceToTarget;
          const transitioned = this.advanceToNextSegment(vehicle);
          if (!transitioned) {
            vehicle.status = "exited";
            break;
          }
        }
      }

      if (vehicle.status === "exited") {
        vehicle.marker.remove();
        this.vehicles.delete(vehicle.id);
        return;
      }

      const segment = this.overlayManager.getSegment(vehicle.segmentId);
      if (!segment) {
        vehicle.marker.remove();
        this.vehicles.delete(vehicle.id);
        return;
      }

      this.updateMarkerPosition(vehicle);
      if (!bounds.contains(vehicle.marker.getLatLng())) {
        vehicle.marker.remove();
        this.vehicles.delete(vehicle.id);
      }
    });

    this.emitCounts();
  }

  advanceToNextSegment(vehicle) {
    const segment = this.overlayManager.getSegment(vehicle.segmentId);
    if (!segment) return false;
    const nodeKey = vehicle.direction === 1 ? segment.terminals.endKey : segment.terminals.startKey;
    const candidates = this.overlayManager
      .getConnectedSegments(nodeKey, vehicle.segmentId)
      .filter((candidate) => !this.overlayManager.isSegmentBlocked(candidate.segmentId));
    const next = randomChoice(candidates);
    if (!next) {
      return false;
    }
    const nextSegment = this.overlayManager.getSegment(next.segmentId);
    if (!nextSegment) {
      return false;
    }
    vehicle.segmentId = next.segmentId;
    vehicle.direction = next.direction;
    vehicle.distance = next.direction === 1 ? 0 : nextSegment.totalLength;
    return true;
  }

  updateMarkerPosition(vehicle) {
    const segment = this.overlayManager.getSegment(vehicle.segmentId);
    if (!segment) return;
    const distance = clamp(vehicle.distance, 0, segment.totalLength);
    const latlng = this.latLngAtDistance(segment, distance);
    vehicle.marker.setLatLng(latlng);
  }

  latLngAtDistance(segment, distance) {
    const target = clamp(distance, 0, segment.totalLength);
    const cumulative = segment.cumulativeLengths;
    let index = 1;
    while (index < cumulative.length && cumulative[index] < target) {
      index += 1;
    }
    index = clamp(index, 1, cumulative.length - 1);
    const prevPoint = segment.latlngs[index - 1];
    const nextPoint = segment.latlngs[index];
    const startDistance = cumulative[index - 1];
    const segmentLength = cumulative[index] - startDistance;
    const ratio = segmentLength === 0 ? 0 : (target - startDistance) / segmentLength;
    const lat = prevPoint.lat + (nextPoint.lat - prevPoint.lat) * ratio;
    const lng = prevPoint.lng + (nextPoint.lng - prevPoint.lng) * ratio;
    return L.latLng(lat, lng);
  }

  emitCounts() {
    const counts = { active: 0, blocked: 0, exited: 0 };
    this.vehicles.forEach((vehicle) => {
      counts[vehicle.status] = (counts[vehicle.status] || 0) + 1;
    });
    counts.total = this.vehicles.size;
    this.emit("counts", counts);
    const hadVehicles = this.hasActiveVehicles;
    if (counts.total === 0) {
      this.hasActiveVehicles = false;
      if (this.running && hadVehicles) {
        this.emit("idle");
      }
      return;
    }
    this.hasActiveVehicles = true;
    if (!this.running) {
      return;
    }
    if (counts.active === 0) {
      this.emit("jammed");
    }
  }
}
