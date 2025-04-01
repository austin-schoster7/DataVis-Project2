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
let timeChunks = []; // Will hold weeks, months, years, or custom ranges
let timeChunksTimeline = [];
let isDataLoaded = false;
let selectedAttribute = 'mag';
let currentMode = 'weekly'; // Default mode

const dispatcher = d3.dispatch('brushRange');

let selectedMagnitudeBins = []; // MODIFIED: Global variable to store current magnitude bins

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
    leafletMap = new LeafletMap(
      { parentElement: '#my-map' },
      timeChunks[currentIndex].data,
      updateVisualizationsOnSelection
    );

    timeline = new Timeline({ parentElement: '#timeline' }, timeChunksTimeline[currentIndex].data, dispatcher);
    magChart = new MagnitudeChart({ parentElement: '#mag-chart' }, timeChunks[currentIndex].data);

    // Set up event listeners
    dispatcher.on('brushRange', (range) => {
      handleBrushRange(range);
    });

    // Set up UI controls
    setupUI();
    updateDateDisplay();

    d3.select('#loading-message').style('display', 'none');
  } catch (err) {
    console.error('Initialization error:', err);
    d3.select('#loading-message').text('Error loading data. Please try again.');
  }
}

// Helper: Parse range string (e.g., "[3.5,4.0)") into numeric min and max.
function parseRangeString(str) {
  const inclusiveMax = str.endsWith(']');
  const cleaned = str.replace(/[\[\]\(\)]/g, '');
  const [minStr, maxStr] = cleaned.split(',');
  return {
    minMag: +minStr,
    maxMag: +maxStr,
    inclusiveMax: inclusiveMax
  };
}

// Reapply magnitude filter (if any) on current time chunk and update visualizations.
function reapplyFilters() {
  const baseData = timeChunks[currentIndex].data;
  // If no magnitude bins are selected, use the full baseData.
  if (selectedMagnitudeBins.length === 0) {
    updateAllVisualizations(baseData);
    return;
  }
  const filteredData = baseData.filter(quake => {
    return selectedMagnitudeBins.some(bin => {
      if (bin.inclusiveMax) {
        return quake.mag >= bin.minMag && quake.mag <= bin.maxMag;
      } else {
        return quake.mag >= bin.minMag && quake.mag < bin.maxMag;
      }
    });
  });
  updateAllVisualizations(filteredData);
}

function updateVisualizationsOnSelection(selectedData) {
  if (!selectedData || selectedData.length === 0) {
    console.warn('No earthquakes selected.');
    return;
  }

  console.log(`Updating visualizations with ${selectedData.length} selected quakes`);

  if (timeline) {
    timeline.data = selectedData;
    timeline.updateVis();
  }

  if (magChart) {
    magChart.data = selectedData;
    magChart.updateChart(selectedAttribute);
  }
}

function handleBrushRange(range) {
  const currentChunk = timeChunks[currentIndex];
  if (!range) {
    // If the brush is cleared, update only the map and bar chart with the full chunk data.
    updateMapAndChart(currentChunk.data);
  } else {
    const [startDate, endDate] = range;
    // Filter data for map and bar chart only.
    const filtered = currentChunk.data.filter(d => d.time >= startDate && d.time <= endDate);
    updateMapAndChart(filtered);
  }
}

function updateMapAndChart(data) {
  if (leafletMap) {
    leafletMap.data = data;
    leafletMap.updateVis();
  }

  if (magChart) {
    magChart.data = data;
    magChart.updateChart(selectedAttribute);
  }
  // Note: We intentionally do NOT update the timeline here,
  // so it always shows the complete aggregated view.
}

function updateLinkedSelections(selectedEvent) {
  if (timeline && typeof timeline.highlightSelection === 'function') {
    timeline.highlightSelection(selectedEvent);
  }
  if (magChart && typeof magChart.highlightSelection === 'function') {
    magChart.highlightSelection(selectedEvent);
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
        depth: +d.depth <= 0 ? 0 : +d.depth,
        time: new Date(d.time),
        place: d.place
      };
    });
  });
}

function processTimeChunks(mode, customRange = null) {
  timeChunks = [];
  timeChunksTimeline = [];

  if (mode === 'weekly') {
    processWeeklyChunks();
  } else if (mode === 'monthly') {
    processMonthlyChunks();
  } else if (mode === 'yearly') {
    processYearlyChunks();
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
      const weekEndTimeline = new Date(currentWeekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      weekEndTimeline.setDate(weekEndTimeline.getDate() + 7);
      weekEndTimeline.setHours(23, 59, 59, 999);

      const weekData = yearData.filter(d =>
        d.time >= currentWeekStart && d.time < weekEnd
      );

      const weekDataTimeline = yearData.filter(d =>
        d.time >= currentWeekStart && d.time < weekEndTimeline
      );

      if (weekData.length > 0) {
        timeChunks.push({
          year: year,
          startDate: new Date(currentWeekStart),
          endDate: new Date(weekEnd),
          data: weekData
        });
        timeChunksTimeline.push({
          year: year,
          startDate: new Date(currentWeekStart),
          endDate: new Date(weekEndTimeline),
          data: weekDataTimeline
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
        timeChunksTimeline.push({
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

function processYearlyChunks() {
  for (let year = 2004; year <= 2024; year++) {
    const yearData = allData[year];
    if (!yearData || yearData.length === 0) continue;

    const minDate = new Date(year, 0, 1); // January 1st of the year
    const maxDate = new Date(year + 1, 0, 1); // January 1st of next year

    const yearDataFiltered = yearData.filter(d =>
      d.time >= minDate && d.time < maxDate
    );

    if (yearDataFiltered.length > 0) {
      timeChunks.push({
        year: year,
        startDate: new Date(minDate),
        endDate: new Date(maxDate),
        data: yearDataFiltered
      });
      timeChunksTimeline.push({
        year: year,
        startDate: new Date(minDate),
        endDate: new Date(maxDate),
        data: yearDataFiltered
      });
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
      timeChunksTimeline.push({
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
    timeChunksTimeline = [{
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

  // Toggle selection mode
  d3.select('#toggle-selection').on('click', function () {
    leafletMap.toggleSelectionMode();
    d3.select(this).classed('active', leafletMap.isSelectionMode);
  });

  // Mode selector - Updated with yearly option
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

      processTimeChunks(currentMode, { startDate, endDate });
    } else {
      processTimeChunks(currentMode);
    }

    // MODIFIED: Instead of calling updateAllVisualizations with unfiltered data, reapply magnitude filter.
    reapplyFilters();
    updateDateDisplay();
  });

  // Toggle the magnitude filter drop-down when the dropbtn is clicked.
  document.querySelector('.dropbtn').addEventListener('click', function () {
    const panel = document.getElementById('mag-filter-panel');
    // Toggle display: if hidden or empty, show it; if shown, hide it.
    if (panel.style.display === 'none' || panel.style.display === '') {
      panel.style.display = 'block';
    } else {
      panel.style.display = 'none';
    }
  });

  // Attach the "Apply Filter" event listener for the magnitude drop-down
  document.getElementById('apply-mag-filter').addEventListener('click', function () {
    console.log("Apply Filter button clicked");

    // Get the base data from the current time chunk
    const baseData = timeChunks[currentIndex].data;
    console.log("Base data count:", baseData.length);

    // Collect all checked boxes from the magnitude filter panel
    const checkedBoxes = document.querySelectorAll('#mag-filter-panel input[type="checkbox"]:checked');
    console.log("Selected checkboxes count:", checkedBoxes.length);

    // Convert each checkbox's value (e.g., "[3.5,4.0)") into an object with numeric bounds
    selectedMagnitudeBins = Array.from(checkedBoxes).map(box => parseRangeString(box.value));
    selectedMagnitudeBins.forEach(bin => console.log("Parsed bin:", bin));

    // MODIFIED: Instead of updating visualizations directly here, call reapplyFilters()
    reapplyFilters();

    // Optional: Close the drop-down panel after applying the filter.
    document.getElementById('mag-filter-panel').style.display = 'none';
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
    reapplyFilters(); // MODIFIED: Use reapplyFilters here
    updateDateDisplay();
  });

  // Slider input handler
  d3.select('#year-slider').on('input', function () {
    if (!isDataLoaded || timeChunks.length === 0) return;

    currentIndex = +this.value;
    // MODIFIED: Call reapplyFilters() so magnitude filter is applied on slider change
    reapplyFilters();
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
  let speedLabel = 'sec/week';
  if (currentMode === 'monthly') speedLabel = 'sec/month';
  else if (currentMode === 'yearly') speedLabel = 'sec/year';
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
      // For weekly, monthly, and yearly modes
      break;
  }
}

function updateSlider() {
  const slider = d3.select('#year-slider')
    .attr('min', 0)
    .attr('max', Math.max(0, timeChunks.length - 1))
    .attr('value', 0);
}

function highlightSelectedQuakes(quakeArray) {
  if (leafletMap && typeof leafletMap.highlightQuakes === 'function') {
    leafletMap.highlightQuakes(quakeArray);
  }
  if (timeline && typeof timeline.highlightQuakes === 'function') {
    timeline.highlightQuakes(quakeArray);
  }
}

function updateAllVisualizations(data) {
  if (!data || !Array.isArray(data)) {
    console.error('Invalid data passed to updateAllVisualizations');
    return;
  }

  // Get the current chunk
  const currentChunk = timeChunks[currentIndex];
  const currentChunkTimeline = timeChunksTimeline[currentIndex] || currentChunk;

  // 1) Timeline: use the full data from the chunk.
  // Also, pass the chunk’s endDate so the timeline can extend its domain by 1 day.
  timeline.data = timeChunksTimeline[currentIndex].data;
  timeline.chunkEnd = currentChunkTimeline.endDate; // store chunk's end date on timeline
  timeline.updateVis();

  // 2) Map and bar chart: filter out events that occur on or after the chunk's end date.
  const filteredData = data.filter(d => d.time < currentChunk.endDate);

  leafletMap.data = filteredData;
  leafletMap.updateVis();

  magChart.data = filteredData;
  magChart.updateChart(selectedAttribute);
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
    const periodType = currentMode === 'monthly' ? 'Month' :
      currentMode === 'yearly' ? 'Year' : 'Week';
    dateText = `<strong>Year:</strong> ${chunk.year} | <strong>${periodType}:</strong> ${startStr} to ${endStr} | <strong>Earthquakes:</strong> ${chunk.data.length}`;
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

    d3.select('#year-slider').property('value', currentIndex).dispatch('input');
    // MODIFIED: Reapply magnitude filter on each new time chunk during animation.
    reapplyFilters();
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

function clearAllFilters() {
  // Clear timeline brush
  if (timeline && timeline.brushG && timeline.brush) {
    timeline.brushG.call(timeline.brush.move, null);
  }

  // Clear map brush
  if (leafletMap && leafletMap.brushGroup && leafletMap.brush) {
    leafletMap.brushGroup.call(leafletMap.brush.move, null);
  }

  // Reset map selection
  if (leafletMap && typeof leafletMap.resetEventHighlights === 'function') {
    leafletMap.resetEventHighlights();
  }

  // Reset bar chart selection
  if (magChart && typeof magChart.resetSelections === 'function') {
    magChart.resetSelections();
  } else if (magChart && typeof magChart.updateVis === 'function') {
    magChart.updateVis();
  }

  // Clear any cross-view linking
  updateLinkedSelections(null);

  // (Optional) Uncheck any other filters if necessary
  d3.selectAll('#mag-filter-panel input[type="checkbox"]').property('checked', false);
}

d3.select('#attribute-dropdown-map').on('change', function () {
  const newAttr = d3.select(this).property('value');
  leafletMap.setAttribute(newAttr);
});

d3.select('#clear-filters').on('click', clearAllFilters);

// Start the application
initialize();
