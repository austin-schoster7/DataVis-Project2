class MagnitudeChart {
    constructor(_config, _data) {
      this.config = {
        parentElement: _config.parentElement,
        margin: { top: 40, right: 30, bottom: 50, left: 60 },
        bins: 10,
        ..._config
      };
      this.data = _data;
      this.currentAttribute = 'mag';
  
      // Define an internal coordinate system
      this.internalWidth = 600;
      this.internalHeight = 400;
  
      // Variable to store the currently selected bin (if any)
      this.selectedBin = null;
  
      this.initVis();
    }
  
    initVis() {
      const vis = this;
  
      // Create responsive SVG using viewBox
      vis.svg = d3.select(vis.config.parentElement)
        .append('svg')
        .attr('viewBox', `0 0 ${vis.internalWidth} ${vis.internalHeight}`)
        .attr('preserveAspectRatio', 'xMidYMid meet')
        .classed('svg-content', true);
  
      // Calculate chart dimensions
      vis.width = vis.internalWidth - vis.config.margin.left - vis.config.margin.right;
      vis.height = vis.internalHeight - vis.config.margin.top - vis.config.margin.bottom;
  
      // Append group for the chart area
      vis.chartArea = vis.svg.append('g')
        .attr('transform', `translate(${vis.config.margin.left}, ${vis.config.margin.top})`);
  
      // Create scales
      vis.xScale = d3.scaleLinear().range([0, vis.width]);
      vis.yScale = d3.scaleLinear().range([vis.height, 0]);
  
      // Create histogram generator (domain/value will be set in updateVis)
      vis.histogram = d3.histogram().thresholds(10);
  
      // Axes
      vis.xAxis = d3.axisBottom(vis.xScale).ticks(5);
      vis.yAxis = d3.axisLeft(vis.yScale).ticks(5);
  
      vis.xAxisGroup = vis.chartArea.append('g')
        .attr('class', 'x-axis')
        .attr('transform', `translate(0, ${vis.height})`);
  
      vis.yAxisGroup = vis.chartArea.append('g')
        .attr('class', 'y-axis');
  
      // X-axis label
      vis.xLabel = vis.chartArea.append('text')
        .attr('class', 'axis-label')
        .attr('x', vis.width / 2)
        .attr('y', vis.height + 35)
        .style('text-anchor', 'middle')
        .text('Magnitude');
  
      // Y-axis label
      vis.yLabel = vis.chartArea.append('text')
        .attr('class', 'axis-label')
        .attr('transform', 'rotate(-90)')
        .attr('x', -vis.height / 2)
        .attr('y', -35)
        .style('text-anchor', 'middle')
        .text('Quakes');
  
      // Title
      vis.title = vis.chartArea.append('text')
        .attr('class', 'chart-title')
        .attr('x', vis.width / 2)
        .attr('y', -10)
        .style('text-anchor', 'middle')
        .style('font-size', '16px')
        .text('Histogram of Earthquakes by Magnitude');
  
      vis.updateVis();
    }
  
    updateVis() {
      const vis = this;
  
      // 1) Update xScale domain
      const attrExtent = d3.extent(vis.data, d => d[vis.currentAttribute]);
      vis.xScale.domain(attrExtent).nice();
  
      // 2) Create bins based on the current attribute
      vis.histogram
        .value(d => d[vis.currentAttribute])
        .domain(vis.xScale.domain());
      const bins = vis.histogram(vis.data);
  
      // 3) Update yScale domain
      vis.yScale.domain([0, d3.max(bins, d => d.length)]);
  
      // 4) Draw bars with pointer cursor and click handler
      vis.bars = vis.chartArea.selectAll('.bar')
        .data(bins)
        .join('rect')
          .attr('class', 'bar')
          .attr('x', d => vis.xScale(d.x0))
          .attr('width', d => Math.max(0, vis.xScale(d.x1) - vis.xScale(d.x0) - 1))
          .attr('y', d => vis.yScale(d.length))
          .attr('height', d => vis.height - vis.yScale(d.length))
          .attr('fill', d => 'teal')
          .style('cursor', 'pointer')
          .on('mouseover', (event, d) => {
            d3.select('#tooltip')
              .style('opacity', 1)
              .html(`
                <b>Range:</b> ${d.x0.toFixed(2)} - ${d.x1.toFixed(2)}<br>
                <b>Quakes:</b> ${d.length}
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
            // Check if there is already a selected bin and if its x0 and x1 match the clicked bin.
            if (vis.selectedBin && 
                vis.selectedBin.x0 === d.x0 && 
                vis.selectedBin.x1 === d.x1) {
              // Deselect: clear selectedBin, remove stroke highlight, and update linked views with no selection.
              vis.selectedBin = null;
              vis.chartArea.selectAll('.bar').attr('stroke', null);
              highlightSelectedQuakes(null);
            } else {
              // Select: store the selected bin and update the stroke of the selected bar.
              vis.selectedBin = d;
              vis.chartArea.selectAll('.bar').attr('stroke', null);
              d3.select(this)
                .attr('stroke', 'black')
                .attr('stroke-width', 2);
              // Dispatch selection to linked views with the quake array from the bin.
              highlightSelectedQuakes(d);
            }
          });
          
  
      // 5) Update axes
      vis.xAxisGroup.call(vis.xAxis);
      vis.yAxisGroup.call(vis.yAxis);
    }
  
    updateChart(newAttribute) {
      const vis = this;
      vis.currentAttribute = newAttribute;
  
      // Update axis labels and title based on attribute
      if (newAttribute === 'depth') {
        vis.xLabel.text('Depth (km)');
        vis.title.text('Histogram of Earthquakes by Depth');
      } else if (newAttribute === 'duration') {
        vis.xLabel.text('Duration');
        vis.title.text('Histogram of Earthquakes by Duration');
      } else {
        vis.xLabel.text('Magnitude');
        vis.title.text('Histogram of Earthquakes by Magnitude');
      }
  
      if (newAttribute === 'depth') {
        const sortedDepths = vis.data.map(d => d.depth).sort(d3.ascending);
        const cutoff = d3.quantile(sortedDepths, 0.99);
        vis.xScale.domain([0, cutoff]).nice();
        vis.histogram
          .value(d => d.depth)
          .domain(vis.xScale.domain())
          .thresholds(vis.xScale.ticks(30));
      } else {
        const attrExtent = d3.extent(vis.data, d => d[newAttribute]);
        vis.xScale.domain(attrExtent).nice();
        vis.histogram
          .value(d => d[newAttribute])
          .domain(vis.xScale.domain())
          .thresholds(vis.xScale.ticks(vis.config.bins));
      }
  
      vis.xAxis.scale(vis.xScale);
      vis.updateVis();
    }
  }
  