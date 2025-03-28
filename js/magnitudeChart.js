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
  
      this.initVis();
    }
  
    initVis() {
      const vis = this;
  
      // Create a responsive SVG with a fixed "internal" coordinate system
      vis.svg = d3.select(vis.config.parentElement)
        .append('svg')
        .attr('viewBox', `0 0 ${vis.internalWidth} ${vis.internalHeight}`)
        .attr('preserveAspectRatio', 'xMidYMid meet')
        .classed('svg-content', true);
  
      // Now define the actual width/height for the chart area minus margins
      vis.width = vis.internalWidth - vis.config.margin.left - vis.config.margin.right;
      vis.height = vis.internalHeight - vis.config.margin.top - vis.config.margin.bottom;
  
      // Append a <g> for the "chart area" that accounts for margins
      vis.chartArea = vis.svg.append('g')
        .attr('transform', `translate(${vis.config.margin.left}, ${vis.config.margin.top})`);
  
      // Create scales
      vis.xScale = d3.scaleLinear().range([0, vis.width]);
      vis.yScale = d3.scaleLinear().range([vis.height, 0]);
  
      // Create histogram generator
      vis.histogram = d3.histogram().thresholds(10); // We’ll set domain/value in updateVis
  
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
        .attr('y', vis.height + 35) // below x-axis
        .style('text-anchor', 'middle')
        .text('Magnitude');
  
      // Y-axis label
      vis.yLabel = vis.chartArea.append('text')
        .attr('class', 'axis-label')
        .attr('transform', 'rotate(-90)')
        .attr('x', -vis.height / 2)
        .attr('y', -35) // push it out from the axis
        .style('text-anchor', 'middle')
        .text('Count');
  
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
  
      // 1) Update xScale domain based on currentAttribute
      const attrExtent = d3.extent(vis.data, d => d[vis.currentAttribute]);
      vis.xScale.domain(attrExtent).nice();
  
      // 2) Create bins
      vis.histogram
        .value(d => d[vis.currentAttribute])
        .domain(vis.xScale.domain());
  
      const bins = vis.histogram(vis.data);
  
      // 3) Update yScale domain
      vis.yScale.domain([0, d3.max(bins, d => d.length)]);
  
      // 4) Draw bars
      vis.bars = vis.chartArea.selectAll('.bar')
        .data(bins)
        .join('rect')
          .attr('class', 'bar')
          .attr('x', d => vis.xScale(d.x0))
          .attr('width', d => Math.max(0, vis.xScale(d.x1) - vis.xScale(d.x0) - 1))
          .attr('y', d => vis.yScale(d.length))
          .attr('height', d => vis.height - vis.yScale(d.length))
          .attr('fill', 'teal')
          // Tooltip
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
            d3.select('#tooltip')
              .style('opacity', 0);
          });
  
      // 5) Update axes
      vis.xAxisGroup.call(vis.xAxis);
      vis.yAxisGroup.call(vis.yAxis);
    }
  
    // Method to update the chart when a new attribute is selected
    updateChart(newAttribute) {
        const vis = this;
        vis.currentAttribute = newAttribute;
      
        // Update x-axis label and chart title based on the attribute
        if (newAttribute === 'depth') {
          vis.xLabel.text('Depth (km)');
          vis.title.text('Histogram of Earthquakes by Depth');
        } else if (newAttribute === 'duration') {
          vis.xLabel.text('Duration');
          vis.title.text('Histogram of Earthquakes by Duration');
        } else {
          // default to magnitude
          vis.xLabel.text('Magnitude');
          vis.title.text('Histogram of Earthquakes by Magnitude');
        }
      
        // Then apply domain logic
        if (newAttribute === 'depth') {
          // Example: clamp domain to ignore top outliers
          const sortedDepths = vis.data.map(d => d.depth).sort(d3.ascending);
          const cutoff = d3.quantile(sortedDepths, 0.99); // 99th percentile
          vis.xScale.domain([0, cutoff]).nice();
      
          // Use more bins if desired
          vis.histogram
            .value(d => d.depth)
            .domain(vis.xScale.domain())
            .thresholds(vis.xScale.ticks(30)); // 30 bins
        } else {
          // Default approach for magnitude (or other attributes)
          const attrExtent = d3.extent(vis.data, d => d[newAttribute]);
          vis.xScale.domain(attrExtent).nice();
      
          vis.histogram
            .value(d => d[newAttribute])
            .domain(vis.xScale.domain())
            .thresholds(vis.xScale.ticks(vis.config.bins));
        }
      
        // Update the x-axis scale
        vis.xAxis.scale(vis.xScale);
      
        // Redraw
        vis.updateVis();
      }      
      
  }
  