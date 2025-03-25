class MagnitudeChart {
    constructor(_config, _data) {
      this.config = {
        parentElement: _config.parentElement,
        margin: { top: 20, right: 20, bottom: 30, left: 40 },
        width: 500,
        height: 300,
        bins: 10,
        ..._config
      };
      this.data = _data;
      this.initVis();
    }
  
    initVis() {
      const vis = this;
      vis.width = vis.config.width - vis.config.margin.left - vis.config.margin.right;
      vis.height = vis.config.height - vis.config.margin.top - vis.config.margin.bottom;
  
      vis.svg = d3.select(vis.config.parentElement).append('svg')
        .attr('width', vis.config.width)
        .attr('height', vis.config.height)
        .append('g')
        .attr('transform', `translate(${vis.config.margin.left}, ${vis.config.margin.top})`);
  
      // xScale for magnitude
      const magExtent = d3.extent(vis.data, d => d.mag);
      vis.xScale = d3.scaleLinear()
        .domain(magExtent)
        .range([0, vis.width])
        .nice();
  
      // create bins
      vis.histogram = d3.histogram()
        .value(d => d.mag)
        .domain(vis.xScale.domain())
        .thresholds(vis.xScale.ticks(vis.config.bins));
  
      vis.yScale = d3.scaleLinear().range([vis.height, 0]);
  
      // Axes
      vis.xAxis = d3.axisBottom(vis.xScale).ticks(5);
      vis.yAxis = d3.axisLeft(vis.yScale).ticks(5);
  
      vis.xAxisGroup = vis.svg.append('g')
        .attr('class', 'x-axis')
        .attr('transform', `translate(0, ${vis.height})`);
  
      vis.yAxisGroup = vis.svg.append('g').attr('class', 'y-axis');
  
      vis.updateVis();
    }
  
    updateVis() {
      const vis = this;
      // bin the data
      const bins = vis.histogram(vis.data);
      vis.yScale.domain([0, d3.max(bins, d => d.length)]);
  
      // draw rects
      vis.bars = vis.svg.selectAll('.bar')
        .data(bins)
        .join('rect')
          .attr('class', 'bar')
          .attr('x', d => vis.xScale(d.x0))
          .attr('width', d => Math.max(0, vis.xScale(d.x1) - vis.xScale(d.x0) - 1))
          .attr('y', d => vis.yScale(d.length))
          .attr('height', d => vis.height - vis.yScale(d.length))
          .attr('fill', 'teal');
  
      // axes
      vis.xAxisGroup.call(vis.xAxis);
      vis.yAxisGroup.call(vis.yAxis);
    }
  }
  