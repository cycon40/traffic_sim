import { logger } from "./utils/logger.js";
import { distancePointToPolyline } from "./utils/geoUtils.js";

const HIGHWAY_CLASSES = [
  "motorway",
  "trunk",
  "primary",
  "secondary",
  "tertiary",
  "residential",
  "living_street",
  "service",
];

const STYLES = {
  motorway: { color: "#e2e8f0", weight: 8 },
  trunk: { color: "#cbd5f5", weight: 7 },
  primary: { color: "#aebbf5", weight: 6 },
  secondary: { color: "#8fa5f5", weight: 5 },
  tertiary: { color: "#7c93f5", weight: 4 },
  residential: { color: "#64748b", weight: 3.5 },
  living_street: { color: "#475569", weight: 3 },
  service: { color: "#475569", weight: 3 },
  default: { color: "#64748b", weight: 3 },
};

function getStyle(highway) {
  return STYLES[highway] || STYLES.default;
}

export class OverlayManager {
  constructor(map) {
    this.map = map;
    this.segments = new Map();
    this.blocks = new Map();
    this.blockedSegments = new Set();
    this.highlighted = null;
    this.adjacency = new Map();
  }

  hasSegments() {
    return this.segments.size > 0;
  }

  async buildOverlay() {
    const bounds = this.map.getBounds();
    const bbox = `${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()}`;
    const query = `[
      out:json;
      way["highway"](${bbox});
      (._;>;);
      out;`;
    const endpoint = "https://overpass-api.de/api/interpreter";

    logger.info("Requesting overlay", bbox);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ data: query }),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch overlay: ${response.status}`);
    }

    const data = await response.json();
    this.ingestOverpassData(data);
    this.renderSegments();
  }

  ingestOverpassData(data) {
    const nodes = new Map();
    data.elements
      .filter((el) => el.type === "node")
      .forEach((node) => nodes.set(node.id, { lat: node.lat, lng: node.lon }));

    const segmentEntries = [];

    data.elements
      .filter((el) => el.type === "way" && HIGHWAY_CLASSES.includes(el.tags.highway))
      .forEach((way) => {
        const latlngs = way.nodes
          .map((nodeId) => nodes.get(nodeId))
          .filter(Boolean);
        if (latlngs.length < 2) {
          return;
        }
        const id = String(way.id);
        const style = getStyle(way.tags.highway);
        const cumulativeLengths = [0];
        for (let i = 1; i < latlngs.length; i += 1) {
          const prev = latlngs[i - 1];
          const curr = latlngs[i];
          const length = this.map.distance(prev, curr);
          cumulativeLengths.push(cumulativeLengths[i - 1] + length);
        }
        const polyline = L.polyline(latlngs, {
          color: style.color,
          weight: style.weight,
          opacity: 0.85,
          pane: "overlayPane",
          interactive: false,
        });
        this.segments.set(id, {
          id,
          highway: way.tags.highway,
          latlngs,
          polyline,
          screenPoints: [],
          baseStyle: style,
          cumulativeLengths,
          totalLength: cumulativeLengths[cumulativeLengths.length - 1] ?? 0,
        });
        segmentEntries.push(this.segments.get(id));
      });

    this.buildGraph(segmentEntries);
  }

  buildGraph(segments) {
    this.adjacency.clear();
    segments.forEach((segment) => {
      const start = segment.latlngs[0];
      const end = segment.latlngs[segment.latlngs.length - 1];
      const startKey = this.nodeKey(start);
      const endKey = this.nodeKey(end);
      segment.terminals = { startKey, endKey };

      if (!this.adjacency.has(startKey)) this.adjacency.set(startKey, []);
      if (!this.adjacency.has(endKey)) this.adjacency.set(endKey, []);
      this.adjacency.get(startKey).push({ segmentId: segment.id, direction: 1 });
      this.adjacency.get(endKey).push({ segmentId: segment.id, direction: -1 });
    });
  }

  nodeKey({ lat, lng }) {
    return `${lat.toFixed(5)}|${lng.toFixed(5)}`;
  }

  renderSegments() {
    this.layerGroup?.remove();
    this.layerGroup = L.layerGroup();
    this.segments.forEach((segment) => {
      segment.polyline.addTo(this.layerGroup);
    });
    this.layerGroup.addTo(this.map);
    this.updateScreenPoints();
  }

  updateScreenPoints() {
    this.segments.forEach((segment) => {
      segment.screenPoints = segment.latlngs.map((latlng) =>
        this.map.latLngToContainerPoint(latlng)
      );
    });
  }

  highlightSegment(segmentId) {
    if (this.highlighted && this.highlighted !== segmentId) {
      const existing = this.segments.get(this.highlighted);
      if (existing) {
        existing.polyline.setStyle({
          weight: existing.baseStyle.weight,
          opacity: 0.85,
        });
      }
    }
    if (!segmentId) {
      if (this.highlighted) {
        const existing = this.segments.get(this.highlighted);
        if (existing) {
          existing.polyline.setStyle({
            weight: existing.baseStyle.weight,
            opacity: 0.85,
          });
        }
      }
      this.highlighted = null;
      return;
    }
    const segment = this.segments.get(segmentId);
    if (!segment) return;
    segment.polyline.setStyle({
      weight: segment.baseStyle.weight + 2,
      opacity: 1,
    });
    this.highlighted = segmentId;
  }

  addBlock(segmentId) {
    const segment = this.segments.get(segmentId);
    if (!segment) return null;
    const blockId = `${segmentId}-${Date.now()}`;
    const bounds = L.latLngBounds(segment.latlngs);
    const block = L.rectangle(bounds, {
      className: "block-overlay",
      interactive: false,
    }).addTo(this.map);
    this.blocks.set(blockId, { segmentId, block });
    this.blockedSegments.add(segmentId);
    return blockId;
  }

  clearBlocks() {
    this.blocks.forEach(({ block }) => block.remove());
    this.blocks.clear();
    this.blockedSegments.clear();
  }

  clear() {
    this.layerGroup?.remove();
    this.layerGroup = null;
    this.segments.clear();
    this.clearBlocks();
    this.adjacency.clear();
  }

  isSegmentBlocked(segmentId) {
    return this.blockedSegments.has(segmentId);
  }

  getSegment(segmentId) {
    return this.segments.get(segmentId);
  }

  getConnectedSegments(nodeKey, excludeId) {
    const options = this.adjacency.get(nodeKey);
    if (!options) return [];
    return options.filter((entry) => entry.segmentId !== excludeId);
  }

  findNearestSegment(point) {
    this.updateScreenPoints();
    let best = null;
    let minDist = Infinity;
    this.segments.forEach((segment) => {
      if (segment.screenPoints.length < 2) return;
      const result = distancePointToPolyline(point, segment.screenPoints);
      if (result.distance < minDist) {
        minDist = result.distance;
        best = { segment, result };
      }
    });
    return best && { segment: best.segment, ...best.result, distance: minDist };
  }
}
