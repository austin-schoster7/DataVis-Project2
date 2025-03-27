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

// Visualization instances
let leafletMap, timeline, magChart;
let currentWeek = 0;
let playInterval = null;
let allData = {};
let weeksData = [];
let isDataLoaded = false;
let selectedAttribute = 'mag'; // Default attribute

// Main initialization function
async function initialize() {
  try {
    // Show loading state
    d3.select('#loading-message').style('display', 'block');

    // Load all years data
    const loadPromises = [];
    for (let year = 2004; year <= 2024; year++) {
      loadPromises.push(loadDataForYear(year));
    }

    // Wait for all files to load
    const allYearData = await Promise.all(loadPromises);

    // Store loaded data
    allYearData.forEach((data, index) => {
      allData[2004 + index] = data;
    });

    // Process into weekly chunks
    processAllDataIntoWeeks();
    isDataLoaded = true;

    // Initialize visualizations with first week's data
    leafletMap = new LeafletMap({ parentElement: '#my-map' }, weeksData[currentWeek].data);
    timeline = new Timeline({ parentElement: '#timeline' }, weeksData[currentWeek].data);
    magChart = new MagnitudeChart({ parentElement: '#mag-chart' }, weeksData[currentWeek].data);

    // Set up UI controls
    setupUI();
    updateDateDisplay();

    // Hide loading message
    d3.select('#loading-message').style('display', 'none');
  } catch (err) {
    console.error('Initialization error:', err);
    d3.select('#loading-message').text('Error loading data. Please try again.');
  }
}

// Load CSV data for a specific year
function loadDataForYear(year) {
  const filename = yearToFile[year];
  if (!filename) {
    return Promise.reject(`No CSV mapping found for year ${year}`);
  }

  return d3.csv(`data/${filename}`).then(data => {
    // Convert data types
    return data.map(d => {
      return {
        latitude: +d.latitude,
        longitude: +d.longitude,
        mag: +d.mag,
        depth: +d.depth,
        time: new Date(d.time),
        place: d.place
      };
    });
  });
}

// Process all loaded data into weekly chunks
function processAllDataIntoWeeks() {
  weeksData = [];

  for (let year = 2004; year <= 2024; year++) {
    const yearData = allData[year];
    if (!yearData || yearData.length === 0) continue;

    // Find date range for this year
    const minDate = d3.min(yearData, d => d.time);
    const maxDate = d3.max(yearData, d => d.time);

    // Create weekly chunks
    let currentWeekStart = new Date(minDate);
    currentWeekStart.setHours(0, 0, 0, 0);

    while (currentWeekStart < maxDate) {
      const weekEnd = new Date(currentWeekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      // Filter data for this week
      const weekData = yearData.filter(d =>
        d.time >= currentWeekStart && d.time < weekEnd
      );

      weeksData.push({
        year: year,
        startDate: new Date(currentWeekStart),
        endDate: new Date(weekEnd),
        data: weekData
      });

      // Move to next week
      currentWeekStart = new Date(weekEnd);
    }
  }

  // Filter out empty weeks if needed
  weeksData = weeksData.filter(week => week.data.length > 0);
}

// Set up UI controls and event listeners
function setupUI() {
  // Attribute dropdown
  d3.select('#attribute-dropdown').on('change', function () {
    selectedAttribute = d3.select(this).property('value');
    magChart.updateChart(selectedAttribute);
  });

  // Configure slider
  const slider = d3.select('#year-slider')
    .attr('min', 0)
    .attr('max', weeksData.length - 1)
    .attr('value', 0);

  // Slider input handler
  slider.on('input', function () {
    if (!isDataLoaded) return;

    currentWeek = +this.value;
    updateAllVisualizations(weeksData[currentWeek].data);
    updateDateDisplay();
  });

  // Play button
  d3.select('#play-button').on('click', playAnimation);

  // Pause button
  d3.select('#pause-button').on('click', pauseAnimation);

  // Speed control
  d3.select('#animation-speed').on('change', function () {
    if (playInterval) {
      // If animation is playing, restart with new speed
      pauseAnimation();
      playAnimation();
    }
  });

  // Loop checkbox
  d3.select('#loop-checkbox').on('change', function () {
    // No immediate action needed, checked during animation
  });
}

// Update all visualizations with new data
function updateAllVisualizations(data) {
  leafletMap.data = data;
  leafletMap.updateVis();

  timeline.data = data;
  timeline.updateVis();

  magChart.data = data;
  magChart.updateChart(selectedAttribute);
}

// Update the date display
function updateDateDisplay() {
  const weekInfo = weeksData[currentWeek];
  const startStr = weekInfo.startDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
  const endStr = weekInfo.endDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

  d3.select('#current-date-display').html(`
    <strong>Year:</strong> ${weekInfo.year} | 
    <strong>Week:</strong> ${startStr} to ${endStr} | 
    <strong>Earthquakes:</strong> ${weekInfo.data.length}
  `);
}

// Animation control functions
// Animation control functions - FIXED VERSION
function playAnimation() {
  if (!isDataLoaded) return;

  // UI state
  d3.select('#play-button').attr('disabled', true);
  d3.select('#pause-button').attr('disabled', null);

  // Get speed setting (convert to milliseconds)
  const speedSec = +d3.select('#animation-speed').property('value');
  const intervalMs = speedSec * 1000;

  // Clear any existing interval
  if (playInterval) {
    clearInterval(playInterval);
  }

  playInterval = setInterval(() => {
    const shouldLoop = d3.select('#loop-checkbox').property('checked');

    if (currentWeek < weeksData.length - 1) {
      currentWeek++;
    } else if (shouldLoop) {
      currentWeek = 0; // Loop back to start
    } else {
      pauseAnimation();
      return;
    }

    // Update UI and visualizations
    d3.select('#year-slider').property('value', currentWeek).dispatch('input');
    updateDateDisplay();
  }, intervalMs);
}

function pauseAnimation() {
  if (playInterval) {
    clearInterval(playInterval);
    playInterval = null;
  }

  // UI state
  d3.select('#play-button').attr('disabled', null);
  d3.select('#pause-button').attr('disabled', true);
}

// Start the application
initialize();