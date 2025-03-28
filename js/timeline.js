class Timeline {
    constructor(_config, _data, dispatcher) {
      this.config = {
        parentElement: _config.parentElement,
        margin: { top: 40, right: 30, bottom: 50, left: 60 },
        ..._config
      };
      this.data = _data;
      this.dispatcher = dispatcher; // We'll use this to dispatch brush events

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
  
      vis.aggregatedData = grouped.map(([dayNumeric, count]) => ({
        day: new Date(dayNumeric),
        count
      }));
      vis.aggregatedData.sort((a, b) => d3.ascending(a.day, b.day));
  
      // 2) Update scales
      vis.xScale.domain(d3.extent(vis.aggregatedData, d => d.day));
      vis.yScale.domain([0, d3.max(vis.aggregatedData, d => d.count)]);
  
      // 3) Update axes
      vis.xAxisGroup.call(vis.xAxis);
      vis.yAxisGroup.call(vis.yAxis);
  
      // 4) Line generator
      const lineGenerator = d3.line()
        .x(d => vis.xScale(d.day))
        .y(d => vis.yScale(d.count));
  
      // 5) Draw the line path
      vis.chartArea.selectAll('.line-chart')
        .data([vis.aggregatedData])
        .join('path')
        .attr('class', 'line-chart')
        .attr('fill', 'none')
        .attr('stroke', 'steelblue')
        .attr('stroke-width', 2)
        .attr('d', lineGenerator);
  
      // 6) Circles for tooltips
      vis.chartArea.selectAll('.data-point')
        .data(vis.aggregatedData, d => d.day)
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
          d3.select('#tooltip')
            .style('opacity', 0);
        });
  
      // Reset brush if to clear it after each update
      // vis.brushG.call(vis.brush.move, null);
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
  }
  