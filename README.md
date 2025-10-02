# Traffic Simulation Application

An interactive traffic simulation prototype that overlays real-world road geometry on an OpenStreetMap base layer. Users can inject vehicles, place roadblocks, and control the simulation lifecycle entirely from the browser while a lightweight Python server delivers the single-page experience.

## Features

- **Dynamic overlay** – Real road segments are requested from the Overpass API when the simulation starts and only when the user is sufficiently zoomed in.
- **Precise interactions** – Left-click to spawn configurable numbers of vehicles, right-click to drop full-blocking barriers on the highlighted segment.
- **Vehicle behaviours** – Vehicles inherit color and speed from a JSON configuration file, traverse connected roads, and exit the simulation when they leave the viewport.
- **Automatic halting** – The simulation pauses automatically when all vehicles have exited or every car is blocked behind road barriers.
- **Responsive UI** – Run/Resume, Pause, and Stop controls keep the map viewport frozen during simulation and provide toast feedback for user actions.

## Getting Started

### Requirements

- Python 3.11+
- No third-party Python packages required.

### Running the application

```bash
python -m app.main
```

This starts a local development server at `http://127.0.0.1:5000/` using Python's built-in WSGI utilities.

### Running tests

```bash
pytest
```

### Usage Tips

1. Pan/zoom to your area of interest and zoom in until the on-screen prompt disappears (visible radius ≤ 5 miles).
2. Click **Run** to lock the viewport and load the current road network.
3. Left-click a highlighted segment to add vehicles; right-click to place a red block that stops traffic.
4. Use the car count input to control how many vehicles spawn per click.
5. Hit **Pause** to temporarily halt vehicle movement or **Stop** to end the run while keeping overlays visible.

> **Note:** Road data is retrieved from the public Overpass API; ensure you have an active internet connection when starting the simulation.

## Project Structure

```
app/
  __init__.py
  main.py
  templates/
    index.html
  static/
    css/styles.css
    config/vehicleTypes.json
    js/
      main.js
      mapViewer.js
      overlayManager.js
      interactionHandler.js
      simController.js
      vehicleConfig.js
      vehicleEngine.js
      uiControls.js
      utils/
        geoUtils.js
        logger.js
requirements.txt
README.md
```

## Configuration

Vehicle types, colors, and speeds are configured in `app/static/config/vehicleTypes.json`. Update or extend the entries to experiment with different fleets without touching the code.

## License

MIT
