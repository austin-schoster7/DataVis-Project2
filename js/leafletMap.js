class LeafletMap {
  constructor(_config, _data) {
    this.config = {
      parentElement: _config.parentElement,
      ..._config
    };
    this.data = _data;
    this.legend = null;
    this.isSelectionMode = true; // Track if selection mode is active
    this.selectedEvent = null; // Store the currently selected event
    this.originalColors = new Map(); // Store original colors for reset
    this.initVis();
  }

  initVis() {
    const vis = this;

    // Initialize map and layers (same as before)
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

    vis.map = L.map(vis.config.parentElement.substring(1), {
      center: [20, 0],
      zoom: 2,
      layers: [vis.esriImagery]
    });

    // Layer control (same as before)
    const baseMaps = {
      'ESRI Imagery': vis.esriImagery,
      'OpenStreetMap': vis.osmStandard,
      'Carto Positron': vis.cartoPositron,
      'Carto Dark': vis.cartoDark,
      'ESRI Topo': vis.esriTopo
    };
    L.control.layers(baseMaps).addTo(vis.map);

    // Add D3 overlay
    L.svg({ clickable: true }).addTo(vis.map);
    vis.overlay = d3.select(vis.map.getPanes().overlayPane);
    vis.svg = vis.overlay.select('svg').attr('pointer-events', 'auto');

    // Create scales
    const magExtent = d3.extent(vis.data, d => d.mag);
    vis.colorScale = d3.scaleSequential(d3.interpolateReds).domain(magExtent);
    vis.radiusScale = d3.scaleLinear().domain(magExtent).range([2, 10]);

    // Plot quake circles with click handler
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
        d3.select('#tooltip')
          .style('opacity', 0);
      })
      .on('click', function (event, d) {
        if (vis.isSelectionMode) {
          vis.handleEventSelection(d);
        }
      });

    // Store original colors
    vis.data.forEach((d, i) => {
      vis.originalColors.set(d, vis.colorScale(d.mag));
    });

    // Legend (same as before)
    vis.legend = L.control({ position: 'bottomright' });
    vis.legend.onAdd = function (map) {
      const div = L.DomUtil.create('div', 'info legend');

      const [minMag, maxMag] = magExtent; // from earlier
      const breaks = d3.ticks(minMag, maxMag, 6);

      breaks.forEach((b, i) => {
        const color = vis.colorScale(b);
        const nextVal = breaks[i + 1];
        if (i < breaks.length - 1) {
          div.innerHTML += `
            <i style="background:${color}"></i>
            ${b.toFixed(1)} &ndash; ${nextVal.toFixed(1)}<br>`;
        } else {
          div.innerHTML += `
            <i style="background:${color}"></i>
            ${b.toFixed(1)}+<br>`;
        }
      });
      return div;
    };
    vis.legend.addTo(vis.map);

    vis.map.on('zoomend moveend', () => vis.updateVis());
  }

  // Handle event selection
  handleEventSelection(selectedEvent) {
    const vis = this;

    // If clicking the already selected event, deselect it
    if (vis.selectedEvent === selectedEvent) {
      vis.resetEventHighlights();
      return;
    }

    // Reset any previous selection
    vis.resetEventHighlights();

    // Store the selected event
    vis.selectedEvent = selectedEvent;

    // Highlight selected event (yellow)
    vis.circles.filter(d => d === selectedEvent)
      .attr('fill', 'yellow')
      .attr('stroke', 'black')
      .attr('stroke-width', 2);

    // Find events within 24 hours
    const selectedTime = selectedEvent.time.getTime();
    const dayInMs = 24 * 60 * 60 * 1000;

    vis.data.forEach(event => {
      const eventTime = event.time.getTime();
      const timeDiff = eventTime - selectedTime;

      if (Math.abs(timeDiff) <= dayInMs && event !== selectedEvent) {
        // Highlight events before (green) and after (blue)
        const color = timeDiff < 0 ? '#4CAF50' : '#2196F3'; // Green for before, blue for after

        vis.circles.filter(d => d === event)
          .attr('fill', color)
          .attr('stroke', 'black')
          .attr('stroke-width', 1.5);
      }
    });
  }

  // Reset all event highlights
  resetEventHighlights() {
    const vis = this;
    vis.selectedEvent = null;

    vis.circles
      .attr('fill', d => vis.originalColors.get(d))
      .attr('stroke', 'black')
      .attr('stroke-width', 1);
  }

  // Convert lat/lng to x/y (same as before)
  project(d) {
    return this.map.latLngToLayerPoint([d.latitude, d.longitude]);
  }

  updateVis() {
    const vis = this;
    const magExtent = d3.extent(vis.data, d => d.mag);
    vis.colorScale.domain(magExtent);
    vis.radiusScale.domain(magExtent);

    // Store original colors before updating
    vis.data.forEach((d, i) => {
      vis.originalColors.set(d, vis.colorScale(d.mag));
    });

    vis.circles = vis.svg.selectAll('circle')
      .data(vis.data)
      .join('circle')
      .attr('stroke', 'black')
      .attr('fill', d => {
        // If in selection mode and this is a highlighted event, keep its color
        if (vis.isSelectionMode && vis.selectedEvent) {
          const selectedTime = vis.selectedEvent.time.getTime();
          const eventTime = d.time.getTime();
          const dayInMs = 24 * 60 * 60 * 1000;
          const timeDiff = eventTime - selectedTime;

          if (d === vis.selectedEvent) return 'yellow';
          if (Math.abs(timeDiff) <= dayInMs) {
            return timeDiff < 0 ? '#4CAF50' : '#2196F3';
          }
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
        d3.select('#tooltip')
          .style('opacity', 0);
      })
      .on('click', function (event, d) {
        if (vis.isSelectionMode) {
          vis.handleEventSelection(d);
        }
      });

    vis.circles
      .attr('cx', d => vis.project(d).x)
      .attr('cy', d => vis.project(d).y);

    // Update legend (same as before)
    if (vis.legend) {
      vis.legend.remove(); // remove old legend
      // Re-define onAdd for new domain
      vis.legend.onAdd = function (map) {
        const div = L.DomUtil.create('div', 'info legend');
        const [minMag, maxMag] = magExtent;
        const breaks = d3.ticks(minMag, maxMag, 6);

        breaks.forEach((b, i) => {
          const color = vis.colorScale(b);
          const nextVal = breaks[i + 1];
          if (i < breaks.length - 1) {
            div.innerHTML += `
              <i style="background:${color}"></i>
              ${b.toFixed(1)} &ndash; ${nextVal.toFixed(1)}<br>`;
          } else {
            div.innerHTML += `
              <i style="background:${color}"></i>
              ${b.toFixed(1)}+<br>`;
          }
        });
        return div;
      };
      vis.legend.addTo(vis.map);
    }
  }
}