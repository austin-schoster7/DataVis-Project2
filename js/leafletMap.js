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
    this.selectedEvent = null;   // from map clicks
    this.selectedQuakes = null;  // from bar chart selection (an array)
    this.originalColors = new Map();
    this.currentAttribute = "mag";
    this.initVis();
  }

  initVis() {
    const vis = this;
    // (1) Define tile layers
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
    // Use current attribute to set the scales:
    if (vis.currentAttribute === "depth") {
      const depthExtent = d3.extent(vis.data, d => d.depth);
      vis.colorScale = d3.scaleSequential(d3.interpolateBlues).domain(depthExtent);
      vis.radiusScale = d3.scaleLinear().domain(depthExtent).range([2, 10]);
    } 
    else {
      const magExtent = d3.extent(vis.data, d => d.mag);
      vis.colorScale = d3.scaleSequential(d3.interpolateReds).domain(magExtent);
      vis.radiusScale = d3.scaleLinear().domain(magExtent).range([2, 10]);
    }

    // (6) Plot quake circles with click handler for selection
    vis.circles = vis.svg.selectAll('circle')
      .data(vis.data)
      .join('circle')
      .attr('stroke', 'black')
      .attr('fill', d => {
        return vis.currentAttribute === "depth" ? vis.colorScale(d.depth) : vis.colorScale(d.mag);
      })
      .attr('r', d => {
        return vis.currentAttribute === "depth" ? vis.radiusScale(d.depth) : vis.radiusScale(d.mag);
      })
      .attr('cx', d => vis.project(d).x)
      .attr('cy', d => vis.project(d).y)
      .on('mouseover', (event, d) => {
        d3.select('#tooltip')
          .style('opacity', 1)
          .html(`
            <b>Location:</b> ${d.place || 'Unknown'}<br>
            <b>${vis.currentAttribute === "depth" ? "Depth" : "Magnitude"}:</b> ${vis.currentAttribute === "depth" ? d.depth : d.mag}<br>
            <b>Depth:</b> ${d.depth} km<br>
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

    // (7) Store original colors
    vis.data.forEach(d => {
      vis.originalColors.set(d, vis.colorScale(d.mag));
    });

    // (8) Set up a brush group
    vis.brushGroup = vis.svg.append("g").attr("class", "brush");
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
  
          // Enable brushing
          vis.brushGroup.call(vis.brush);
      } else {
          vis.map.dragging.enable();
          vis.map.doubleClickZoom.enable();
          vis.map.scrollWheelZoom.enable();
  
          // Clear existing selection
          vis.brushGroup.call(vis.brush.move, null);
  
          // Remove the brush overlay
          vis.brushGroup.selectAll("*").remove();
          vis.brushGroup.on(".brush", null);
          
          // reset selection
          d3.selectAll("circle").classed("selected", false);
  
          // Recreate brush group (to prevent D3 from retaining old state)
          vis.brushGroup = vis.svg.append("g").attr("class", "brush");
      }
    });

    // (9) Create the static legend
    vis.legend = L.control({ position: 'bottomright' });
    vis.legend.onAdd = function(map) {
      const div = L.DomUtil.create('div', 'info legend');
      // Set the title based on the current attribute
      const title = vis.currentAttribute === "depth" ? "Depth (km)" : "Magnitude";
      // Insert the title at the top of the legend
      div.innerHTML = `<strong>${title}</strong><br>`;
      let extent, breaks;
      if (vis.currentAttribute === "depth") {
        extent = d3.extent(vis.data, d => d.depth);
        breaks = d3.ticks(extent[0], extent[1], 6);
      } else {
        extent = d3.extent(vis.data, d => d.mag);
        breaks = d3.ticks(extent[0], extent[1], 6);
      }
      breaks.forEach((b, i) => {
        const color = vis.currentAttribute === "depth" ? vis.colorScale(b) : vis.colorScale(b);
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

    // (10) Add info control for instructions
    vis.addInfoControl();

    // (11) Update positions on zoom/pan
    vis.map.on('zoomend moveend', () => vis.updateVis());
  }

  // Set the current attribute and update the map
  setAttribute(attr) {
    this.currentAttribute = attr;
    this.updateVis(); // re-draw with new scales
  }

  // Helper: convert lat/lng to x/y
  project(d) {
    return this.map.latLngToLayerPoint([d.latitude, d.longitude]);
  }

  // Handle selection from a map click (for individual quakes)
  handleEventSelection(selectedEvent) {
    const vis = this;
    
    // If clicking the same quake again => deselect
    if (vis.selectedEvent === selectedEvent) {
      vis.resetEventHighlights();
      vis.removeSelectionLegend();
      updateLinkedSelections(null);
      timeline.brushG.call(timeline.brush.move, null);
      return;
    }
    
    // Reset any previous selection
    vis.resetEventHighlights();
    
    // Store selected event (clear any bar selection)
    vis.selectedEvent = selectedEvent;
    vis.selectedQuakes = null; // clear bar selection
    
    // Highlight the selected quake: keep its original fill, add a red outline
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
    
    // Show selection legend
    vis.addSelectionLegend();
    
    // Set timeline brush for [selectedTime - 24h, selectedTime + 24h], if within timeline domain
    const quakeTime = selectedEvent.time.getTime();
    const startTime = quakeTime - dayInMs;
    const endTime = quakeTime + dayInMs;
    const [domainMin, domainMax] = timeline.xScale.domain();
    if (endTime >= domainMin.getTime() && startTime <= domainMax.getTime()) {
      const clampedStart = Math.max(domainMin.getTime(), startTime);
      const clampedEnd = Math.min(domainMax.getTime(), endTime);
      timeline.setBrushRange(new Date(clampedStart), new Date(clampedEnd));
    }
    
    // Update linked selections in other views (using map click selection)
    updateLinkedSelections(selectedEvent);
  }

  // Reset selection on map
  resetEventHighlights() {
    const vis = this;
    vis.selectedEvent = null;
    vis.selectedQuakes = null;
    vis.circles
      .attr('fill', d => vis.originalColors.get(d))
      .attr('stroke', 'black')
      .attr('stroke-width', 1)
      .attr('opacity', 1);
    vis.removeSelectionLegend();
  }

  // Add selection legend (bottom-right, styled like static legend)
  addSelectionLegend() {
    const vis = this;
    if (!vis.selectionLegend) {
      vis.selectionLegend = L.control({ position: 'bottomright' });
      vis.selectionLegend.onAdd = function(map) {
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

  // Remove selection legend
  removeSelectionLegend() {
    const vis = this;
    if (vis.selectionLegend) {
      vis.selectionLegend.remove();
      vis.selectionLegend = null;
    }
  }

  // Add info control for instructions
  addInfoControl() {
    const vis = this;
    vis.infoControl = L.control({ position: 'topleft' });
    vis.infoControl.onAdd = function(map) {
      const container = L.DomUtil.create('div', 'info-container');
      const infoIcon = L.DomUtil.create('div', 'info-control', container);
      infoIcon.innerHTML = 'i';
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

  // Update map: rebind circles and reapply selection highlighting
  updateVis() {
    const vis = this;

    let extent;
    if (vis.currentAttribute === "depth") {
      extent = d3.extent(vis.data, d => d.depth);
      vis.colorScale = d3.scaleSequential(d3.interpolateBlues).domain(extent);
      vis.radiusScale = d3.scaleLinear().domain(extent).range([2, 10]);
    } 
    else {
      extent = d3.extent(vis.data, d => d.mag);
      vis.colorScale = d3.scaleSequential(d3.interpolateReds).domain(extent);
      vis.radiusScale = d3.scaleLinear().domain(extent).range([2, 10]);
    }

    // Re-store original color for each quake based on the new attribute
    vis.data.forEach(d => {
      vis.originalColors.set(d, vis.colorScale(d[vis.currentAttribute]));
    });
  
    // Rebind circles
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
        return vis.colorScale(d[vis.currentAttribute]);
      })
      .attr('r', d => vis.radiusScale(d[vis.currentAttribute]))
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
  
    // Update positions of circles
    vis.circles
      .attr('cx', d => vis.project(d).x)
      .attr('cy', d => vis.project(d).y);
  
    // Reapply selection highlighting if a bar selection exists
    if (vis.selectedQuakes) {
      vis.svg.selectAll('circle')
        .attr('stroke', d => (vis.selectedQuakes.includes(d)) ? 'red' : 'black')
        .attr('stroke-width', d => (vis.selectedQuakes.includes(d)) ? 2 : 1)
        .attr('opacity', d => (vis.selectedQuakes.includes(d)) ? 1 : 0.5)
        .attr('fill', d => vis.originalColors.get(d));
    } else if (vis.selectedEvent) {
      vis.circles.filter(d => d === vis.selectedEvent)
        .attr('stroke', 'red')
        .attr('stroke-width', 2);
    }
  
    // Update legend
    if (vis.legend) {
      vis.legend.remove();
      vis.legend.onAdd = function(map) {
        const div = L.DomUtil.create('div', 'info legend');
        // Set the title based on the current attribute
        const title = vis.currentAttribute === "depth" ? "Depth (km)" : "Magnitude";
        // Insert the title at the top of the legend
        div.innerHTML = `<strong>${title}</strong><br>`;
        const domainExtent = d3.extent(vis.data, d => d[vis.currentAttribute]);
        const breaks = d3.ticks(domainExtent[0], domainExtent[1], 6);
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
  
  // Highlight quakes based on a selected bin from the bar chart.
  // quakeArray is an array of quake objects from the selected bin.
  highlightQuakes(quakeArray) {
    const vis = this;
    
    // If no quake array is provided, clear any highlight: reset opacity and stroke
    if (!quakeArray) {
      vis.selectedQuakes = null;
      vis.svg.selectAll('circle')
        .attr('stroke', 'black')
        .attr('stroke-width', 1)
        .attr('opacity', 1)
        .attr('fill', d => vis.originalColors.get(d));
      return;
    }
    
    vis.selectedQuakes = quakeArray;
    
    vis.svg.selectAll('circle')
      .attr('stroke', d => (vis.selectedQuakes.includes(d)) ? 'red' : 'black')
      .attr('stroke-width', d => (vis.selectedQuakes.includes(d)) ? 2 : 1)
      .attr('opacity', d => (vis.selectedQuakes.includes(d)) ? 1 : 0.35)
      .attr('fill', d => vis.originalColors.get(d));
  }
}
