import { logger } from "./utils/logger.js";

const DEFAULT_TYPE_METADATA = {
  car: {
    displayName: "Car",
    shape: "triangle",
    legend: "Triangle nose-forward",
  },
  truck: {
    displayName: "Van",
    shape: "rectangle",
    legend: "Rectangular hauler",
  },
  bike: {
    displayName: "Bike",
    shape: "diamond",
    legend: "Diamond runner",
  },
};

const ALLOWED_SHAPES = new Set(["triangle", "rectangle", "diamond", "circle"]);

function normalizeShape(shape, fallback) {
  const candidate = (shape || fallback || "circle").toLowerCase();
  return ALLOWED_SHAPES.has(candidate) ? candidate : "circle";
}

function toDisplayName(name) {
  if (!name) return "Vehicle";
  return name.charAt(0).toUpperCase() + name.slice(1);
}

async function fetchConfig() {
  const response = await fetch("/static/config/vehicleTypes.json");
  if (!response.ok) {
    throw new Error(`Unable to load vehicle config (${response.status})`);
  }
  return response.json();
}

export class VehicleConfig {
  constructor() {
    this.types = new Map();
    this.ready = this.load();
  }

  async load() {
    try {
      const data = await fetchConfig();
      Object.entries(data.vehicle_types || {}).forEach(([name, value]) => {
        const metadata = DEFAULT_TYPE_METADATA[name] || {};
        const displayName = value.display_name || metadata.displayName || toDisplayName(name);
        const shape = normalizeShape(value.shape, metadata.shape);
        const legend = value.shape_label || metadata.legend || `${shape} marker`;
        this.types.set(name, {
          name,
          displayName,
          color: value.color,
          shape,
          shapeLabel: legend,
          avgSpeedMps: (value.avg_speed_mph || 25) * 0.44704,
          maxSpeedMps: (value.max_speed_mph || value.avg_speed_mph || 35) * 0.44704,
        });
      });
      if (!this.types.size) {
        throw new Error("Vehicle config empty");
      }
      return this.types;
    } catch (error) {
      logger.error("Failed to load vehicle config", error);
      const fallback = new Map([
        [
          "car",
          {
            name: "car",
            displayName: "Car",
            color: "#3A7AFE",
            shape: "triangle",
            shapeLabel: "Triangle nose-forward",
            avgSpeedMps: 30 * 0.44704,
            maxSpeedMps: 65 * 0.44704,
          },
        ],
      ]);
      this.types = fallback;
      return fallback;
    }
  }

  getTypes() {
    return this.types;
  }
}
