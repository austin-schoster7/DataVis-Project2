class Timeline {
    constructor(_config, _data) {
      this.config = {
        parentElement: _config.parentElement,
        margin: { top: 40, right: 30, bottom: 50, left: 60 },
        ..._config
      };
      this.data = _data;
  
      this.internalWidth = 600;
      this.internalHeight = 400;
  
      this.initVis();
    }
  
    initVis() {
      const vis = this;
  
      // Create the responsive SVG
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
  
      // Labels
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
  
      vis.updateVis();
    }
  
    updateVis() {
      const vis = this;
  
      // Example: group by day
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
  
      // Scales
      vis.xScale.domain(d3.extent(vis.aggregatedData, d => d.day));
      vis.yScale.domain([0, d3.max(vis.aggregatedData, d => d.count)]);
  
      // Axes
      vis.xAxisGroup.call(vis.xAxis);
      vis.yAxisGroup.call(vis.yAxis);
  
      // Line generator
      const lineGenerator = d3.line()
        .x(d => vis.xScale(d.day))
        .y(d => vis.yScale(d.count));
  
      // Draw the path
      let path = vis.chartArea.selectAll('.line-chart')
        .data([vis.aggregatedData]);
      path.join('path')
        .attr('class', 'line-chart')
        .attr('fill', 'none')
        .attr('stroke', 'steelblue')
        .attr('stroke-width', 2)
        .attr('d', lineGenerator);
  
      // Circles for tooltip
      let circles = vis.chartArea.selectAll('.data-point')
        .data(vis.aggregatedData, d => d.day);
  
      circles.join('circle')
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
    }
  }
  