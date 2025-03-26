class LeafletMap {
  constructor(_config, _data) {
    this.config = {
      parentElement: _config.parentElement,
      ..._config
    };
    this.data = _data;
    this.initVis();
  }

  initVis() {
    const vis = this;

    // 1) Define multiple tile layers

    // ESRI World Imagery
    vis.esriImagery = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, ...' }
    );

    // OpenStreetMap Standard
    vis.osmStandard = L.tileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      { attribution: '&copy; OpenStreetMap contributors' }
    );

    // CartoDB Positron (Light)
    vis.cartoPositron = L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      { attribution: '&copy; OpenStreetMap &copy; CartoDB' }
    );

    // CartoDB Dark Matter
    vis.cartoDark = L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      { attribution: '&copy; OpenStreetMap &copy; CartoDB' }
    );

    // ArcGIS World Topo Map
    vis.esriTopo = L.tileLayer(
      'https://services.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
      { attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ, USGS, Intermap...' }
    );

    // 2) Initialize the map with one layer as default (e.g., ESRI Imagery)
    vis.map = L.map(vis.config.parentElement.substring(1), {
      center: [20, 0],
      zoom: 2,
      layers: [vis.esriImagery]
    });

    // 3) Create a layer control to switch between backgrounds
    const baseMaps = {
      'ESRI Imagery': vis.esriImagery,
      'OpenStreetMap': vis.osmStandard,
      'Carto Positron': vis.cartoPositron,
      'Carto Dark': vis.cartoDark,
      'ESRI Topo': vis.esriTopo
    };
    L.control.layers(baseMaps).addTo(vis.map);

    // 4) Add an SVG layer for D3 overlay
    L.svg({ clickable: true }).addTo(vis.map);
    vis.overlay = d3.select(vis.map.getPanes().overlayPane);
    vis.svg = vis.overlay.select('svg').attr('pointer-events', 'auto');

    // 5) Create scales for quake circles
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

    // 7) Update circle positions on map zoom/pan
    vis.map.on('zoomend moveend', () => vis.updateVis());
  }

  // Convert latitude/longitude to x/y using Leaflet's latLngToLayerPoint
  project(d) {
    const latLng = [d.latitude, d.longitude];
    return this.map.latLngToLayerPoint(latLng);
  }

  updateVis() {
    const vis = this;

    // (Optional) Re-compute color or radius scale domains if data changes drastically
    const magExtent = d3.extent(vis.data, d => d.mag);
    vis.colorScale.domain(magExtent);
    vis.radiusScale.domain(magExtent);

    // BIND NEW DATA
    vis.circles = vis.svg.selectAll('circle')
      .data(vis.data)
      .join('circle')
        .attr('stroke', 'black')
        .attr('fill', d => vis.colorScale(d.mag))
        .attr('r', d => vis.radiusScale(d.mag))
        // re-attach tooltip handlers if needed
        .on('mouseover', (event, d) => {
          d3.select('#tooltip')
            .style('opacity', 1)
            .html(`
              <b>Location:</b> ${d.place || 'Unknown'}<br>
              <b>Magnitude:</b> ${d.mag}<br>
              <b>Depth:</b> ${d.depth} km
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

    // UPDATE POSITIONS
    vis.circles
      .attr('cx', d => vis.project(d).x)
      .attr('cy', d => vis.project(d).y);
  }
}
