import { logger } from "./utils/logger.js";

const INTERACTION_THRESHOLD_PX = 25;

export class InteractionHandler {
  constructor(mapViewer, overlayManager, vehicleEngine, uiControls) {
    this.mapViewer = mapViewer;
    this.map = mapViewer.map;
    this.overlayManager = overlayManager;
    this.vehicleEngine = vehicleEngine;
    this.uiControls = uiControls;
    this.carCount = Number(document.getElementById("car-count").value) || 1;
    this.active = false;

    this.pointerMove = this.onPointerMove.bind(this);
    this.pointerClick = this.onPointerClick.bind(this);
    this.contextMenu = (event) => event.originalEvent?.preventDefault?.();
  }

  setCarCount(count) {
    this.carCount = Math.max(1, count);
  }

  enable() {
    if (this.active) return;
    this.active = true;
    this.map.on("mousemove", this.pointerMove);
    this.map.on("click", this.pointerClick);
    this.map.on("contextmenu", this.pointerClick);
    this.map.on("contextmenu", this.contextMenu);
    this.map.getContainer().style.cursor = "not-allowed";
  }

  disable() {
    if (!this.active) return;
    this.active = false;
    this.map.off("mousemove", this.pointerMove);
    this.map.off("click", this.pointerClick);
    this.map.off("contextmenu", this.pointerClick);
    this.map.off("contextmenu", this.contextMenu);
    this.overlayManager.highlightSegment(null);
    this.map.getContainer().style.cursor = "grab";
  }

  onPointerMove(event) {
    if (!this.overlayManager.hasSegments()) return;
    const containerPoint = this.map.latLngToContainerPoint(event.latlng);
    const match = this.overlayManager.findNearestSegment(containerPoint);
    if (match && match.distance <= INTERACTION_THRESHOLD_PX) {
      this.overlayManager.highlightSegment(match.segment.id);
      this.map.getContainer().style.cursor = "pointer";
    } else {
      this.overlayManager.highlightSegment(null);
      this.map.getContainer().style.cursor = "not-allowed";
    }
  }

  onPointerClick(event) {
    if (!this.overlayManager.hasSegments()) {
      logger.warn("Ignoring click — overlay not ready");
      return;
    }
    const containerPoint = this.map.latLngToContainerPoint(event.latlng);
    const match = this.overlayManager.findNearestSegment(containerPoint);
    if (!match || match.distance > INTERACTION_THRESHOLD_PX) {
      this.uiControls.showToast("Click directly on a highlighted road segment");
      return;
    }

    if (event.type === "contextmenu") {
      this.handleBlock(match.segment.id);
    } else {
      this.handleVehicleSpawn(match, this.carCount);
    }
  }

  handleVehicleSpawn(match, count) {
    this.vehicleEngine.spawnVehicles(match, count);
  }

  handleBlock(segmentId) {
    if (this.overlayManager.isSegmentBlocked(segmentId)) {
      this.uiControls.showToast("Segment already blocked");
      return;
    }
    this.overlayManager.addBlock(segmentId);
    this.uiControls.showToast("Block placed — vehicles will stop");
  }
}
