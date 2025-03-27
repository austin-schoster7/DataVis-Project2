class LeafletMap {
  constructor(_config, _data) {
    this.config = {
      parentElement: _config.parentElement,
      ..._config
    };
    this.data = _data;

    // We'll store the legend as a property of the class
    this.legend = null;

    this.initVis();
  }

  initVis() {
    const vis = this;

    // 1) Define multiple tile layers
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

    // 2) Initialize the map
    vis.map = L.map(vis.config.parentElement.substring(1), {
      center: [20, 0],
      zoom: 2,
      layers: [vis.esriImagery]
    });

    // 3) Layer control
    const baseMaps = {
      'ESRI Imagery': vis.esriImagery,
      'OpenStreetMap': vis.osmStandard,
      'Carto Positron': vis.cartoPositron,
      'Carto Dark': vis.cartoDark,
      'ESRI Topo': vis.esriTopo
    };
    L.control.layers(baseMaps).addTo(vis.map);

    // 4) Add D3 overlay
    L.svg({ clickable: true }).addTo(vis.map);
    vis.overlay = d3.select(vis.map.getPanes().overlayPane);
    vis.svg = vis.overlay.select('svg').attr('pointer-events', 'auto');

    // 5) Create color & radius scales
    const magExtent = d3.extent(vis.data, d => d.mag);
    vis.colorScale = d3.scaleSequential(d3.interpolateReds).domain(magExtent);
    vis.radiusScale = d3.scaleLinear().domain(magExtent).range([2, 10]);

    // 6) Plot quake circles
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
            <b>Date:</b> ${d.time.toLocaleDateString()}<br>
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
      });

    // 7) Create the legend as a class property
    vis.legend = L.control({ position: 'bottomright' });
    vis.legend.onAdd = function(map) {
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

    // 8) Update circle positions on map zoom/pan
    vis.map.on('zoomend moveend', () => vis.updateVis());
  }

  // Convert lat/lng to x/y
  project(d) {
    return this.map.latLngToLayerPoint([d.latitude, d.longitude]);
  }

  updateVis() {
    const vis = this;

    // Recompute domain if data changes drastically
    const magExtent = d3.extent(vis.data, d => d.mag);
    vis.colorScale.domain(magExtent);
    vis.radiusScale.domain(magExtent);

    // Re-bind circles to new data
    vis.circles = vis.svg.selectAll('circle')
      .data(vis.data)
      .join('circle')
      .attr('stroke', 'black')
      .attr('fill', d => vis.colorScale(d.mag))
      .attr('r', d => vis.radiusScale(d.mag))
      .on('mouseover', (event, d) => {
        d3.select('#tooltip')
          .style('opacity', 1)
          .html(`
            <b>Location:</b> ${d.place || 'Unknown'}<br>
            <b>Magnitude:</b> ${d.mag}<br>
            <b>Depth:</b> ${d.depth} km <br>
            <b>Date:</b> ${d.time.toLocaleDateString()}<br>
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
      });

    // Update positions
    vis.circles
      .attr('cx', d => vis.project(d).x)
      .attr('cy', d => vis.project(d).y);

    // If you want to re-draw the legend with the new domain, do this:
    if (vis.legend) {
      vis.legend.remove(); // remove old legend
      // Re-define onAdd for new domain
      vis.legend.onAdd = function(map) {
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
