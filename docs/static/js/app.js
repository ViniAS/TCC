// --- Setup ---
const width = 800;
const height = 600;
const svg = d3.select("#map");
const projection = d3.geoMercator().center([-54, -15]).scale(750).translate([width / 2, height / 2]);
const path = d3.geoPath().projection(projection);
const mapGroup = svg.append("g");
const lineGroup = svg.append("g");

const fourColors = ['#d9d9d9', '#c4c4c4', '#afafaf', '#9a9a9a'];

const stateColorMapping = {
  '12': 0, '27': 1, '16': 2, '13': 3, '29': 3, '23': 2, '53': 0, '32': 1, 
  '52': 1, '21': 0, '51': 0, '50': 3, '31': 2, '15': 1, '25': 3, '41': 1, 
  '26': 0, '22': 1, '33': 3, '24': 0, '43': 0, '11': 2, '14': 2, '42': 2, 
  '28': 0, '35': 0, '17': 2
};

// Define the arrowhead marker
svg.append("defs").append("marker")
    .attr("id", "arrowhead")
    .attr("viewBox", "0 -5 10 10")          
    .attr("refX", 10)                       
    .attr("refY", 0)
    .attr("markerUnits", "userSpaceOnUse")  
    .attr("markerWidth", 10)                
    .attr("markerHeight", 10)               
    .attr("orient", "auto")                 
    .attr("opacity", 0.8)
  .append("svg:path")
    .attr("d", "M0,-5L10,0L0,5")            
    .attr("fill", "#ff4136");

const zoom = d3.zoom().scaleExtent([1, 8]).on("zoom", (event) => {
    mapGroup.attr("transform", event.transform);
    lineGroup.attr("transform", event.transform);
});
svg.call(zoom);

d3.select("#reset-zoom-map").on("click", () => {
    svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity);
});

// --- Data Loading ---
Promise.all([
    d3.json("static/data/brazil_municipalities.geojson"),
    d3.csv("static/data/graph.csv"),
    d3.json("static/data/brazil-states.geojson"),
    d3.csv("static/data/states_graph.csv"),
    
]).then(([muniGeo, muniData, stateGeo, stateData]) => {

    d3.select("#show-munis").on("click", () => {
        drawMunicipalities(muniGeo, muniData);
        d3.select("#show-munis").classed("active", true);
        d3.select("#show-states").classed("active", false);
    });

    d3.select("#show-states").on("click", () => {
        drawStates(stateGeo, stateData);
        d3.select("#show-states").classed("active", true);
        d3.select("#show-munis").classed("active", false);
    });

    drawMunicipalities(muniGeo, muniData);

    // Compute weighted mean per municipality
    const muniGroups = d3.group(muniData, d => d.MUNIC_RES, d => d.UF_RES);

    // Flatten to array of {MUNIC_RES, UF_RES, WEIGHTED_MEAN_DIST}
    let weightedMeans = [];
    muniGroups.forEach((ufMap, muni) => {
        ufMap.forEach((rows, uf) => {
            // Only consider rows with valid DIST_KM and HOSPITALIZACOES
            const validRows = rows.filter(d => d.DIST_KM && d.HOSPITALIZACOES && !isNaN(+d.DIST_KM) && !isNaN(+d.HOSPITALIZACOES));
            const totalHosp = d3.sum(validRows, d => +d.HOSPITALIZACOES);
            const weightedSum = d3.sum(validRows, d => +d.DIST_KM * +d.HOSPITALIZACOES);
            if (totalHosp > 0) {
                weightedMeans.push({
                    MUNIC_RES: muni,
                    UF_RES: uf,
                    WEIGHTED_MEAN_DIST: weightedSum / totalHosp
                });
            }
        });
    });

    // Populate dropdown with states
    const states = Array.from(new Set(weightedMeans.map(d => d.UF_RES))).sort();
    const select = d3.select("#state-select");
    states.forEach(state => {
        select.append("option").attr("value", state).text(state);
    });

    // Draw initial histogram (all states)
    drawHistogram(weightedMeans);

    drawChoropleth(muniGeo, weightedMeans, stateGeo);

    // Update histogram on dropdown change
    select.on("change", function() {
        const selected = this.value;
        if (selected === "ALL") {
            drawHistogram(weightedMeans);
        } else {
            drawHistogram(weightedMeans.filter(d => d.UF_RES === selected));
        }
    });

}).catch(error => console.error("Error loading the data:", error));


function drawLineWidthLegend(svgSelector, minHosp, maxHosp, scaleFn) {
    // Remove any previous legend
    d3.select(svgSelector).selectAll(".line-width-legend").remove();

    const legendData = [minHosp, Math.round((minHosp + maxHosp) / 4), Math.round((minHosp + maxHosp) / 2), maxHosp];
    const legendWidth = 220;
    const legendHeight = 60;
    const xStart = 40;
    const yStart = 20;
    const spacing = 50;

    const legendGroup = d3.select(svgSelector)
        .append("g")
        .attr("class", "line-width-legend")
        .attr("transform", `translate(20,${+d3.select(svgSelector).attr("height") - legendHeight - 10})`);

    legendGroup.append("text")
        .attr("x", 0)
        .attr("y", 0)
        .attr("font-size", 13)
        .attr("font-weight", "bold")
        .text("Hospitalizações (largura da linha)");

    legendData.forEach((hosp, i) => {
        legendGroup.append("line")
            .attr("x1", xStart + i * spacing)
            .attr("x2", xStart + i * spacing + 30)
            .attr("y1", yStart)
            .attr("y2", yStart)
            .attr("stroke", "#ff4136")
            .attr("stroke-width", scaleFn(hosp))
            .attr("stroke-opacity", 0.6);

        legendGroup.append("text")
            .attr("x", xStart + i * spacing + 15)
            .attr("y", yStart + 18)
            .attr("text-anchor", "middle")
            .attr("font-size", 12)
            .text(hosp);
    });
}


// --- Drawing Function for States ---
function drawStates(geojson, mobilityData) {
    mapGroup.html("");
    lineGroup.html("");
    
    mapGroup.selectAll("path")
        .data(geojson.features)
        .enter().append("path")
        .attr("d", path)
        .attr("class", "municipality")
        .attr("data-code", d => d.properties.name_state)
        .style("fill", d => {
            const stateCode = d.properties.code_state; // The state's unique IBGE code
            return fourColors[stateColorMapping[stateCode]];
        }) 
        .on("click", handleClick)
        .append("title")
        .text(d => d.properties.name_state);

    const hospVals = mobilityData.map(d => +d.HOSPITALIZACOES).filter(d => !isNaN(d));
    const minHosp = d3.min(hospVals);
    const maxHosp = d3.max(hospVals);

    
    const widthScale = d3.scaleSqrt()
        .domain([minHosp, maxHosp])
        .range([1, 8]);

    function drawConnectionLines(connections) {
        lineGroup.html("");
        lineGroup.selectAll("path.connection-line")
            .data(connections)
            .enter()
            .append("path")
            .attr("class", "connection-line")
            .attr("d", d => {
                const start = projection([+d.RES_LON, +d.RES_LAT]);
                const end = projection([+d.MOV_LON, +d.MOV_LAT]);
                if (!start || !end) return null;
                const dx = end[0] - start[0], dy = end[1] - start[1];
                const dr = Math.sqrt(dx * dx + dy * dy);
                return `M${start[0]},${start[1]}A${dr},${dr} 0 0,1 ${end[0]},${end[1]}`;
            })
            .attr("marker-end", "url(#arrowhead)")
            .style("stroke-width", d => widthScale(+d.HOSPITALIZACOES));
    }

    drawConnectionLines(mobilityData);

    function handleClick(event, d) {
        const clickedStateName = d.properties.name_state;
        d3.select(this.parentNode).selectAll('path').classed('selected', false);
        d3.select(this).classed('selected', true);
        const filteredConnections = mobilityData.filter(link => link.UF_RES === clickedStateName);
        drawConnectionLines(filteredConnections);
    }

    
    drawLineWidthLegend("#map", minHosp, maxHosp, widthScale);
}


// --- Drawing Function for Municipalities ---
function drawMunicipalities(geojson, mobilityData) {

    mapGroup.html("");
    lineGroup.html("");
    mapGroup.selectAll("path")
        .data(geojson.features)
        .enter().append("path")
        .attr("d", path)
        .attr("class", "municipality")
        .attr("data-code", d => d.properties.CD_MUN)
        .style("fill", d => {
            const stateCode = d.properties.CD_UF; 
            return fourColors[stateColorMapping[stateCode]];
        })
        .on("click", handleClick)
        .append("title")
        .text(d => d.properties.NM_MUN);

    const hospVals = mobilityData.map(d => +d.HOSPITALIZACOES).filter(d => !isNaN(d));
    const minHosp = d3.min(hospVals);
    const maxHosp = d3.max(hospVals);

    // Use a D3 scale for width
    const widthScale = d3.scaleSqrt()
        .domain([minHosp, maxHosp])
        .range([1, 5]);

    function handleClick(event, d) {
        const clickedMuniCode = d.properties.CD_MUN;
        d3.select(this.parentNode).selectAll('path').classed('selected', false);
        d3.select(this).classed('selected', true);
        lineGroup.html("");

        const connections = mobilityData.filter(link => link.CD_MUN_RES == clickedMuniCode);

        connections.forEach(conn => {
            const start = projection([+conn.RES_LON, +conn.RES_LAT]);
            const end = projection([+conn.MOV_LON, +conn.MOV_LAT]);
            if (start && end) {
                lineGroup.append("line")
                    .attr("x1", start[0]).attr("y1", start[1])
                    .attr("x2", end[0]).attr("y2", end[1])
                    .attr("class", "connection-line") // The CSS class provides the opacity
                    .style("stroke-width", widthScale(+conn.HOSPITALIZACOES));
            }
        });
    }

    drawLineWidthLegend("#map", minHosp, maxHosp, widthScale);
}

function drawHistogram(data) {
    const svg = d3.select("#histogram");
    svg.selectAll("*").remove();

    const margin = {top: 40, right: 30, bottom: 50, left: 60},
        width = +svg.attr("width") - margin.left - margin.right,
        height = +svg.attr("height") - margin.top - margin.bottom;

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    // Parse values
    const values = data.map(d => +d.WEIGHTED_MEAN_DIST).filter(d => !isNaN(d));

    // X scale
    const x = d3.scaleLinear()
        .domain([0, d3.max(values)])
        .range([0, width]);

    // Histogram bins
    const bins = d3.bin()
        .domain(x.domain())
        .thresholds(40)(values);

    // Y scale
    const y = d3.scaleLinear()
        .domain([0, d3.max(bins, d => d.length)])
        .nice()
        .range([height, 0]);

    // Bars
    g.selectAll("rect")
        .data(bins)
        .enter().append("rect")
        .attr("x", d => x(d.x0))
        .attr("y", d => y(d.length))
        .attr("width", d => Math.max(0, x(d.x1) - x(d.x0) - 1))
        .attr("height", d => height - y(d.length))
        .attr("fill", "#0074D9")
        .attr("stroke", "#fff");

    // X Axis
    g.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x));

    // Y Axis
    g.append("g")
        .call(d3.axisLeft(y));

    // Labels
    svg.append("text")
        .attr("x", margin.left + width / 2)
        .attr("y", margin.top / 2)
        .attr("text-anchor", "middle")
        .attr("font-size", "18px")
        .text(`Distâncias Médias Viajadas por Município (média = ${d3.mean(values).toFixed(2)} km)`);

    svg.append("text")
        .attr("x", margin.left + width / 2)
        .attr("y", height + margin.top + margin.bottom - 10)
        .attr("text-anchor", "middle")
        .attr("font-size", "14px")
        .text("Distância Média Ponderada (km)");

    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", 20)
        .attr("x", -(margin.top + height / 2))
        .attr("text-anchor", "middle")
        .attr("font-size", "14px")
        .text("Frequência");
}


function drawChoropleth(geojson, weightedMeans, state) {
    const svg = d3.select("#choropleth");
    svg.selectAll("*").remove();

    const width = +svg.attr("width");
    const height = +svg.attr("height");
    const projection = d3.geoMercator().center([-54, -15]).scale(750).translate([width / 2, height / 2]);
    const path = d3.geoPath().projection(projection);

    // Create a group for zooming
    const mapGroup = svg.append("g").attr("class", "choropleth-map-group");

    // D3 zoom behavior
    const zoom = d3.zoom()
        .scaleExtent([1, 8])
        .on("zoom", (event) => {
            mapGroup.attr("transform", event.transform);
        });
    svg.call(zoom);

    d3.select("#reset-zoom-choropleth").on("click", () => {
        svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity);
    });

    // Create a lookup for weighted mean by municipality name
    const meanByMuni = new Map(weightedMeans.map(d => [d.MUNIC_RES, d.WEIGHTED_MEAN_DIST]));

    // Compute color scale (logarithmic)
    const values = weightedMeans.map(d => d.WEIGHTED_MEAN_DIST).filter(d => !isNaN(d) && d > 0);
    const minVal = d3.min(values);
    const maxVal = d3.max(values);
    const color = d3.scaleSequentialLog(d3.interpolateViridis)
        .domain([minVal, maxVal]);

    // Draw municipalities
    mapGroup.append("g")
        .selectAll("path")
        .data(geojson.features)
        .enter().append("path")
        .attr("d", path)
        .attr("fill", d => {
            const val = meanByMuni.get(d.properties.NM_MUN + " - " + d.properties.NM_UF);
            return (val !== undefined && val > 0) ? color(val) : "#eee";
        })
        .attr("stroke", "#fff")
        .attr("stroke-width", 0.2)
        .append("title")
        .text(d => {
            const val = meanByMuni.get(d.properties.NM_MUN + " - " + d.properties.NM_UF);
            return `${d.properties.NM_MUN} - ${d.properties.NM_UF}\nDistância média: ${val !== undefined ? val.toFixed(2) + " km" : "sem dados"}`;
        });

    // Draw state borders on top
    mapGroup.append("g")
        .selectAll("path")
        .data(state.features)
        .enter().append("path")
        .attr("d", path)
        .attr("fill", "none")
        .attr("stroke", "#000")
        .attr("stroke-width", 0.5);

    // Add a color legend (log scale)
    const legendWidth = 300, legendHeight = 12;
    const legendSvg = svg.append("g")
        .attr("transform", `translate(${width - legendWidth - 40},${height - 40})`);

    // Add legend title above the legendSvg
    svg.append("text")
        .attr("x", width - legendWidth - 40 + legendWidth / 2)
        .attr("y", height - 48)
        .attr("text-anchor", "middle")
        .attr("font-size", 14)
        .text("Distância Média Viajada (Escala Log)");

    const defs = svg.append("defs");
    const linearGradient = defs.append("linearGradient")
        .attr("id", "legend-gradient");
    linearGradient.selectAll("stop")
        .data(d3.range(0, 1.01, 0.01))
        .enter().append("stop")
        .attr("offset", d => `${d * 100}%`)
        .attr("stop-color", d => color(minVal * Math.pow(maxVal / minVal, d)));
~
    legendSvg.append("rect")
        .attr("width", legendWidth)
        .attr("height", legendHeight)
        .style("fill", "url(#legend-gradient)");

    // Legend axis (log scale)
    const legendScale = d3.scaleLog()
        .domain([minVal, maxVal])
        .range([0, legendWidth]);
    const legendAxis = d3.axisBottom(legendScale)
        .ticks(4, "~g") 
        .tickFormat(d => d.toFixed(0) + " km")
        .tickPadding(6);

    legendSvg.append("g")
        .attr("transform", `translate(0,${legendHeight})`)
        .call(legendAxis);
}