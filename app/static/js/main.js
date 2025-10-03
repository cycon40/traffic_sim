import { MapViewer } from "./mapViewer.js";
import { OverlayManager } from "./overlayManager.js";
import { VehicleConfig } from "./vehicleConfig.js";
import { UIControls } from "./uiControls.js";
import { SimulationController, SimulationStates } from "./simController.js";
import { VehicleEngine } from "./vehicleEngine.js";
import { InteractionHandler } from "./interactionHandler.js";
import { logger } from "./utils/logger.js";

const LEAFLET_TIMEOUT_MS = 4000;
const SPEED_MODES = [
  { id: "normal", label: "Cruise", kind: "fixed", multiplier: 1 },
  { id: "fast", label: "Rush", kind: "fixed", multiplier: 1.7 },
  { id: "zoom-sync", label: "Zoom Sync", kind: "dynamic", baseMultiplier: 1.15, min: 0.9, max: 3.2 },
];

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
  let speedModeIndex = 0;

  const uiControls = new UIControls({
    onRunToggle: () => handleRunToggle(),
    onStop: () => handleStop(),
    onCarCountChange: (value) => interactions?.setCarCount(value),
    onSpeedModeToggle: () => handleSpeedModeToggle(),
  });

  const vehicleEngine = new VehicleEngine(mapViewer, overlayManager, vehicleConfig);
  interactions = new InteractionHandler(mapViewer, overlayManager, vehicleEngine, uiControls);

  applySpeedMode(SPEED_MODES[speedModeIndex]);

  vehicleConfig.ready.then(() => {
    uiControls.renderLegend(Array.from(vehicleConfig.getTypes().values()));
    uiControls.setSpeedMode(SPEED_MODES[speedModeIndex], vehicleEngine.getCurrentSpeedMultiplier());
  });

  mapViewer.onZoomChange((radius) => {
    if (overlayManager.hasSegments()) {
      overlayManager.updateScreenPoints();
    }
    uiControls.updateZoomIndicator(radius, thresholdMiles);
    const shouldShow = radius > thresholdMiles && (simulation.isIdle() || simulation.state === SimulationStates.STOPPED);
    uiControls.showOverlayMessage(shouldShow);
    const showBoundary = !overlayBuilt && (simulation.isIdle() || simulation.state === SimulationStates.STOPPED);
    mapViewer.showBoundary(showBoundary);
    if (vehicleEngine.isDynamicSpeed()) {
      uiControls.setSpeedMode(SPEED_MODES[speedModeIndex], vehicleEngine.getCurrentSpeedMultiplier());
    }
  });

  // Trigger an initial indicator update before the first interaction.
  uiControls.updateZoomIndicator(mapViewer.getVisibleRadiusMiles(), thresholdMiles);
  uiControls.showOverlayMessage(!mapViewer.isWithinInteractionThreshold());
  mapViewer.showBoundary(true);
  uiControls.setSpeedMode(SPEED_MODES[speedModeIndex], vehicleEngine.getCurrentSpeedMultiplier());

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
    mapViewer.showBoundary(false);
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
    mapViewer.showBoundary(!overlayBuilt);
  });

  async function ensureOverlay() {
    if (overlayBuilt && overlayManager.hasSegments()) {
      return true;
    }
    try {
      uiControls.showToast("Loading roads for simulation.");
      mapViewer.showBoundary(false);
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

  function applySpeedMode(mode) {
    vehicleEngine.setSpeedMode(mode);
    uiControls.setSpeedMode(mode, vehicleEngine.getCurrentSpeedMultiplier());
  }

  function handleSpeedModeToggle() {
    speedModeIndex = (speedModeIndex + 1) % SPEED_MODES.length;
    const mode = SPEED_MODES[speedModeIndex];
    applySpeedMode(mode);
    if (mode.kind === "dynamic") {
      uiControls.showToast("Speed now adapts to your zoom level");
    } else if (mode.id === "fast") {
      uiControls.showToast("Vehicles boosted - hang on!");
    }
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




