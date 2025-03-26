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
      // default attribute is 'mag'
      this.currentAttribute = 'mag';
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
  
      // xScale based on current attribute
      const attrExtent = d3.extent(vis.data, d => d[vis.currentAttribute]);
      vis.xScale = d3.scaleLinear()
        .domain(attrExtent)
        .range([0, vis.width])
        .nice();
  
      // create histogram
      vis.histogram = d3.histogram()
        .value(d => d[vis.currentAttribute])
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
      const bins = vis.histogram(vis.data);
      vis.yScale.domain([0, d3.max(bins, d => d.length)]);
  
      // We'll create a simple lookup for attribute labels
      const attributeLabels = {
        mag: 'Magnitude',
        depth: 'Depth',
      };
      const currentLabel = attributeLabels[vis.currentAttribute] || 'Value';
  
      // draw rects
      vis.bars = vis.svg.selectAll('.bar')
        .data(bins)
        .join('rect')
          .attr('class', 'bar')
          .attr('x', d => vis.xScale(d.x0))
          .attr('width', d => Math.max(0, vis.xScale(d.x1) - vis.xScale(d.x0) - 1))
          .attr('y', d => vis.yScale(d.length))
          .attr('height', d => vis.height - vis.yScale(d.length))
          .attr('fill', 'teal')
          // Tooltip handlers:
          .on('mouseover', (event, d) => {
            d3.select('#tooltip')
              .style('opacity', 1)
              .html(`
                <b>${currentLabel} range:</b> ${d.x0.toFixed(2)} - ${d.x1.toFixed(2)}<br>
                <b>Count:</b> ${d.length}
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
  
      // Update axes
      vis.xAxisGroup.call(vis.xAxis);
      vis.yAxisGroup.call(vis.yAxis);
    }
  
    // Method to update the chart when a new attribute is selected
    updateChart(newAttribute) {
        const vis = this;
        vis.currentAttribute = newAttribute;
      
        if (newAttribute === 'depth') {
          // Clamp domain to ignore the top 1% outliers
          const sortedDepths = vis.data.map(d => d.depth).sort(d3.ascending);
          const cutoff = d3.quantile(sortedDepths, 0.99);
          vis.xScale.domain([0, cutoff]).nice();
      
          // Or just do a normal extent if you prefer:
          // const extent = d3.extent(vis.data, d => d.depth);
          // vis.xScale.domain(extent).nice();
      
          // Use more bins
          vis.histogram
            .value(d => d.depth)
            .domain(vis.xScale.domain())
            .thresholds(vis.xScale.ticks(30)); // 30 bins
        } else {
          // default approach for magnitude, duration, etc.
          const attrExtent = d3.extent(vis.data, d => d[newAttribute]);
          vis.xScale.domain(attrExtent).nice();
          vis.histogram
            .value(d => d[newAttribute])
            .domain(vis.xScale.domain())
            .thresholds(vis.xScale.ticks(vis.config.bins));
        }
      
        // Update the x-axis
        vis.xAxis.scale(vis.xScale);
        // Redraw
        vis.updateVis();
      }
      
  }
  