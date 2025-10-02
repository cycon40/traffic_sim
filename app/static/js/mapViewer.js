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
