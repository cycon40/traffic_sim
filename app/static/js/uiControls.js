import { logger } from "./utils/logger.js";

function formatMultiplier(value) {
  if (!Number.isFinite(value)) return "x1.0";
  const rounded = Math.round(value * 10) / 10;
  return `x${rounded.toFixed(1)}`;
}

export class UIControls {
  constructor({ onRunToggle, onStop, onCarCountChange, onSpeedModeToggle }) {
    this.runButton = document.getElementById("run-toggle");
    this.speedButton = document.getElementById("speed-mode");
    this.stopButton = document.getElementById("stop");
    this.carInput = document.getElementById("car-count");
    this.toast = document.getElementById("toast");
    this.overlayMessage = document.getElementById("overlay-message");
    this.zoomStatus = document.getElementById("zoom-status");

    this.runState = "idle";

    if (this.zoomStatus) {
      this.zoomStatus.textContent = "Zoom radius: pending";
      this.zoomStatus.removeAttribute("data-status");
    }

    this.runButton?.addEventListener("click", () => onRunToggle());
    this.speedButton?.addEventListener("click", () => onSpeedModeToggle());
    this.stopButton?.addEventListener("click", () => onStop());
    this.carInput?.addEventListener("change", () => {
      const value = Math.max(1, Math.floor(Number(this.carInput.value) || 1));
      this.carInput.value = value;
      onCarCountChange(value);
    });

    document.addEventListener("keydown", (event) => {
      if (event.code === "Space" && document.activeElement === this.runButton) {
        event.preventDefault();
        onRunToggle();
      }
      if (event.code === "Enter" && document.activeElement === this.stopButton) {
        onStop();
      }
    });
  }

  setRunState(state) {
    this.runState = state;
    if (state === "running") {
      this.runButton.textContent = "Pause";
      this.stopButton.classList.add("active");
    } else if (state === "paused") {
      this.runButton.textContent = "Resume";
      this.stopButton.classList.add("active");
    } else {
      this.runButton.textContent = "Run";
      this.stopButton.classList.remove("active");
    }
  }

  setSpeedMode(mode, multiplier) {
    if (!this.speedButton || !mode) return;
    const factor = formatMultiplier(multiplier ?? mode.multiplier ?? 1);
    this.speedButton.textContent = `Speed: ${mode.label} (${factor})`;
    this.speedButton.dataset.mode = mode.id;
    this.speedButton.setAttribute("aria-label", `Switch speed mode. Current mode ${mode.label} ${factor}`);
  }

  showOverlayMessage(show) {
    if (!this.overlayMessage) return;
    this.overlayMessage.hidden = !show;
  }

  updateZoomIndicator(radius, threshold) {
    if (!this.zoomStatus) return;
    if (!Number.isFinite(radius)) {
      this.zoomStatus.textContent = "Zoom radius: n/a";
      this.zoomStatus.removeAttribute("data-status");
      return;
    }
    const radiusText = radius.toFixed(1);
    const thresholdText = threshold.toFixed(1);
    if (radius <= threshold) {
      this.zoomStatus.textContent = `Zoom radius: ${radiusText} mi (ready, threshold ${thresholdText} mi)`;
      this.zoomStatus.dataset.status = "ready";
    } else {
      const delta = Math.max(radius - threshold, 0);
      const deltaText = delta.toFixed(1);
      this.zoomStatus.textContent = `Zoom radius: ${radiusText} mi (zoom in ~${deltaText} mi)`;
      this.zoomStatus.dataset.status = "needs-zoom";
    }
  }

  showToast(message) {
    if (!this.toast) return;
    logger.info("toast", message);
    this.toast.textContent = message;
    this.toast.hidden = false;
    this.toast.classList.add("toast-visible");
    clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      this.toast.hidden = true;
      this.toast.classList.remove("toast-visible");
    }, 2800);
  }

  renderLegend(vehicleTypes) {
    const legend = document.getElementById("legend");
    if (!legend) return;
    legend.innerHTML = "";

    const title = document.createElement("div");
    title.className = "legend-title";
    title.textContent = "Roadside Guide";
    legend.appendChild(title);

    const vehicleSubtitle = document.createElement("div");
    vehicleSubtitle.className = "legend-subtitle";
    vehicleSubtitle.textContent = "Vehicle Markers";
    legend.appendChild(vehicleSubtitle);

    vehicleTypes.forEach((type) => {
      const row = document.createElement("div");
      row.className = "legend-item";

      const shape = document.createElement("span");
      shape.className = `legend-shape shape-${type.shape || "circle"}`;
      shape.style.setProperty("--vehicle-color", type.color);

      const label = document.createElement("span");
      const mph = Math.round((type.avgSpeedMps || 0) / 0.44704);
      const descriptor = type.shapeLabel || type.shape || "marker";
      label.textContent = `${type.displayName} · ${descriptor} · ~${mph} mph`;

      row.appendChild(shape);
      row.appendChild(label);
      legend.appendChild(row);
    });

    const howSubtitle = document.createElement("div");
    howSubtitle.className = "legend-subtitle";
    howSubtitle.textContent = "How to Play";
    legend.appendChild(howSubtitle);

    const instructions = document.createElement("ul");
    instructions.className = "legend-instructions";
    instructions.innerHTML = [
      "Zoom until the radius indicator turns green.",
      "Left click a highlighted road to deploy the selected vehicles.",
      "Right click a road to drop a block and stop traffic.",
      "Use the Speed button to match the pace to your zoom.",
    ]
      .map((step) => `<li>${step}</li>`)
      .join("");
    legend.appendChild(instructions);
  }
}
