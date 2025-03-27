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
let currentIndex = 0;
let playInterval = null;
let allData = {};
let timeChunks = []; // Will hold weeks, months, or custom ranges
let isDataLoaded = false;
let selectedAttribute = 'mag';
let currentMode = 'weekly'; // Default mode

// Main initialization function
async function initialize() {
  try {
    d3.select('#loading-message').style('display', 'block');

    // Load all years data
    const loadPromises = [];
    for (let year = 2004; year <= 2024; year++) {
      loadPromises.push(loadDataForYear(year));
    }

    const allYearData = await Promise.all(loadPromises);

    // Store loaded data
    allYearData.forEach((data, index) => {
      allData[2004 + index] = data;
    });

    // Process into time chunks based on default mode
    processTimeChunks(currentMode);
    isDataLoaded = true;

    // Initialize visualizations
    leafletMap = new LeafletMap({ parentElement: '#my-map' }, timeChunks[currentIndex].data);
    timeline = new Timeline({ parentElement: '#timeline' }, timeChunks[currentIndex].data);
    magChart = new MagnitudeChart({ parentElement: '#mag-chart' }, timeChunks[currentIndex].data);

    // Set up UI controls
    setupUI();
    updateDateDisplay();

    d3.select('#loading-message').style('display', 'none');
  } catch (err) {
    console.error('Initialization error:', err);
    d3.select('#loading-message').text('Error loading data. Please try again.');
  }
}

function loadDataForYear(year) {
  const filename = yearToFile[year];
  if (!filename) {
    return Promise.reject(`No CSV mapping found for year ${year}`);
  }

  return d3.csv(`data/${filename}`).then(data => {
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

function processTimeChunks(mode, customRange = null) {
  timeChunks = [];

  if (mode === 'weekly') {
    processWeeklyChunks();
  } else if (mode === 'monthly') {
    processMonthlyChunks();
  } else if (mode === 'custom-range') {
    processCustomRangeChunks(customRange);
  } else if (mode === 'static-range') {
    processStaticRange(customRange);
  }

  // Reset current index
  currentIndex = 0;

  // Update slider
  updateSlider();
}

function processWeeklyChunks() {
  for (let year = 2004; year <= 2024; year++) {
    const yearData = allData[year];
    if (!yearData || yearData.length === 0) continue;

    const minDate = d3.min(yearData, d => d.time);
    const maxDate = d3.max(yearData, d => d.time);

    let currentWeekStart = new Date(minDate);
    currentWeekStart.setHours(0, 0, 0, 0);

    while (currentWeekStart < maxDate) {
      const weekEnd = new Date(currentWeekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const weekData = yearData.filter(d =>
        d.time >= currentWeekStart && d.time < weekEnd
      );

      if (weekData.length > 0) {
        timeChunks.push({
          year: year,
          startDate: new Date(currentWeekStart),
          endDate: new Date(weekEnd),
          data: weekData
        });
      }

      currentWeekStart = new Date(weekEnd);
    }
  }
}

function processMonthlyChunks() {
  for (let year = 2004; year <= 2024; year++) {
    const yearData = allData[year];
    if (!yearData || yearData.length === 0) continue;

    const minDate = d3.min(yearData, d => d.time);
    const maxDate = d3.max(yearData, d => d.time);

    let currentMonthStart = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
    currentMonthStart.setHours(0, 0, 0, 0);

    while (currentMonthStart < maxDate) {
      const monthEnd = new Date(currentMonthStart.getFullYear(), currentMonthStart.getMonth() + 1, 1);

      const monthData = yearData.filter(d =>
        d.time >= currentMonthStart && d.time < monthEnd
      );

      if (monthData.length > 0) {
        timeChunks.push({
          year: year,
          startDate: new Date(currentMonthStart),
          endDate: new Date(monthEnd),
          data: monthData
        });
      }

      currentMonthStart = new Date(monthEnd);
    }
  }
}

function processCustomRangeChunks(range) {
  if (!range) return;

  const { startDate, endDate } = range;
  const allDataFlat = Object.values(allData).flat();

  // Filter data within range
  const rangeData = allDataFlat.filter(d =>
    d.time >= startDate && d.time <= endDate
  );

  if (rangeData.length === 0) return;

  // Process into weekly chunks within the range
  let currentWeekStart = new Date(startDate);
  currentWeekStart.setHours(0, 0, 0, 0);

  while (currentWeekStart < endDate) {
    const weekEnd = new Date(currentWeekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const weekData = rangeData.filter(d =>
      d.time >= currentWeekStart && d.time < weekEnd
    );

    if (weekData.length > 0) {
      timeChunks.push({
        year: currentWeekStart.getFullYear(),
        startDate: new Date(currentWeekStart),
        endDate: new Date(weekEnd),
        data: weekData
      });
    }

    currentWeekStart = new Date(weekEnd);
  }
}

function processStaticRange(range) {
  if (!range) return;

  const { startDate, endDate } = range;
  const allDataFlat = Object.values(allData).flat();

  // Filter data within range
  const rangeData = allDataFlat.filter(d =>
    d.time >= startDate && d.time <= endDate
  );

  if (rangeData.length > 0) {
    timeChunks = [{
      year: `${startDate.getFullYear()}-${endDate.getFullYear()}`,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      data: rangeData
    }];
  }
}

function setupUI() {
  // Attribute dropdown
  d3.select('#attribute-dropdown').on('change', function () {
    selectedAttribute = d3.select(this).property('value');
    magChart.updateChart(selectedAttribute);
  });

  // Mode selector
  d3.select('#mode-selector').on('change', function () {
    pauseAnimation();
    currentMode = d3.select(this).property('value');

    // Show/hide relevant controls
    updateControlVisibility();

    // Process data for new mode
    if (currentMode === 'custom-range' || currentMode === 'static-range') {
      // Get dates from date pickers
      const startDate = new Date(d3.select('#start-date').property('value'));
      const endDate = new Date(d3.select('#end-date').property('value'));

      if (isNaN(startDate) || isNaN(endDate)) {
        alert('Please select valid dates');
        return;
      }

      processTimeChunks(currentMode, { startDate, endDate });
    } else {
      processTimeChunks(currentMode);
    }

    updateAllVisualizations(timeChunks[currentIndex].data);
    updateDateDisplay();
  });

  // Date pickers
  d3.select('#apply-range').on('click', function () {
    if (currentMode !== 'custom-range' && currentMode !== 'static-range') return;

    const startDate = new Date(d3.select('#start-date').property('value'));
    const endDate = new Date(d3.select('#end-date').property('value'));

    if (isNaN(startDate) || isNaN(endDate)) {
      alert('Please select valid dates');
      return;
    }

    if (startDate >= endDate) {
      alert('End date must be after start date');
      return;
    }

    pauseAnimation();
    processTimeChunks(currentMode, { startDate, endDate });
    updateAllVisualizations(timeChunks[currentIndex].data);
    updateDateDisplay();
  });

  d3.select('#year-slider').on('input', function () {
    if (!isDataLoaded || timeChunks.length === 0) return;

    currentIndex = +this.value;
    updateAllVisualizations(timeChunks[currentIndex].data); // Explicit update
    updateDateDisplay();
  });

  // Play button
  d3.select('#play-button').on('click', playAnimation);

  // Pause button
  d3.select('#pause-button').on('click', pauseAnimation);

  // Speed control
  d3.select('#animation-speed').on('change', function () {
    if (playInterval) {
      pauseAnimation();
      playAnimation();
    }
  });

  // Loop checkbox
  d3.select('#loop-checkbox').on('change', function () {
    // No immediate action needed
  });

  // Initialize control visibility
  updateControlVisibility();
}

function updateControlVisibility() {
  // Hide all range controls first
  d3.select('#custom-range-controls').style('display', 'none');
  d3.select('#static-range-controls').style('display', 'none');

  // Show play controls by default (will be hidden for static mode)
  d3.select('#play-controls').style('display', 'flex');

  // Update speed label based on mode
  const speedLabel = currentMode === 'monthly' ? 'sec/month' : 'sec/week';
  d3.select('#speed-label').text(speedLabel);

  // Show relevant controls based on current mode
  switch (currentMode) {
    case 'custom-range':
      d3.select('#custom-range-controls').style('display', 'flex');
      break;
    case 'static-range':
      d3.select('#custom-range-controls').style('display', 'flex');
      d3.select('#play-controls').style('display', 'none');
      break;
    default:
      // For weekly and monthly modes, no additional controls needed
      break;
  }
}

function updateSlider() {
  const slider = d3.select('#year-slider')
    .attr('min', 0)
    .attr('max', Math.max(0, timeChunks.length - 1))
    .attr('value', 0);
}

function updateAllVisualizations(data) {
  // Add console logs to verify data is being passed correctly
  console.log('Updating visualizations with data:', data.length, 'points');

  if (leafletMap) {
    leafletMap.data = data;
    leafletMap.updateVis();
  }

  if (timeline) {
    timeline.data = data;
    timeline.updateVis();
  }

  if (magChart) {
    magChart.data = data;
    magChart.updateChart(selectedAttribute);
  }
}

function updateDateDisplay() {
  if (timeChunks.length === 0) return;

  const chunk = timeChunks[currentIndex];
  const startStr = chunk.startDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

  let dateText;

  if (currentMode === 'static-range') {
    const endStr = chunk.endDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
    dateText = `<strong>Range:</strong> ${startStr} to ${endStr} | <strong>Earthquakes:</strong> ${chunk.data.length}`;
  } else {
    const endStr = chunk.endDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
    dateText = `<strong>Year:</strong> ${chunk.year} | <strong>${currentMode === 'monthly' ? 'Month' : 'Week'}:</strong> ${startStr} to ${endStr} | <strong>Earthquakes:</strong> ${chunk.data.length}`;
  }

  d3.select('#current-date-display').html(dateText);
}

function playAnimation() {
  if (!isDataLoaded || timeChunks.length === 0 || currentMode === 'static-range') return;

  d3.select('#play-button').attr('disabled', true);
  d3.select('#pause-button').attr('disabled', null);

  const speedSec = +d3.select('#animation-speed').property('value');
  const intervalMs = speedSec * 1000;

  if (playInterval) {
    clearInterval(playInterval);
  }

  playInterval = setInterval(() => {
    const shouldLoop = d3.select('#loop-checkbox').property('checked');

    if (currentIndex < timeChunks.length - 1) {
      currentIndex++;
    } else if (shouldLoop) {
      currentIndex = 0;
    } else {
      pauseAnimation();
      return;
    }

    // Update slider and visualizations directly
    d3.select('#year-slider').property('value', currentIndex);
    updateAllVisualizations(timeChunks[currentIndex].data); // Direct update
    updateDateDisplay();
  }, intervalMs);
}

function pauseAnimation() {
  if (playInterval) {
    clearInterval(playInterval);
    playInterval = null;
  }

  d3.select('#play-button').attr('disabled', null);
  d3.select('#pause-button').attr('disabled', true);
}

// Start the application
initialize();