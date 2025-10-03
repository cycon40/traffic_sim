# Traffic Simulation Application

An interactive traffic simulation that renders real‑world road geometry (from OpenStreetMap via Overpass) and lets you inject vehicles, place road blocks, and observe routing behavior — all in the browser, via a lightweight Python server.

## Key Features

- Data‑driven road overlay
  - Fetches current road segments from the Overpass API for the visible map extent when you start a run.
  - Pastel‑tinted polylines for motorways, trunks, primaries, and local roads for good contrast with markers.
- Map experience that stays interactive
  - Left‑drag panning is always enabled; scroll/keyboard zoom is temporarily limited during a run.
  - A deep‑blue double boundary ring shows the “valid zoom” radius. It’s visible when idle and hides while the overlay is being built or a run is active.
- Vehicles that look and move like vehicles
  - Supported types: car, van, truck, semi‑truck. Bikes and motorcycles are intentionally excluded.
  - Semi‑trucks spawn only on high‑class roads (motorway/trunk/primary).
  - SVG silhouettes (sedan/van/box‑truck/semi) rotate to face the direction of travel; colors are chosen to read over a light base map.
- Smart routing and block handling
  - Right‑click places a red cross‑bar exactly under the cursor, perpendicular to the road.
  - Vehicles anticipate blocks and make U‑turns at the nearest intersection before reaching the barrier.
  - If no alternate route exists at a node, vehicles visibly pause (“blocked”) instead of teleporting.
- Controls that encourage experimentation
  - Run/Resume/Pause/Stop lifecycle with toast feedback.
  - Stop returns the app to a pre‑run state: removes vehicles and overlays, shows the boundary ring again, and unfreezes the map.
  - Car Count input determines vehicles spawned per left‑click.
  - Speed controls:
    - Global modes: Cruise, Rush, and Zoom‑Sync (adapts to zoom level).
    - Per‑type speed inputs (mph, up to 70) adjust average speeds live. Default averages are boosted by 20% to keep the sim engaging.
  - Legend with icons and a short how‑to.

## Getting Started

### Requirements

- Python 3.11+
- No third‑party Python packages required.

### Running the application

```bash
python -m app.main
# or
python run.py
```

This starts a local development server at `http://127.0.0.1:5000/` using Python’s built‑in WSGI utilities.

### Usage Tips

1. Pan/zoom to your area of interest. A deep‑blue ring indicates the valid zoom radius; when the zoom indicator turns green, you’re ready to run.
2. Click Run to build the road overlay for the current viewport.
3. Left‑click a highlighted road to add vehicles; use the Car Count box to control the quantity.
4. Right‑click a road to place a red, perpendicular block exactly under the cursor.
5. Use the per‑type speed boxes (mph, capped at 70) to tune average speeds on the fly; try the Speed button (Cruise/Rush/Zoom‑Sync) to adjust the overall pace.
6. Click Pause/Resume to temporarily stop/resume movement.
7. Click Stop to clear all overlays and vehicles, unfreeze the map, and show the boundary ring again.

> Road data is retrieved from the public Overpass API; ensure you have an active internet connection when starting a run.

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
      vehicleShapes.js
      uiControls.js
      utils/
        geoUtils.js
        logger.js
run.py
README.md
```

## Configuration

Vehicle types, colors, and baseline speeds are configured in `app/static/config/vehicleTypes.json`.

- Allowed types: `car`, `van`, `truck`, `semi_truck` (others are ignored by the app).
- Default average speeds are increased by 20% at load time; you can further adjust per‑type speeds in the UI.

## Controls at a Glance

- Left‑drag: pan the map (always enabled)
- Mouse wheel / +/- keys: zoom (limited during Run)
- Left‑click road: add vehicles
- Right‑click road: place a red block perpendicular to the road
- Run / Pause / Resume / Stop: simulation lifecycle
- Car Count: vehicles per click
- Speed: cycle Cruise → Rush → Zoom‑Sync
- Per‑type Speed (mph): adjust Car, Van, Truck, Semi speeds (capped at 70 mph)

## Real‑Life Use Cases

- Traffic Planning and Simulation:
  - Urban Planning: City planners could use it to simulate traffic flow in different scenarios, helping them decide where to place new roads, traffic lights, or other infrastructure.
  - Event Planning: It could be used to model how traffic will behave during large events, like concerts or sports games, to optimize traffic control and parking arrangements.

- Educational Tool:
  - Teaching Aid: This could serve as a great educational tool for students studying urban planning, civil engineering, or transportation logistics, giving them a hands‑on way to visualize and experiment with traffic patterns.

- Emergency Management:
  - Disaster Response: Emergency services could simulate evacuation routes or the impact of road closures, helping them plan for natural disasters or other emergencies.

- Simulation and Entertainment:
  - Traffic Simulation Games: It could even be turned into a simple game where users create and manage traffic in a virtual city, seeing how different changes affect the flow of vehicles.

### Summary of Use Cases

| Use Case | Description |
| --- | --- |
| Urban Planning | Simulate and optimize city traffic patterns and infrastructure. |
| Event Traffic Control | Plan for large events by modeling traffic flow and parking. |
| Educational Tool | Help students learn about traffic engineering and urban planning. |
| Emergency Planning | Model evacuation routes and emergency responses. |
| Simulation Games | Create a fun and educational traffic management game. |

In summary, this application is versatile — from practical urban planning and emergency management to education and entertainment.

## License

GNU

