import { logger } from "./utils/logger.js";

const STATES = {
  IDLE: "idle",
  RUNNING: "running",
  PAUSED: "paused",
  STOPPED: "stopped",
};

export class SimulationController {
  constructor() {
    this.state = STATES.IDLE;
    this.listeners = new Map();
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
  }

  emit(event, payload) {
    this.listeners.get(event)?.forEach((callback) => callback(payload));
  }

  setState(nextState) {
    if (this.state === nextState) return;
    logger.debug(`state transition ${this.state} → ${nextState}`);
    this.state = nextState;
    this.emit("state", nextState);
  }

  start() {
    this.setState(STATES.RUNNING);
    this.emit("start");
  }

  pause() {
    this.setState(STATES.PAUSED);
    this.emit("pause");
  }

  resume() {
    this.setState(STATES.RUNNING);
    this.emit("resume");
  }

  stop() {
    this.setState(STATES.STOPPED);
    this.emit("stop");
  }

  reset() {
    this.setState(STATES.IDLE);
    this.emit("reset");
  }

  isRunning() {
    return this.state === STATES.RUNNING;
  }

  isIdle() {
    return this.state === STATES.IDLE;
  }

  isPaused() {
    return this.state === STATES.PAUSED;
  }
}

export { STATES as SimulationStates };
