import { logger } from "./utils/logger.js";
import { getVehicleIconMarkup } from "./vehicleShapes.js";
import { clamp } from "./utils/geoUtils.js";

function randomChoice(items) {
  if (!items.length) return null;
  const idx = Math.floor(Math.random() * items.length);
  return items[idx];
}

const DEFAULT_SPEED_MODE = { id: "normal", kind: "fixed", label: "Cruise", multiplier: 1 };

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
    this.speedMode = DEFAULT_SPEED_MODE;
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
    const isHighwayForSemi = (highway) =>
      new Set(["motorway", "trunk", "primary"]).has(String(highway || "").toLowerCase());
    for (let i = 0; i < count; i += 1) {
      let type = this.iterateTypes() || randomChoice(types);
      if ((type?.name === "semi_truck" || type?.shape === "semi") && !isHighwayForSemi(segment?.highway)) {
        // Skip semi trucks off highways; pick a non-semi fallback
        const pool = types.filter((t) => t.name !== "semi_truck");
        type = randomChoice(pool) || types.find((t) => t.name !== "semi_truck") || type;
      }
      const vehicleId = `vehicle-${this.vehicleId += 1}`;
      const direction = 1;
      const baseDistance = this.distanceAt(segment, segmentIndex, tOnSegment);
      const distanceJitter = (Math.random() * 8 - 4) * i;
      const initialDistance = clamp(baseDistance + distanceJitter, 0, segment.totalLength);
      const iconMarkup = getVehicleIconMarkup(type?.shape || type?.name);
      const vehicleColor = type?.color || "#38bdf8";
      const icon = L.divIcon({
        className: "vehicle-icon",
        iconSize: [34, 34],
        iconAnchor: [17, 17],
        html: `<div class="vehicle-marker" style="--vehicle-color:${vehicleColor}">${iconMarkup}</div>`,
      });
      const marker = L.marker(segment.latlngs[segmentIndex], {
        icon,
        pane: "markerPane",
        interactive: false,
        keyboard: false,
      }).addTo(this.map);
      const speedJitter = 0.85 + Math.random() * 0.3;
      const baseSpeed = clamp((type?.avgSpeedMps || 8) * speedJitter, 1, type?.maxSpeedMps || 30);
      const vehicle = {
        id: vehicleId,
        type,
        segmentId: segment.id,
        direction,
        distance: initialDistance,
        // Maintain a per-vehicle factor so user-edited type speeds apply live
        speedFactor: (type?.avgSpeedMps ? baseSpeed / type.avgSpeedMps : 1),
        status: "active",
        marker,
      };
      this.vehicles.set(vehicleId, vehicle);
      this.updateMarkerPosition(vehicle);
      const element = marker.getElement();
      if (element) {
        element.dataset.vehicleType = type?.name || "vehicle";
      }
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

  setSpeedMode(mode) {
    this.speedMode = mode || DEFAULT_SPEED_MODE;
  }

  isDynamicSpeed() {
    return this.speedMode?.kind === "dynamic";
  }

  getCurrentSpeedMultiplier() {
    if (!this.speedMode) return 1;
    if (this.speedMode.kind === "fixed") {
      const fixed = this.speedMode.multiplier ?? 1;
      return clamp(fixed, 0.5, 5);
    }
    const rawThreshold = this.mapViewer?.getInteractionThresholdMiles?.();
    const threshold = Number.isFinite(rawThreshold) ? rawThreshold : 0;
    const rawRadius = this.mapViewer?.getVisibleRadiusMiles?.();
    const radius = Number.isFinite(rawRadius) ? rawRadius : threshold || 1;
    const baseRatio = threshold > 0 ? radius / threshold : 1;
    const scaled = baseRatio * (this.speedMode.baseMultiplier ?? 1);
    const min = this.speedMode.min ?? 0.75;
    const max = this.speedMode.max ?? 3.5;
    return clamp(scaled, min, max);
  }

  update(delta) {
    if (delta <= 0) return;
    const bounds = this.map.getBounds().pad(0.2);
    const speedMultiplier = this.getCurrentSpeedMultiplier();
    this.vehicles.forEach((vehicle) => {
      if (vehicle.status === "exited") return;
      if (vehicle.status === "blocked") {
        // If we are stationed at a node and a path opens, try to proceed
        const segment = this.overlayManager.getSegment(vehicle.segmentId);
        if (!segment) return;
        const nodeKey = vehicle.direction === 1 ? segment.terminals.endKey : segment.terminals.startKey;
        const candidates = this.overlayManager
          .getConnectedSegments(nodeKey, vehicle.segmentId)
          .filter((c) => !this.overlayManager.isSegmentBlocked(c.segmentId));
        if (candidates.length > 0) {
          vehicle.status = "active";
          vehicle.marker.getElement()?.classList.remove("paused");
        } else {
          return; // remain blocked at node
        }
      }

      // Anticipate blocks: if a block lies ahead on the current segment,
      // plan a U-turn and head back to the previous node before reaching the block.
      const blockInfo = this.overlayManager.getBlockInfo(vehicle.segmentId);
      if (blockInfo) {
        const dist = blockInfo.distance;
        const ahead = vehicle.direction === 1 ? vehicle.distance < dist : vehicle.distance > dist;
        if (ahead && !vehicle.uTurnPlanned) {
          vehicle.uTurnPlanned = true;
          vehicle.direction *= -1; // begin heading back to the previous intersection
        }
      }

      const avg = vehicle.type?.avgSpeedMps ?? 8;
      const baseSpeed = avg * (vehicle.speedFactor ?? 1);
      let remaining = clamp(baseSpeed, 0.5, 100) * speedMultiplier * delta;
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
            // If we couldn't transition at this node, stay here as blocked
            vehicle.status = "blocked";
            vehicle.marker.getElement()?.classList.add("paused");
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

  rerouteFromBlocked(vehicle) {
    const segment = this.overlayManager.getSegment(vehicle.segmentId);
    if (!segment) return false;
    const nodeKey = vehicle.direction === 1 ? segment.terminals.endKey : segment.terminals.startKey;
    const candidates = this.overlayManager
      .getConnectedSegments(nodeKey, vehicle.segmentId)
      .filter((c) => !this.overlayManager.isSegmentBlocked(c.segmentId));
    const next = randomChoice(candidates);
    if (!next) return false;
    const nextSegment = this.overlayManager.getSegment(next.segmentId);
    if (!nextSegment) return false;
    vehicle.segmentId = next.segmentId;
    vehicle.direction = next.direction;
    vehicle.distance = next.direction === 1 ? 0 : nextSegment.totalLength;
    return true;
  }

  updateMarkerPosition(vehicle) {
    const segment = this.overlayManager.getSegment(vehicle.segmentId);
    if (!segment) return;
    const distance = clamp(vehicle.distance, 0, segment.totalLength);
    const { latlng, heading } = this.poseAtDistance(segment, distance, vehicle.direction);
    vehicle.marker.setLatLng(latlng);
    const element = vehicle.marker.getElement();
    if (element) {
      element.style.setProperty("--heading-deg", `${heading}deg`);
    }
  }

  poseAtDistance(segment, distance, direction) {
    const clampedDistance = clamp(distance, 0, segment.totalLength);
    const current = this.interpolateLatLng(segment, clampedDistance);
    const offsetMeters = Math.max(segment.totalLength * 0.0125, 3);
    let sampleDistance = clamp(
      clampedDistance + offsetMeters * direction,
      0,
      segment.totalLength,
    );
    if (sampleDistance === clampedDistance) {
      sampleDistance = clamp(
        clampedDistance - offsetMeters * direction,
        0,
        segment.totalLength,
      );
    }
    const ahead = this.interpolateLatLng(segment, sampleDistance);
    let dx = ahead.lng - current.lng;
    let dy = ahead.lat - current.lat;
    if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) {
      dx = 0;
      dy = direction;
    }
    let heading = Math.atan2(dx, dy) * (180 / Math.PI);
    heading = (heading + 360) % 360;
    return { latlng: L.latLng(current.lat, current.lng), heading };
  }

  interpolateLatLng(segment, distance) {
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
    return { lat, lng };
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
