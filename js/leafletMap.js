class LeafletMap {
  constructor(_config, _data) {
    this.config = {
      parentElement: _config.parentElement,
      ..._config
    };
    this.data = _data;
    this.legend = null;
    this.selectionLegend = null;
    this.isSelectionMode = true;
    this.selectedEvent = null;
    this.originalColors = new Map();
    this.initVis();
  }

  initVis() {
    const vis = this;
    vis.esriImagery = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, ...' }
    );
    vis.osmStandard = L.tileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      { attribution: '&copy; OpenStreetMap contributors' }
    );
    vis.cartoPositron = L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      { attribution: '&copy; OpenStreetMap &copy; CartoDB' }
    );
    vis.cartoDark = L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      { attribution: '&copy; OpenStreetMap &copy; CartoDB' }
    );
    vis.esriTopo = L.tileLayer(
      'https://services.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
      { attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ, USGS, Intermap...' }
    );

    // (2) Initialize the map
    vis.map = L.map(vis.config.parentElement.substring(1), {
      center: [20, 0],
      zoom: 2,
      layers: [vis.esriImagery]
    });

    // (3) Add layer control
    const baseMaps = {
      'ESRI Imagery': vis.esriImagery,
      'OpenStreetMap': vis.osmStandard,
      'Carto Positron': vis.cartoPositron,
      'Carto Dark': vis.cartoDark,
      'ESRI Topo': vis.esriTopo
    };
    L.control.layers(baseMaps).addTo(vis.map);

    // (4) Add D3 overlay
    L.svg({ clickable: true }).addTo(vis.map);
    vis.overlay = d3.select(vis.map.getPanes().overlayPane);
    vis.svg = vis.overlay.select('svg').attr('pointer-events', 'auto');

    // (5) Create scales for quake circles
    const magExtent = d3.extent(vis.data, d => d.mag);
    vis.colorScale = d3.scaleSequential(d3.interpolateReds).domain(magExtent);
    vis.radiusScale = d3.scaleLinear().domain(magExtent).range([2, 10]);

    // (6) Plot quake circles with click handler for selection
    vis.circles = vis.svg.selectAll('circle')
      .data(vis.data)
      .join('circle')
      .attr('stroke', 'black')
      .attr('fill', d => vis.colorScale(d.mag))
      .attr('r', d => vis.radiusScale(d.mag))
      .attr('cx', d => vis.project(d).x)
      .attr('cy', d => vis.project(d).y)
      .on('mouseover', (event, d) => {
        d3.select('#tooltip')
          .style('opacity', 1)
          .html(`
            <b>Location:</b> ${d.place || 'Unknown'}<br>
            <b>Magnitude:</b> ${d.mag}<br>
            <b>Depth:</b> ${d.depth} km <br>
            <b>Date/Time:</b> ${d.time.toLocaleDateString()} ${d.time.toLocaleTimeString()}<br>
          `);
      })
      .on('mousemove', (event) => {
        d3.select('#tooltip')
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY + 10) + 'px');
      })
      .on('mouseleave', () => {
        d3.select('#tooltip').style('opacity', 0);
      })
      .on('click', function(event, d) {
        if (vis.isSelectionMode) {
          vis.handleEventSelection(d);
        }
      });

    // (7) Store original colors for resetting later
    vis.data.forEach(d => {
      vis.originalColors.set(d, vis.colorScale(d.mag));
    });

    // Brush group
    vis.brushGroup = vis.svg.append("g").attr("class", "brush");

    // Define brush
    vis.brush = d3.brush()
      .extent([[0, 0], [vis.svg.node().clientWidth, vis.svg.node().clientHeight]])
      .on("start", () => d3.selectAll("circle").classed("selected", false))
      .on("brush", ({ selection }) => {
        if (!selection) return;
    
        const [[x0, y0], [x1, y1]] = selection;
        
        vis.circles.classed("selected", d => {
          const x = vis.project(d).x;
          const y = vis.project(d).y;
          return x0 <= x && x <= x1 && y0 <= y && y <= y1;
        });
        const selectedData = vis.data.filter(d => {
          const projected = vis.project(d);
          return x0 <= projected.x && projected.x <= x1 && y0 <= projected.y && projected.y <= y1;
        });
    
        // Update visualizations with the selected earthquakes
        updateVisualizationsOnSelection(selectedData);
    })
    .on("end", ({ selection }) => {
        if (!selection) {
          d3.selectAll("circle").classed("selected", false);
          updateVisualizationsOnSelection(timeChunks[currentIndex].data);
        }
    });
    

    const toggleBrush = d3.select("#toggleBrush");

    // Function to enable/disable brushing
    toggleBrush.on("change", function () {
      if (this.checked) {
        vis.map.dragging.disable();
        vis.map.doubleClickZoom.disable();
        vis.map.scrollWheelZoom.disable();

        //enable brushing
        vis.brushGroup.call(vis.brush);
      } else {
        vis.map.dragging.enable();
        vis.map.doubleClickZoom.enable();
        vis.map.scrollWheelZoom.enable();

        // Clear existing brush selection and disable brushing
        vis.brushGroup.call(vis.brush.move, null);
        vis.brushGroup.on(".brush", null);
      }
    });

    // (8) Create the static magnitude legend (if needed)
    vis.legend = L.control({ position: 'bottomright' });
    vis.legend.onAdd = function(map) {
      const div = L.DomUtil.create('div', 'info legend');
      const [minMag, maxMag] = magExtent;
      const breaks = d3.ticks(minMag, maxMag, 6);
      breaks.forEach((b, i) => {
        const color = vis.colorScale(b);
        const nextVal = breaks[i + 1];
        if (i < breaks.length - 1) {
          div.innerHTML += `<i style="background:${color}"></i>${b.toFixed(1)} &ndash; ${nextVal.toFixed(1)}<br>`;
        } else {
          div.innerHTML += `<i style="background:${color}"></i>${b.toFixed(1)}+<br>`;
        }
      });
      return div;
    };
    vis.legend.addTo(vis.map);

    // Add info control
    vis.addInfoControl();

    // (9) When the map is zoomed or moved, update positions
    vis.map.on('zoomend moveend', () => vis.updateVis());
  }

  // Convert latitude/longitude to x/y using Leaflet's latLngToLayerPoint
  project(d) {
    return this.map.latLngToLayerPoint([d.latitude, d.longitude]);
  }

  // Called when a quake dot is clicked
  handleEventSelection(selectedEvent) {
    const vis = this;
  
    // If clicking the same quake again => deselect
    if (vis.selectedEvent === selectedEvent) {
      // 1) Reset highlights on the map
      vis.resetEventHighlights();
      // 2) Remove the selection legend
      vis.removeSelectionLegend();
      // 3) Clear the selection in other views
      updateLinkedSelections(null);
      // 4) Clear the timeline brush
      timeline.brushG.call(timeline.brush.move, null);
      return;
    }
  
    // Reset any previous selection first
    vis.resetEventHighlights();
  
    // Store the newly selected quake
    vis.selectedEvent = selectedEvent;
  
    // Highlight the selected quake in yellow
    vis.circles.filter(d => d === selectedEvent)
      .attr('fill', 'yellow')
      .attr('stroke', 'black')
      .attr('stroke-width', 2);
  
    // Highlight neighbors within 24 hours
    const selectedTime = selectedEvent.time.getTime();
    const dayInMs = 24 * 60 * 60 * 1000;
    vis.data.forEach(event => {
      const eventTime = event.time.getTime();
      const timeDiff = eventTime - selectedTime;
      if (event !== selectedEvent && Math.abs(timeDiff) <= dayInMs) {
        // Green if before, blue if after
        const color = timeDiff < 0 ? '#4CAF50' : '#2196F3';
        vis.circles.filter(d => d === event)
          .attr('fill', color)
          .attr('stroke', 'black')
          .attr('stroke-width', 1.5);
      }
    });
  
    // Show the selection legend
    vis.addSelectionLegend();
  
    // Suppose quakeTime is selectedEvent.time
    const quakeTime = selectedEvent.time.getTime();
    const dayMs = 24 * 60 * 60 * 1000;
    const startTime = quakeTime - dayMs;
    const endTime = quakeTime + dayMs;

    // 1) Check the timeline’s domain
    const [domainMin, domainMax] = timeline.xScale.domain(); 
    const domainMinT = domainMin.getTime();
    const domainMaxT = domainMax.getTime();

    // If the entire 24-hour window is outside the domain, skip the brush
    if (endTime < domainMinT || startTime > domainMaxT) {
      console.log('Quake is outside timeline domain; skipping timeline brush.');
      return; 
    }

    // 2) Otherwise clamp the start/end times so they don’t exceed the domain
    const clampedStart = Math.max(domainMinT, startTime);
    const clampedEnd   = Math.min(domainMaxT, endTime);

    // 3) Convert them back to Date objects
    const startDate = new Date(clampedStart);
    const endDate   = new Date(clampedEnd);

    // 4) Now call the timeline brush
    timeline.setBrushRange(startDate, endDate);
  }  

  // Remove all selection highlights and the selection legend
  resetEventHighlights() {
    const vis = this;
    vis.selectedEvent = null;
    vis.circles
      .attr('fill', d => vis.originalColors.get(d))
      .attr('stroke', 'black')
      .attr('stroke-width', 1);
    vis.removeSelectionLegend();
  }

  addSelectionLegend() {
    const vis = this;
  
    // If the selection legend is not already added, create it
    if (!vis.selectionLegend) {
      vis.selectionLegend = L.control({ position: 'bottomright' }); // bottom-right
      vis.selectionLegend.onAdd = function(map) {
        // Use the same class "info legend" for styling
        const div = L.DomUtil.create('div', 'info legend');
  
        div.innerHTML = `
          <strong>Selection Legend</strong><br>
          <i style="background: yellow"></i> Selected Event<br>
          <i style="background: #4CAF50"></i> 24 hrs Before<br>
          <i style="background: #2196F3"></i> 24 hrs After<br>
        `;
        return div;
      };
      vis.selectionLegend.addTo(vis.map);
    }
  }  

  removeSelectionLegend() {
    const vis = this;
    if (vis.selectionLegend) {
      vis.selectionLegend.remove();
      vis.selectionLegend = null;
    }
  }

  // Add info control to map
  addInfoControl() {
    const vis = this;

    // Create control container
    vis.infoControl = L.control({ position: 'topleft' });

    vis.infoControl.onAdd = function (map) {
      const container = L.DomUtil.create('div', 'info-container');

      // Info icon
      const infoIcon = L.DomUtil.create('div', 'info-control', container);
      infoIcon.innerHTML = 'i';

      // Info panel (hidden by default)
      const infoPanel = L.DomUtil.create('div', 'info-panel', container);
      infoPanel.innerHTML = `
          <h3>Map Instructions</h3>
          <ul>
              <li><strong>Click</strong> on an earthquake to select it</li>
              <li>Selected quake turns <strong class="text-yellow">yellow</strong></li>
              <li>Quakes within 24 hours before turn <strong class="text-green">green</strong></li>
              <li>Quakes within 24 hours after turn <strong class="text-blue">blue</strong></li>
              <li>Click the selected quake again to deselect</li>
              <li>Hover over any quake for details</li>
          </ul>
          <p>Use the layer control to change the base map.</p>
      `;

      return container;
    };

    vis.infoControl.addTo(vis.map);
  }

  updateVis() {
    const vis = this;
    const magExtent = d3.extent(vis.data, d => d.mag);
    vis.colorScale.domain(magExtent);
    vis.radiusScale.domain(magExtent);

    // Update original colors
    vis.data.forEach(d => {
      vis.originalColors.set(d, vis.colorScale(d.mag));
    });

    // Re-bind circles
    vis.circles = vis.svg.selectAll('circle')
      .data(vis.data)
      .join('circle')
      .attr('stroke', 'black')
      .attr('fill', d => {
        if (vis.isSelectionMode && vis.selectedEvent) {
          const selectedTime = vis.selectedEvent.time.getTime();
          const eventTime = d.time.getTime();
          const dayInMs = 24 * 60 * 60 * 1000;
          const diff = eventTime - selectedTime;
          if (d === vis.selectedEvent) return 'yellow';
          if (Math.abs(diff) <= dayInMs) return diff < 0 ? '#4CAF50' : '#2196F3';
        }
        return vis.colorScale(d.mag);
      })
      .attr('r', d => vis.radiusScale(d.mag))
      .on('mouseover', (event, d) => {
        d3.select('#tooltip')
          .style('opacity', 1)
          .html(`
            <b>Location:</b> ${d.place || 'Unknown'}<br>
            <b>Magnitude:</b> ${d.mag}<br>
            <b>Depth:</b> ${d.depth} km <br>
            <b>Date/Time:</b> ${d.time.toLocaleDateString()} ${d.time.toLocaleTimeString()}<br>
          `);
      })
      .on('mousemove', (event) => {
        d3.select('#tooltip')
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY + 10) + 'px');
      })
      .on('mouseleave', () => {
        d3.select('#tooltip').style('opacity', 0);
      })
      .on('click', function(event, d) {
        if (vis.isSelectionMode) {
          vis.handleEventSelection(d);
        }
      });

    // Update positions
    vis.circles
      .attr('cx', d => vis.project(d).x)
      .attr('cy', d => vis.project(d).y);

    // Update the static legend (if needed)
    if (vis.legend) {
      vis.legend.remove();
      vis.legend.onAdd = function(map) {
        const div = L.DomUtil.create('div', 'info legend');
        const [minMag, maxMag] = magExtent;
        const breaks = d3.ticks(minMag, maxMag, 6);
        breaks.forEach((b, i) => {
          const color = vis.colorScale(b);
          const nextVal = breaks[i + 1];
          if (i < breaks.length - 1) {
            div.innerHTML += `<i style="background:${color}"></i>${b.toFixed(1)} &ndash; ${nextVal.toFixed(1)}<br>`;
          } else {
            div.innerHTML += `<i style="background:${color}"></i>${b.toFixed(1)}+<br>`;
          }
        });
        return div;
      };
      vis.legend.addTo(vis.map);
    }
  }
}
