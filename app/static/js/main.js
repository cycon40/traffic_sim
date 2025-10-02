import { MapViewer } from "./mapViewer.js";
import { OverlayManager } from "./overlayManager.js";
import { VehicleConfig } from "./vehicleConfig.js";
import { UIControls } from "./uiControls.js";
import { SimulationController, SimulationStates } from "./simController.js";
import { VehicleEngine } from "./vehicleEngine.js";
import { InteractionHandler } from "./interactionHandler.js";
import { logger } from "./utils/logger.js";

const mapViewer = new MapViewer();
const overlayManager = new OverlayManager(mapViewer.map);
const vehicleConfig = new VehicleConfig();
const simulation = new SimulationController();
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
  const showMessage = radius > 5 && (simulation.isIdle() || simulation.state === SimulationStates.STOPPED);
  uiControls.showOverlayMessage(showMessage);
});

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
    uiControls.showToast("Traffic jam detected — simulation halted");
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

uiControls.showOverlayMessage(!mapViewer.isWithinInteractionThreshold());

async function ensureOverlay() {
  if (overlayBuilt && overlayManager.hasSegments()) {
    return true;
  }
  try {
    uiControls.showToast("Loading roads for simulation…");
    await overlayManager.buildOverlay();
    overlayBuilt = true;
    uiControls.showToast("Road overlay ready — click to add vehicles");
    return true;
  } catch (error) {
    logger.error("Failed to build overlay", error);
    uiControls.showToast("Unable to load roads — try again");
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
