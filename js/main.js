const yearToFile = {
  2004: '04-05.csv',
  2005: '05-06.csv',
  2006: '06-07.csv',
  2007: '07-08.csv',
  2008: '08-09.csv',
  2009: '09-10.csv',
  2010: '10-11.csv',
  2011: '11-12.csv',
  2012: '12-13.csv',
  2013: '13-14.csv',
  2014: '14-15.csv',
  2015: '15-16.csv',
  2016: '16-17.csv',
  2017: '17-18.csv',
  2018: '18-19.csv',
  2019: '19-20.csv',
  2020: '20-21.csv',
  2021: '21-22.csv',
  2022: '22-23.csv',
  2023: '23-24.csv',
  2024: '24-25.csv'
};

let leafletMap, timeline, magChart;
let currentYear = 2004;
let playInterval = null; // Will store setInterval reference

// 1) Initialize the page with the default year’s data
loadDataForYear(currentYear)
  .then(data => {
    // Create all visualizations with the initial data
    leafletMap = new LeafletMap({ parentElement: '#my-map' }, data);
    timeline = new Timeline({ parentElement: '#timeline' }, data);
    magChart = new MagnitudeChart({ parentElement: '#mag-chart' }, data);

    // Listen for attribute dropdown changes
    d3.select('#attribute-dropdown').on('change', function() {
      selectedAttribute = d3.select(this).property('value');
      magChart.updateChart(selectedAttribute);
    });
  })
  .catch(err => console.error(err));

// 2) Define a function to load the CSV for a given year
function loadDataForYear(year) {
  // Convert year to CSV filename
  const filename = yearToFile[year];
  if (!filename) {
    return Promise.reject(`No CSV mapping found for year ${year}`);
  }
  return d3.csv(`data/${filename}`).then(data => {
    data.forEach(d => {
      d.latitude = +d.latitude;
      d.longitude = +d.longitude;
      d.mag = +d.mag;
      d.depth = +d.depth;
      d.time = new Date(d.time);
    });
    return data;
  });
}

// 3) Define a function to update existing visualizations
function updateAllVisualizations(data) {
  // If you already have references to your visualizations, you can update them
  leafletMap.data = data;
  leafletMap.updateVis();  // or .updateMap(), etc.

  timeline.data = data;
  timeline.updateVis();

  magChart.data = data;
  magChart.updateChart(selectedAttribute);
}

// 4) Listen to slider changes
d3.select('#year-slider').on('input', function() {
  currentYear = +this.value;
  loadDataForYear(currentYear)
    .then(data => {
      updateAllVisualizations(data);
    })
    .catch(err => console.error(err));
});

// 5) Animation logic (Play/Pause)
d3.select('#play-button').on('click', () => {
  // Disable the play button, enable the pause button
  d3.select('#play-button').attr('disabled', true);
  d3.select('#pause-button').attr('disabled', null);

  // Grab user’s chosen speed
  const speedInput = +d3.select('#animation-speed').property('value'); // seconds per year
  const intervalMs = speedInput * 1000;

  playInterval = setInterval(() => {
    // Move to next year
    if (currentYear < 2024) {
      currentYear++;
      d3.select('#year-slider').property('value', currentYear);
      loadDataForYear(currentYear)
        .then(data => {
          updateAllVisualizations(data);
        });
    } else {
      // Stop at 2024 or wrap around if you want
      clearInterval(playInterval);
      d3.select('#play-button').attr('disabled', null);
      d3.select('#pause-button').attr('disabled', true);
    }
  }, intervalMs);
});

d3.select('#pause-button').on('click', () => {
  // Stop the interval
  if (playInterval) {
    clearInterval(playInterval);
    playInterval = null;
  }
  // Re-enable the play button, disable pause
  d3.select('#play-button').attr('disabled', null);
  d3.select('#pause-button').attr('disabled', true);
});
