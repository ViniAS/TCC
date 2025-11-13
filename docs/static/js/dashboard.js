import init, { readParquet } from "https://unpkg.com/parquet-wasm@0.6.0/esm/parquet_wasm.js";

// Initialize the WebAssembly module once
await init();

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


let rawMuniData = []; // Store the unfiltered data
let rawStateData = []; // Store the unfiltered state data
let currentFilters = {
    year: 'ALL',
    diagnosis: 'ALL'
};


Promise.all([
    d3.csv("static/data/counties.csv"),
    d3.csv("static/data/county_info.csv"),
    d3.csv("static/data/diag.csv"),
    d3.json("static/data/brazil_municipalities.geojson"),
    d3.json("static/data/brazil-states.geojson"),
    d3.csv("static/data/states_graph.csv"),
    d3.csv("static/data/communities.csv")    
]).then(([muniData,muniInfo,diagInfo,muniGeo, stateGeo, stateData, communitiesData]) => {
    // Store raw data
    rawStateData = stateData;

    // Create a lookup for state coordinates from stateGeo centroids
    const stateCoordinates = new Map();
    stateGeo.features.forEach(feature => {
        const stateName = feature.properties.name_state;
        const centroid = d3.geoCentroid(feature);
        stateCoordinates.set(stateName, {
            lat: centroid[1],
            lon: centroid[0]
        });
    });

    const muniInfoMap = new Map(
        muniInfo.map(d => [d.CD_MUN, {
            name: d.MUNIC_RES,
            uf: d.UF,
            lat: +d.LAT,
            lon: +d.LON
        }])
    );

    const diagInfoMap = new Map(
        diagInfo.map(d => [d.COD, {
            name: d.DIAG_PRINC
        }])
    );

    rawMuniData = muniData.map(d => {
        const resInfo = muniInfoMap.get(d.CD_MUN_RES);
        const diag = diagInfoMap.get(d.DIAG_PRINC)
        return {
            CD_MUN_RES: d.CD_MUN_RES,
            ANO_CMPT: d.ANO_CMPT,
            DIAG_PRINC: diag?.name || 'Unknown',
            HOSPITALIZACOES: +d.HOSPITALIZACOES,
            DISTANCE: +d.DISTANCE,
            MUNIC_RES: resInfo?.name || 'Unknown',
            UF_RES: resInfo?.uf || 'Unknown',
            RES_LAT: resInfo?.lat || 0,
            RES_LON: resInfo?.lon || 0
        };
    })

    // Populate diagnosis dropdown with unique values
    const diagnoses = Array.from(diagInfoMap.values()).map(d => d.name).sort();
    const diagnosisSelect = d3.select("#diagnosis-select");
    diagnoses.forEach(diag => {
        diagnosisSelect.append("option")
            .attr("value", diag)
            .text(diag);
    });

    // Function to filter data based on current filters
    function filterData(data) {
        return data.filter(d => {
            const yearMatch = currentFilters.year === 'ALL' || d.ANO_CMPT === currentFilters.year;
            const diagnosisMatch = currentFilters.diagnosis === 'ALL' || d.DIAG_PRINC === currentFilters.diagnosis;
            return yearMatch && diagnosisMatch;
        });
    }

    // Function to aggregate filtered data
        function aggregateFilteredData(filteredData) {
        // Group by source municipality
        const grouped = d3.group(filteredData, d => d.MUNIC_RES);

        const aggregated = [];
        grouped.forEach((records, municRes) => {
            const totalHosp = d3.sum(records, d => +d.HOSPITALIZACOES || 0);
            const meanDist = totalHosp > 0
                ? d3.sum(records, d => (+d.DISTANCE || 0) * (+d.HOSPITALIZACOES || 0)) / totalHosp
                : 0;
            const firstRecord = records[0];
            aggregated.push({
                MUNIC_RES: municRes,
                HOSPITALIZACOES: totalHosp,
                UF_RES: firstRecord.UF_RES,
                RES_LAT: firstRecord.RES_LAT,
                RES_LON: firstRecord.RES_LON,
                CD_MUN_RES: firstRecord.CD_MUN_RES,
                DISTANCE: meanDist
            });
        });

        return aggregated;
    }
    function aggregateFilteredDataStates(filteredData) {
        // Group by source and destination state
        const grouped = d3.group(filteredData, 
            d => d.UF_RES, 
            d => d.UF_MOV
        );

        const aggregated = [];
        grouped.forEach((ufMovMap, ufRes) => {
            ufMovMap.forEach((records, ufMov) => {
                const totalHosp = d3.sum(records, d => +d.HOSPITALIZACOES || 0);
                const firstRecord = records[0];
                aggregated.push({
                    UF_RES: ufRes,
                    UF_MOV: ufMov,
                    HOSPITALIZACOES: totalHosp,
                    RES_LAT: firstRecord.RES_LAT,
                    RES_LON: firstRecord.RES_LON,
                    MOV_LAT: firstRecord.MOV_LAT,
                    MOV_LON: firstRecord.MOV_LON,
                });
            });
        });

        return aggregated;
    }
    // Function to compute weighted means from filtered data
    function computeWeightedMeans(filteredData) {
        const muniGroups = d3.group(filteredData, d => d.MUNIC_RES, d => d.UF_RES);
        let weightedMeans = [];
        
        muniGroups.forEach((ufMap, muni) => {
            ufMap.forEach((records, uf) => {
                const totalHosp = d3.sum(records, d => +d.HOSPITALIZACOES || 0);
                const weightedSum = d3.sum(records, d => (+d.DISTANCE || 0) * (+d.HOSPITALIZACOES || 0));
                const weightedMean = totalHosp > 0 ? weightedSum / totalHosp : 0;
                
                weightedMeans.push({
                    MUNIC_RES: muni,
                    UF_RES: uf,
                    WEIGHTED_MEAN_DIST: weightedMean
                });
            });
        });
        
        return weightedMeans;
    }

    // Function to update filter status text
    function updateFilterStatus() {
        let statusText = "Mostrando: ";
        const parts = [];
        
        if (currentFilters.year !== 'ALL') {
            parts.push(`Ano ${currentFilters.year}`);
        }
        if (currentFilters.diagnosis !== 'ALL') {
            parts.push(currentFilters.diagnosis);
        }
        
        if (parts.length === 0) {
            statusText += "Todos os dados";
        } else {
            statusText += parts.join(" | ");
        }
        
        d3.select("#filter-status").text(statusText);
    }

    // Function to refresh all visualizations
    function refreshVisualizations() {
        const filteredData = filterData(rawMuniData);
        const filteredStateData = filterData(rawStateData)
        const aggregatedData = aggregateFilteredData(filteredData);
        const aggregatedStateData = aggregateFilteredDataStates(filteredStateData);
        const weightedMeans = computeWeightedMeans(filteredData);

        // Update state dropdown with filtered states
        const states = Array.from(new Set(weightedMeans.map(d => d.UF_RES))).sort();
        const stateSelect = d3.select("#state-select");
        const currentStateValue = stateSelect.property("value");
        
        stateSelect.html('<option value="ALL">Todos</option>');
        states.forEach(state => {
            stateSelect.append("option")
                .attr("value", state)
                .text(state);
        });
        stateSelect.property("value", currentStateValue);

        drawStates(stateGeo, aggregatedStateData);


        // Update histogram
        const histogramStateFilter = d3.select("#state-select").property("value");
        let histogramData = aggregatedData;
        if (histogramStateFilter !== "ALL") {
            histogramData = aggregatedData.filter(d => d.UF_RES === histogramStateFilter);
        }
        drawHistogram(histogramData);

        // Update choropleth
        drawChoropleth(muniGeo, aggregatedData, stateGeo);

        // Update filter status
        updateFilterStatus();
    }

    // Apply filters button click handler
    d3.select("#apply-filters").on("click", () => {
        currentFilters.year = d3.select("#year-select").property("value");
        currentFilters.diagnosis = d3.select("#diagnosis-select").property("value");
        refreshVisualizations();
    });

    // Initial visualization with all data
    refreshVisualizations();

    // Keep the existing button handlers

    const filteredStateData = filterData(rawStateData);
    const aggregatedStateData = aggregateFilteredDataStates(filteredStateData);
    drawStates(stateGeo, aggregatedStateData);

    // Update histogram on state dropdown change
    d3.select("#state-select").on("change", function() {
        const selectedState = this.value;
        const filteredData = filterData(rawMuniData);
        const aggregatedData = aggregateFilteredData(filteredData);
        
        let histogramData = aggregatedData;
        if (selectedState !== "ALL") {
            histogramData = aggregatedData.filter(d => d.UF_RES === selectedState);
        }
        drawHistogram(histogramData);
    });

    // Communities map doesn't need filtering as it's based on structure
    drawCommunitiesMap(muniGeo, communitiesData, stateGeo);

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
// function drawMunicipalities(geojson, mobilityData) {

//     mapGroup.html("");
//     lineGroup.html("");
//     mapGroup.selectAll("path")
//         .data(geojson.features)
//         .enter().append("path")
//         .attr("d", path)
//         .attr("class", "municipality")
//         .attr("data-code", d => d.properties.CD_MUN)
//         .style("fill", d => {
//             const stateCode = d.properties.CD_UF; 
//             return fourColors[stateColorMapping[stateCode]];
//         })
//         .on("click", handleClick)
//         .append("title")
//         .text(d => d.properties.NM_MUN);

//     const hospVals = mobilityData.map(d => +d.HOSPITALIZACOES).filter(d => !isNaN(d));
//     const minHosp = d3.min(hospVals);
//     const maxHosp = d3.max(hospVals);

//     // Use a D3 scale for width
//     const widthScale = d3.scaleSqrt()
//         .domain([minHosp, maxHosp])
//         .range([1, 5]);

//     function handleClick(event, d) {
//         const clickedMuniCode = d.properties.CD_MUN;
//         d3.select(this.parentNode).selectAll('path').classed('selected', false);
//         d3.select(this).classed('selected', true);
//         lineGroup.html("");

//         const connections = mobilityData.filter(link => link.CD_MUN_RES == clickedMuniCode);

//         connections.forEach(conn => {
//             const start = projection([+conn.RES_LON, +conn.RES_LAT]);
//             const end = projection([+conn.MOV_LON, +conn.MOV_LAT]);
//             if (start && end) {
//                 lineGroup.append("line")
//                     .attr("x1", start[0]).attr("y1", start[1])
//                     .attr("x2", end[0]).attr("y2", end[1])
//                     .attr("class", "connection-line") // The CSS class provides the opacity
//                     .style("stroke-width", widthScale(+conn.HOSPITALIZACOES));
//             }
//         });
//     }

//     drawLineWidthLegend("#map", minHosp, maxHosp, widthScale);
// }

function drawHistogram(data) {
    const svg = d3.select("#histogram");
    svg.selectAll("*").remove();

    const margin = {top: 40, right: 30, bottom: 50, left: 60},
        width = +svg.attr("width") - margin.left - margin.right,
        height = +svg.attr("height") - margin.top - margin.bottom;

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    // Parse values
    const values = data.map(d => +d.DISTANCE).filter(d => !isNaN(d));

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
    const meanByMuni = new Map(weightedMeans.map(d => [d.MUNIC_RES, d.DISTANCE]));

    // Compute color scale (logarithmic)
    const values = weightedMeans.map(d => d.DISTANCE).filter(d => !isNaN(d) && d > 0);
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


function drawCommunitiesMap(geojson, communitiesData, stateGeo) {
    const svg = d3.select("#communities-map");
    svg.selectAll("*").remove();

    const width = +svg.attr("width");
    const height = +svg.attr("height");
    const projection = d3.geoMercator().center([-54, -15]).scale(750).translate([width / 2, height / 2]);
    const path = d3.geoPath().projection(projection);

    // Create a group for zooming
    const mapGroup = svg.append("g").attr("class", "communities-map-group");

    // D3 zoom behavior
    const zoom = d3.zoom()
        .scaleExtent([1, 8])
        .on("zoom", (event) => {
            mapGroup.attr("transform", event.transform);
        });
    svg.call(zoom);

    d3.select("#reset-zoom-communities").on("click", () => {
        svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity);
    });

    // Create a lookup for community ID by municipality name
    const communityByMuni = new Map(communitiesData.map(d => [d.municipality, +d.community_id]));

    // Get unique community IDs and create color scale
    const communityIds = Array.from(new Set(communitiesData.map(d => +d.community_id)));
    const maxCommunityId = d3.max(communityIds);
    
    // Use a categorical color scheme that can handle many colors
    const colorScale = d3.scaleSequential(d3.interpolateRainbow)
        .domain([0, maxCommunityId]);

    // Draw municipalities
    mapGroup.append("g")
        .selectAll("path")
        .data(geojson.features)
        .enter().append("path")
        .attr("d", path)
        .attr("fill", d => {
            const municipalityName = d.properties.NM_MUN + " - " + d.properties.NM_UF;
            const communityId = communityByMuni.get(municipalityName);
            return communityId !== undefined ? colorScale(communityId) : "#ddd";
        })
        .attr("stroke", "#fff")
        .attr("stroke-width", 0.2)
        .append("title")
        .text(d => {
            const municipalityName = d.properties.NM_MUN + " - " + d.properties.NM_UF;
            const communityId = communityByMuni.get(municipalityName);
            return `${d.properties.NM_MUN} - ${d.properties.NM_UF}\nComunidade: ${communityId !== undefined ? communityId : "não identificada"}`;
        });

    // Draw state borders on top
    mapGroup.append("g")
        .selectAll("path")
        .data(stateGeo.features)
        .enter().append("path")
        .attr("d", path)
        .attr("fill", "none")
        .attr("stroke", "#000")
        .attr("stroke-width", 0.8);

    // Add legend
    const legendWidth = 200;
    const legendHeight = 20;
    const legendX = width - legendWidth - 20;
    const legendY = height - 60;

    // Legend title
    svg.append("text")
        .attr("x", legendX + legendWidth / 2)
        .attr("y", legendY - 10)
        .attr("text-anchor", "middle")
        .attr("font-size", 14)
        .attr("font-weight", "bold")
        .text("Comunidades de Mobilidade");

    // Create gradient for legend
    const defs = svg.append("defs");
    const linearGradient = defs.append("linearGradient")
        .attr("id", "community-gradient")
        .attr("x1", "0%").attr("y1", "0%")
        .attr("x2", "100%").attr("y2", "0%");

    // Add color stops
    const numStops = 20;
    for (let i = 0; i <= numStops; i++) {
        const ratio = i / numStops;
        const communityId = ratio * maxCommunityId;
        linearGradient.append("stop")
            .attr("offset", `${ratio * 100}%`)
            .attr("stop-color", colorScale(communityId));
    }

    // Legend rectangle
    svg.append("rect")
        .attr("x", legendX)
        .attr("y", legendY)
        .attr("width", legendWidth)
        .attr("height", legendHeight)
        .style("fill", "url(#community-gradient)")
        .attr("stroke", "#000")
        .attr("stroke-width", 1);

    // Legend labels
    svg.append("text")
        .attr("x", legendX)
        .attr("y", legendY + legendHeight + 15)
        .attr("text-anchor", "start")
        .attr("font-size", 12)
        .text("0");

    svg.append("text")
        .attr("x", legendX + legendWidth)
        .attr("y", legendY + legendHeight + 15)
        .attr("text-anchor", "end")
        .attr("font-size", 12)
        .text(maxCommunityId);

    // Add summary statistics
    const totalMunicipalities = communitiesData.length;
    const totalCommunities = communityIds.length;
    
    svg.append("text")
        .attr("x", 20)
        .attr("y", height - 40)
        .attr("font-size", 12)
        .attr("font-weight", "bold")
        .text(`Total de municípios: ${totalMunicipalities}`);

    svg.append("text")
        .attr("x", 20)
        .attr("y", height - 20)
        .attr("font-size", 12)
        .attr("font-weight", "bold")
        .text(`Total de comunidades: ${totalCommunities}`);
}