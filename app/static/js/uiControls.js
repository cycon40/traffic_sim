import { logger } from "./utils/logger.js";

export class UIControls {
  constructor({ onRunToggle, onStop, onCarCountChange }) {
    this.runButton = document.getElementById("run-toggle");
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

    this.runButton.addEventListener("click", () => onRunToggle());
    this.stopButton.addEventListener("click", () => onStop());
    this.carInput.addEventListener("change", () => {
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

  showOverlayMessage(show) {
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
    legend.innerHTML = "";
    const title = document.createElement("div");
    title.className = "legend-title";
    title.textContent = "Vehicle Types";
    legend.appendChild(title);
    vehicleTypes.forEach((type) => {
      const row = document.createElement("div");
      row.className = "legend-item";
      const chip = document.createElement("span");
      chip.className = "legend-chip";
      chip.style.backgroundColor = type.color;
      const label = document.createElement("span");
      label.textContent = `${type.name} - avg ${Math.round(type.avgSpeedMps / 0.44704)} mph`;
      row.appendChild(chip);
      row.appendChild(label);
      legend.appendChild(row);
    });
  }
}