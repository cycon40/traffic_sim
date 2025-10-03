import { logger } from "./utils/logger.js";

const DEFAULT_TYPE_METADATA = {
  car: { displayName: "Car", shape: "sedan", legend: "Sedan" },
  van: { displayName: "Van", shape: "van", legend: "Van" },
  truck: { displayName: "Truck", shape: "truck", legend: "Truck" },
  semi_truck: { displayName: "Semi-Truck", shape: "semi", legend: "Semi" },
};

const ALLOWED_SHAPES = new Set(["sedan", "van", "truck", "semi", "default"]);

function normalizeShape(shape, fallback) {
  const candidate = (shape || fallback || "default").toLowerCase();
  return ALLOWED_SHAPES.has(candidate) ? candidate : "default";
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
      // Only allow car/van/truck/semi_truck explicitly
      const allowed = new Set(["car", "van", "truck", "semi_truck"]);
      Object.entries(data.vehicle_types || {})
        .filter(([name]) => allowed.has(name))
        .forEach(([name, value]) => {
          const metadata = DEFAULT_TYPE_METADATA[name] || {};
          const displayName = value.display_name || metadata.displayName || toDisplayName(name);
          const shape = normalizeShape(value.shape, metadata.shape);
          const legend = value.shape_label || metadata.legend || `${displayName} marker`;
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
        ["car", { name: "car", displayName: "Car", color: "#0ea5a6", shape: "sedan", shapeLabel: "Sedan", avgSpeedMps: 30 * 0.44704, maxSpeedMps: 65 * 0.44704 }],
        ["van", { name: "van", displayName: "Van", color: "#a78bfa", shape: "van", shapeLabel: "Van", avgSpeedMps: 28 * 0.44704, maxSpeedMps: 65 * 0.44704 }],
        ["truck", { name: "truck", displayName: "Truck", color: "#f59e0b", shape: "truck", shapeLabel: "Truck", avgSpeedMps: 24 * 0.44704, maxSpeedMps: 60 * 0.44704 }],
        ["semi_truck", { name: "semi_truck", displayName: "Semi-Truck", color: "#f472b6", shape: "semi", shapeLabel: "Semi", avgSpeedMps: 22 * 0.44704, maxSpeedMps: 65 * 0.44704 }],
      ]);
      this.types = fallback;
      return fallback;
    }
  }

  getTypes() {
    return this.types;
  }
}
