import { logger } from "./utils/logger.js";

const DEFAULT_CENTER = [37.7749, -122.4194];
const DEFAULT_ZOOM = 14;
const MAX_INTERACTION_RADIUS_MILES = 5;

function metersToMiles(meters) {
  return meters * 0.000621371;
}

export class MapViewer {
  constructor() {
    this.map = L.map("map", {
      zoomControl: false,
      minZoom: 5,
      maxZoom: 19,
    }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);

    L.control
      .zoom({
        position: "topright",
      })
      .addTo(this.map);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(this.map);

    this.zoomListeners = new Set();
    this.map.on("zoomend", () => this.emitZoomChange());
    this.map.on("moveend", () => this.emitZoomChange());

    // Visual boundary (double-line ring) for valid interaction radius
    this.boundaryLayer = L.layerGroup().addTo(this.map);
    this.boundaryVisible = false;
  }

  onZoomChange(listener) {
    this.zoomListeners.add(listener);
  }

  emitZoomChange() {
    const radiusMiles = this.getVisibleRadiusMiles();
    this.zoomListeners.forEach((listener) => listener(radiusMiles));
  }

  getVisibleRadiusMiles() {
    const bounds = this.map.getBounds();
    const center = bounds.getCenter();
    const north = bounds.getNorth();
    const point = L.latLng(north, center.lng);
    const meters = this.map.distance(center, point);
    return metersToMiles(meters);
  }

  isWithinInteractionThreshold() {
    const radius = this.getVisibleRadiusMiles();
    logger.debug("visible radius", radius);
    return radius <= MAX_INTERACTION_RADIUS_MILES;
  }

  getInteractionThresholdMiles() {
    return MAX_INTERACTION_RADIUS_MILES;
  }

  // Boundary ring visibility management -------------------------------------
  showBoundary(show) {
    this.boundaryVisible = !!show;
    if (show) {
      this.updateBoundary();
    } else {
      this.boundaryLayer.clearLayers();
    }
  }

  updateBoundary() {
    if (!this.boundaryVisible) return;
    const center = this.map.getCenter();
    const radiusMeters = this.milesToMeters(this.getInteractionThresholdMiles());
    this.boundaryLayer.clearLayers();
    const common = {
      // Deep blue for strong contrast on light maps
      color: "#1e40af",
      weight: 2.5,
      opacity: 0.9,
      fill: false,
      interactive: false,
      dashArray: "6,6",
    };
    // Outer ring
    L.circle(center, { ...common, weight: 3.5, radius: radiusMeters }).addTo(this.boundaryLayer);
    // Slightly inner ring for double-line effect
    L.circle(center, { ...common, weight: 2, radius: radiusMeters * 0.985 }).addTo(
      this.boundaryLayer,
    );
  }

  milesToMeters(miles) {
    return miles / 0.000621371;
  }

  freeze() {
    this.map.dragging.disable();
    this.map.scrollWheelZoom.disable();
    this.map.doubleClickZoom.disable();
    this.map.boxZoom.disable();
    this.map.keyboard.disable();
  }

  unfreeze() {
    this.map.dragging.enable();
    this.map.scrollWheelZoom.enable();
    this.map.doubleClickZoom.enable();
    this.map.boxZoom.enable();
    this.map.keyboard.enable();
  }
}
