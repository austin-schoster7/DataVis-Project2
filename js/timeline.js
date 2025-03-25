class Timeline {
    constructor(_config, _data) {
      this.config = {
        parentElement: _config.parentElement,
        margin: { top: 20, right: 20, bottom: 30, left: 40 },
        width: 500,
        height: 300,
        ..._config
      };
      this.data = _data;
      this.initVis();
    }
  
    initVis() {
      const vis = this;
  
      vis.width = vis.config.width - vis.config.margin.left - vis.config.margin.right;
      vis.height = vis.config.height - vis.config.margin.top - vis.config.margin.bottom;
  
      // Create the SVG element within the timeline container
      vis.svg = d3.select(vis.config.parentElement)
        .append('svg')
        .attr('width', vis.config.width)
        .attr('height', vis.config.height)
        .append('g')
        .attr('transform', `translate(${vis.config.margin.left}, ${vis.config.margin.top})`);
  
      // Define scales for time (x) and quake count (y)
      vis.xScale = d3.scaleTime().range([0, vis.width]);
      vis.yScale = d3.scaleLinear().range([vis.height, 0]);
  
      // Define axes
      vis.xAxis = d3.axisBottom(vis.xScale).ticks(5);
      vis.yAxis = d3.axisLeft(vis.yScale).ticks(5);
  
      // Create groups for the axes
      vis.xAxisGroup = vis.svg.append('g')
        .attr('class', 'x-axis')
        .attr('transform', `translate(0, ${vis.height})`);
  
      vis.yAxisGroup = vis.svg.append('g')
        .attr('class', 'y-axis');
  
      // Call updateVis to draw the initial line chart
      vis.updateVis();
    }
  
    updateVis() {
      const vis = this;
  
      // 1) Group earthquakes by day using the parsed Date
      const grouped = d3.rollups(
        vis.data,
        v => v.length,
        d => +d3.timeDay.floor(new Date(d.time))
      );
  
      // Convert the grouped data into an array of objects with 'day' and 'count'
      vis.aggregatedData = grouped.map(([dayNumeric, count]) => ({
        day: new Date(dayNumeric),
        count
      }));
  
      // Sort the data by day
      vis.aggregatedData.sort((a, b) => d3.ascending(a.day, b.day));
  
      // 2) Update scales based on the aggregated data
      vis.xScale.domain(d3.extent(vis.aggregatedData, d => d.day));
      vis.yScale.domain([0, d3.max(vis.aggregatedData, d => d.count)]);
  
      // 3) Update axes with the new scales
      vis.xAxisGroup.call(vis.xAxis);
      vis.yAxisGroup.call(vis.yAxis);
  
      // 4) Create a line generator for the timeline
      const lineGenerator = d3.line()
        .x(d => vis.xScale(d.day))
        .y(d => vis.yScale(d.count));
  
      // Bind the aggregated data to a path element for the line chart.
      let path = vis.svg.selectAll('.line-chart').data([vis.aggregatedData]);
      path = path.join('path')
        .attr('class', 'line-chart')
        .attr('fill', 'none')
        .attr('stroke', 'steelblue')
        .attr('stroke-width', 2)
        .attr('d', lineGenerator);
  
      // 5) Optionally, add circles at each data point for enhanced tooltips
      let circles = vis.svg.selectAll('.data-point')
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
  