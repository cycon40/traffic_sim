import { logger } from "./utils/logger.js";

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
        this.types.set(name, {
          name,
          color: value.color,
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
          { name: "car", color: "#3A7AFE", avgSpeedMps: 30 * 0.44704, maxSpeedMps: 65 * 0.44704 },
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
