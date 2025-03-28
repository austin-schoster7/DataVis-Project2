class Timeline {
    constructor(_config, _data, dispatcher) {
      this.config = {
        parentElement: _config.parentElement,
        margin: { top: 40, right: 30, bottom: 50, left: 60 },
        ..._config
      };
      this.data = _data;
      this.dispatcher = dispatcher;

      this.internalWidth = 600;
      this.internalHeight = 400;
  
      this.initVis();
    }
  
    initVis() {
      const vis = this;
  
      // Create a responsive SVG
      vis.svg = d3.select(vis.config.parentElement)
        .append('svg')
        .attr('viewBox', `0 0 ${vis.internalWidth} ${vis.internalHeight}`)
        .attr('preserveAspectRatio', 'xMidYMid meet')
        .classed('svg-content', true);
  
      // Chart area
      vis.width = vis.internalWidth - vis.config.margin.left - vis.config.margin.right;
      vis.height = vis.internalHeight - vis.config.margin.top - vis.config.margin.bottom;
  
      vis.chartArea = vis.svg.append('g')
        .attr('transform', `translate(${vis.config.margin.left}, ${vis.config.margin.top})`);
  
      // Define scales
      vis.xScale = d3.scaleTime().range([0, vis.width]);
      vis.yScale = d3.scaleLinear().range([vis.height, 0]);
  
      // Define axes
      vis.xAxis = d3.axisBottom(vis.xScale).ticks(5);
      vis.yAxis = d3.axisLeft(vis.yScale).ticks(5);
  
      // Axis groups
      vis.xAxisGroup = vis.chartArea.append('g')
        .attr('class', 'x-axis')
        .attr('transform', `translate(0, ${vis.height})`);
  
      vis.yAxisGroup = vis.chartArea.append('g')
        .attr('class', 'y-axis');
  
      // Axis labels
      vis.xAxisLabel = vis.chartArea.append('text')
        .attr('x', vis.width / 2)
        .attr('y', vis.height + 35)
        .style('text-anchor', 'middle')
        .text('Date');
  
      vis.yAxisLabel = vis.chartArea.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('x', -vis.height / 2)
        .attr('y', -35)
        .style('text-anchor', 'middle')
        .text('Magnitude');
  
      // Title
      vis.title = vis.chartArea.append('text')
        .attr('x', vis.width / 2)
        .attr('y', -10)
        .style('text-anchor', 'middle')
        .style('font-size', '16px')
        .text('Earthquakes Over Time');
  
      // Define the brush
      vis.brush = d3.brushX()
        .extent([[0, 0], [vis.width, vis.height]])
        .on('end', (event) => vis.brushed(event));
  
      // Add a brush group
      vis.brushG = vis.chartArea.append('g')
        .attr('class', 'brush')
        .call(vis.brush);
  
      vis.updateVis();
    }
  
    updateVis() {
        const vis = this;
      
        // 1) Group data by day
        const grouped = d3.rollups(
          vis.data,
          v => v.length,
          d => +d3.timeDay.floor(new Date(d.time))
        );
        let aggregatedData = grouped.map(([dayNumeric, count]) => ({
          day: new Date(dayNumeric),
          count
        }));
        aggregatedData.sort((a, b) => d3.ascending(a.day, b.day));
      
        // 2) Determine the domain for the x-scale.
        // Get the min date from aggregated data:
        const minDate = d3.min(aggregatedData, d => d.day);
      
        // Get the maximum date from the aggregated data:
        let computedMax = d3.max(aggregatedData, d => d.day);
        
        // If we have a chunkEnd provided (from main.js), extend that by one day.
        // Otherwise, extend the computed maximum by one day.
        let extendedMax;
        if (vis.chunkEnd && vis.chunkEnd.getTime() > computedMax.getTime()) {
          extendedMax = new Date(vis.chunkEnd.getTime() + 24*60*60*1000);
        } else {
          extendedMax = new Date(computedMax.getTime() + 24*60*60*1000);
        }
      
        // 3) Update the xScale and yScale domains.
        vis.xScale.domain([minDate, extendedMax]);
        vis.yScale.domain([0, d3.max(aggregatedData, d => d.count)]);
      
        // 4) Update axes
        vis.xAxisGroup.call(vis.xAxis);
        vis.yAxisGroup.call(vis.yAxis);
      
        // 5) Draw the line
        const lineGenerator = d3.line()
          .x(d => vis.xScale(d.day))
          .y(d => vis.yScale(d.count));
      
        vis.chartArea.selectAll('.line-chart')
          .data([aggregatedData])
          .join('path')
          .attr('class', 'line-chart')
          .attr('fill', 'none')
          .attr('stroke', 'steelblue')
          .attr('stroke-width', 2)
          .attr('d', lineGenerator);
      
        // 6) Draw circles for data points
        vis.chartArea.selectAll('.data-point')
          .data(aggregatedData, d => d.day)
          .join('circle')
          .attr('class', 'data-point')
          .attr('cx', d => vis.xScale(d.day))
          .attr('cy', d => vis.yScale(d.count))
          .attr('r', 3)
          .attr('fill', 'steelblue')
          .on('mouseover', (event, d) => {
            d3.select('#tooltip')
              .style('opacity', 1)
              .html(`
                <b>Date:</b> ${d.day.toDateString()}<br>
                <b>Quakes:</b> ${d.count}
              `);
          })
          .on('mousemove', (event) => {
            d3.select('#tooltip')
              .style('left', (event.pageX + 10) + 'px')
              .style('top', (event.pageY + 10) + 'px');
          })
          .on('mouseleave', () => {
            d3.select('#tooltip').style('opacity', 0);
          });
    }
  
    brushed(event) {
        const vis = this;
        if (!event.selection) {
          // Brush cleared => notify and update display accordingly
          vis.dispatcher.call('brushRange', this, null);
          d3.select('#brush-range-display').text('Selected Range: (none)');
          return;
        }
      
        const [x0, x1] = event.selection;
        const startDate = vis.xScale.invert(x0);
        const endDate = vis.xScale.invert(x1);
      
        // Update the display with formatted dates
        d3.select('#brush-range-display')
          .text(`Selected Range: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`);
      
        // Dispatch event to update the other visualizations
        vis.dispatcher.call('brushRange', this, [startDate, endDate]);
    }

    highlightSelection(selectedEvent) {
        const dayInMs = 24 * 60 * 60 * 1000;
        this.chartArea.selectAll('.data-point')
          .attr('fill', d => {
            if (!selectedEvent) return 'steelblue';
            const diff = d.day.getTime() - selectedEvent.time.getTime();
            if (Math.abs(diff) <= dayInMs) return diff < 0 ? '#4CAF50' : '#2196F3';
            return 'steelblue';
        });
    }

    setBrushRange(startDate, endDate) {
        // 1) Convert to numeric timestamps
        let startT = startDate.getTime();
        let endT = endDate.getTime();
      
        // 2) Get the domain of the xScale (the min/max date in the timeline)
        const [domainMin, domainMax] = this.xScale.domain(); 
        const domainMinT = domainMin.getTime();
        const domainMaxT = domainMax.getTime();
      
        // 3) Clamp the requested start/end to the domain
        if (startT < domainMinT) startT = domainMinT;
        if (endT > domainMaxT) endT = domainMaxT;
      
        // If the quake's range is entirely out of domain, clear the brush
        if (endT < startT) {
          this.brushG.call(this.brush.move, null);
          return;
        }
      
        // 4) Convert the clamped timestamps back to Date objects
        const clampedStart = new Date(startT);
        const clampedEnd = new Date(endT);
      
        // 5) Map those dates to x-scale pixel coordinates
        let x0 = this.xScale(clampedStart);
        let x1 = this.xScale(clampedEnd);
      
        // 6) Clamp the pixel coordinates to [0, this.width]
        x0 = Math.max(0, Math.min(x0, this.width));
        x1 = Math.max(0, Math.min(x1, this.width));
      
        // If the resulting pixel range is invalid or zero-length, clear the brush
        if (x1 <= x0) {
          this.brushG.call(this.brush.move, null);
          return;
        }
      
        // 7) Finally, move the brush to [x0, x1]
        this.brushG.call(this.brush.move, [x0, x1]);
    }      
  }
  