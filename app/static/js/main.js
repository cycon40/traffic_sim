import { MapViewer } from "./mapViewer.js";
import { OverlayManager } from "./overlayManager.js";
import { VehicleConfig } from "./vehicleConfig.js";
import { UIControls } from "./uiControls.js";
import { SimulationController, SimulationStates } from "./simController.js";
import { VehicleEngine } from "./vehicleEngine.js";
import { InteractionHandler } from "./interactionHandler.js";
import { logger } from "./utils/logger.js";

const LEAFLET_TIMEOUT_MS = 4000;
let initialized = false;
let timeoutId = null;

function showStartupError(message) {
  const banner = document.getElementById("startup-error");
  if (!banner) return;
  banner.textContent = message;
  banner.hidden = false;
}

function initializeApp() {
  if (initialized) return;
  if (!window.L) {
    logger.error("Leaflet failed to load");
    showStartupError("Map engine did not load. Allow access to unpkg.com or reload to use the local fallback.");
    return;
  }
  initialized = true;
  if (timeoutId) {
    window.clearTimeout(timeoutId);
  }

  const mapViewer = new MapViewer();
  const overlayManager = new OverlayManager(mapViewer.map);
  const vehicleConfig = new VehicleConfig();
  const simulation = new SimulationController();
  const thresholdMiles = mapViewer.getInteractionThresholdMiles();
  let overlayBuilt = false;
  let preserveVehiclesOnStop = false;
  let interactions = null;

  const uiControls = new UIControls({
    onRunToggle: () => handleRunToggle(),
    onStop: () => handleStop(),
    onCarCountChange: (value) => interactions?.setCarCount(value),
  });

  const vehicleEngine = new VehicleEngine(mapViewer, overlayManager, vehicleConfig);
  interactions = new InteractionHandler(mapViewer, overlayManager, vehicleEngine, uiControls);

  vehicleConfig.ready.then(() => {
    uiControls.renderLegend(Array.from(vehicleConfig.getTypes().values()));
  });

  mapViewer.onZoomChange((radius) => {
    if (overlayManager.hasSegments()) {
      overlayManager.updateScreenPoints();
    }
    uiControls.updateZoomIndicator(radius, thresholdMiles);
    const shouldShow = radius > thresholdMiles && (simulation.isIdle() || simulation.state === SimulationStates.STOPPED);
    uiControls.showOverlayMessage(shouldShow);
  });

  // Trigger an initial indicator update before the first interaction.
  uiControls.updateZoomIndicator(mapViewer.getVisibleRadiusMiles(), thresholdMiles);
  uiControls.showOverlayMessage(!mapViewer.isWithinInteractionThreshold());

  vehicleEngine.on("counts", (counts) => {
    logger.debug("vehicle counts", counts);
  });

  vehicleEngine.on("idle", () => {
    if (simulation.isRunning()) {
      uiControls.showToast("All vehicles have exited the viewport");
      preserveVehiclesOnStop = true;
      simulation.stop();
    }
  });

  vehicleEngine.on("jammed", () => {
    if (simulation.isRunning()) {
      uiControls.showToast("Traffic jam detected - simulation halted");
      preserveVehiclesOnStop = true;
      simulation.stop();
    }
  });

  simulation.on("state", (state) => {
    if (state === SimulationStates.RUNNING) {
      uiControls.setRunState("running");
    } else if (state === SimulationStates.PAUSED) {
      uiControls.setRunState("paused");
    } else {
      uiControls.setRunState("idle");
    }
  });

  simulation.on("start", () => {
    vehicleEngine.start();
  });

  simulation.on("pause", () => {
    vehicleEngine.pause();
  });

  simulation.on("resume", () => {
    vehicleEngine.resume();
  });

  simulation.on("stop", () => {
    vehicleEngine.stop(!preserveVehiclesOnStop);
    interactions.disable();
    preserveVehiclesOnStop = false;
  });

  async function ensureOverlay() {
    if (overlayBuilt && overlayManager.hasSegments()) {
      return true;
    }
    try {
      uiControls.showToast("Loading roads for simulation.");
      await overlayManager.buildOverlay();
      overlayBuilt = true;
      uiControls.showToast("Road overlay ready - click to add vehicles");
      return true;
    } catch (error) {
      logger.error("Failed to build overlay", error);
      const details = error?.message ? ` (${error.message})` : "";
      uiControls.showToast(`Unable to load roads${details}`);
      return false;
    }
  }

  async function handleRunToggle() {
    if (simulation.isRunning()) {
      simulation.pause();
      return;
    }
    if (simulation.isPaused()) {
      simulation.resume();
      return;
    }
    const withinThreshold = mapViewer.isWithinInteractionThreshold();
    if (!withinThreshold) {
      uiControls.showOverlayMessage(true);
      uiControls.showToast("Zoom in closer to start the simulation");
      return;
    }
    const overlayReady = await ensureOverlay();
    if (!overlayReady) return;
    mapViewer.freeze();
    interactions.enable();
    simulation.start();
  }

  function handleStop() {
    if (simulation.state === SimulationStates.IDLE) return;
    simulation.stop();
    uiControls.showToast("Simulation stopped");
  }

  window.addEventListener("beforeunload", () => {
    simulation.stop();
  });
}

if (window.L) {
  initializeApp();
} else {
  const onLeafletReady = () => {
    document.removeEventListener("leaflet-ready", onLeafletReady);
    initializeApp();
  };
  document.addEventListener("leaflet-ready", onLeafletReady);
  timeoutId = window.setTimeout(() => {
    if (!window.L) {
      logger.error("Leaflet failed to load before timeout");
      showStartupError("Map engine did not load. Allow access to unpkg.com or reload to use the local fallback.");
    } else {
      initializeApp();
    }
  }, LEAFLET_TIMEOUT_MS);
}