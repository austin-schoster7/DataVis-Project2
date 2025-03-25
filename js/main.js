d3.csv('data/04-05.csv')
  .then(data => {
    data.forEach(d => {
      d.latitude = +d.latitude;
      d.longitude = +d.longitude;
      d.mag = +d.mag;
      d.depth = +d.depth;
      d.time = new Date(d.time);
    });

    const leafletMap = new LeafletMap({ parentElement: '#my-map' }, data);
    // Attach button event
    d3.select('#toggle-map-btn').on('click', () => {
      leafletMap.toggleBaseMap();
    });

    const timeline = new Timeline({ parentElement: '#timeline' }, data);

    // Create magnitude chart
    const magChart = new MagnitudeChart({ parentElement: '#mag-chart' }, data);
  })
  .catch(err => console.error(err));
