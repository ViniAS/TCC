import * as topojsonServer from "https://esm.sh/topojson-server@3";
import * as topojsonClient from "https://esm.sh/topojson-client@3";

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

// -- Filters are Arrays --
let currentFilters = {
    years: ['ALL'],
    diagnoses: ['ALL']
};

let currentFilterCommunity = 'Todos';

// --- HELPER: Multi-select Logic ---
function createMultiSelect(containerId, options, selectedValues) {
    const container = d3.select(containerId);
    container.html(""); // Clear existing

    // 1. Display Box (The button that shows what is selected)
    const displayBox = container.append("div")
        .attr("class", "selectBox");
    
    const displayLabel = displayBox.append("div")
        .attr("class", "multiselect-display")
        .text("Todos Selecionados");

    // 2. Checkboxes Container (Hidden by default via CSS)
    const checkboxesContainer = container.append("div")
        .attr("class", "checkboxes");

    // Toggle Logic
    displayBox.on("click", function(event) {
        event.stopPropagation();
        const isVisible = checkboxesContainer.classed("show");
        
        // Close all other dropdowns first
        d3.selectAll(".checkboxes").classed("show", false);
        
        // Toggle this one
        checkboxesContainer.classed("show", !isVisible);
    });

    // Helper to update label
    function updateLabel() {
        const checked = checkboxesContainer.selectAll("input:checked");
        const count = checked.size();
        const total = options.length;
        
        const isAllChecked = checkboxesContainer.select("input[value='ALL']").property("checked");

        if (isAllChecked) {
            displayLabel.text("Todos Selecionados");
            selectedValues.length = 0;
            selectedValues.push('ALL');
        } else if (count === 0) {
             displayLabel.text("Nenhum selecionado");
             selectedValues.length = 0;
        } else {
            // Collect values
            const values = [];
            checked.each(function() { 
                if(this.value !== 'ALL') values.push(this.value); 
            });
            
            selectedValues.length = 0;
            values.forEach(v => selectedValues.push(v));

            if (count === 1) {
                displayLabel.text(values[0]);
            } else if (count === total) {
                displayLabel.text("Todos Selecionados");
            } else {
                displayLabel.text(`${count} selecionados`);
            }
        }
    }

    // 3. Add "Select All" / "Todos" option
    const allLabel = checkboxesContainer.append("label");
    allLabel.append("input")
        .attr("type", "checkbox")
        .attr("value", "ALL")
        .property("checked", true)
        .on("change", function() {
            const isChecked = this.checked;
            // Check/Uncheck all others
            checkboxesContainer.selectAll("input:not([value='ALL'])")
                .property("checked", isChecked);
            updateLabel();
        });
    allLabel.append("span").text("Todos");

    // 4. Add individual options
    options.forEach(opt => {
        const lbl = checkboxesContainer.append("label");
        lbl.append("input")
            .attr("type", "checkbox")
            .attr("value", opt)
            .property("checked", true) // Default to all selected
            .on("change", function() {
                // If unchecking a specific item, uncheck "All"
                if (!this.checked) {
                    checkboxesContainer.select("input[value='ALL']").property("checked", false);
                }
                // If checking specific item, check if all are now checked
                if (this.checked) {
                    const allOpts = checkboxesContainer.selectAll("input:not([value='ALL'])");
                    const allChecked = allOpts.size() === allOpts.filter(function() { return this.checked; }).size();
                    if (allChecked) {
                        checkboxesContainer.select("input[value='ALL']").property("checked", true);
                    }
                }
                updateLabel();
            });
        lbl.append("span").text(opt);
    });

    // Close dropdown when clicking anywhere else on the body
    d3.select("body").on("click." + containerId, function(event) {
        // If the click target is NOT inside the container
        if (!container.node().contains(event.target)) {
            checkboxesContainer.classed("show", false);
        }
    });
}


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

    // Compute topology for municipalities
    const muniTopology = topojsonServer.topology({municipalities: muniGeo},9e2);

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
        const diag = diagInfoMap.get(d.DIAG_PRINC);
        return {
            CD_MUN_RES: d.CD_MUN_RES,
            ANO_CMPT: d.ANO_CMPT,
            DIAG_PRINC: diag?.name || 'Unknown',
            HOSPITALIZACOES: +d.HOSPITALIZACOES,
            DISTANCE: +d.DISTANCE,
            PCT_SAME_MUN: +d.PCT_SAME_MUN,
            MUNIC_RES: resInfo?.name || 'Unknown',
            UF_RES: resInfo?.uf || 'Unknown',
            RES_LAT: resInfo?.lat || 0,
            RES_LON: resInfo?.lon || 0
        };
    })

    communitiesData = communitiesData.map(d => {
        const munInfo = muniInfoMap.get(d.municipality);
        const diag = diagInfoMap.get(d.DIAG_PRINC);
        return {
            municipality: munInfo?.name || 'Unknown',
            community_id: d.community_id,
            DIAG_PRINC: diag?.name || 'Unknown',
        };
    });

    // --- Setup Multi-Select Dropdowns ---
    
    // 1. Years
    const years = ['2014','2015','2016','2017','2018','2019','2020','2021','2022','2023','2024'];
    createMultiSelect("#year-multiselect", years, currentFilters.years);

    // 2. Diagnoses
    let diagnoses = Array.from(diagInfoMap.values()).map(d => d.name).sort();
    diagnoses = diagnoses.filter(d => d !== 'Todos'); 
    createMultiSelect("#diagnosis-multiselect", diagnoses, currentFilters.diagnoses);

    // Setup standard select for community tab
    const diagnosisCommunitySelect = d3.select("#diagnosis-select-community");
    diagnoses.forEach(diag => {
        diagnosisCommunitySelect.append("option")
            .attr("value", diag)
            .text(diag);
    });

    // --- Updated Filter Function ---
    function filterData(data) {
        return data.filter(d => {
            // Check Year
            const yearMatch = currentFilters.years.includes('ALL') || currentFilters.years.includes(d.ANO_CMPT);
            // Check Diagnosis
            const diagnosisMatch = currentFilters.diagnoses.includes('ALL') || currentFilters.diagnoses.includes(d.DIAG_PRINC);
            
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
                : NaN;
            const meanPct = totalHosp > 0
                ? d3.sum(records, d => 100 * ((+d.PCT_SAME_MUN || 0) * (+d.HOSPITALIZACOES || 0))) / totalHosp
                : NaN;
            const firstRecord = records[0];
            aggregated.push({
                MUNIC_RES: municRes,
                HOSPITALIZACOES: totalHosp,
                UF_RES: firstRecord.UF_RES,
                RES_LAT: firstRecord.RES_LAT,
                RES_LON: firstRecord.RES_LON,
                CD_MUN_RES: firstRecord.CD_MUN_RES,
                DISTANCE: meanDist,
                PCT_SAME_MUN: meanPct
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

    // Function to update filter status text
    function updateFilterStatus() {
        let statusText = "Mostrando: ";
        const parts = [];
        
        if (!currentFilters.years.includes('ALL')) {
            parts.push(`Anos: ${currentFilters.years.join(", ")}`);
        }
        if (!currentFilters.diagnoses.includes('ALL')) {
            if(currentFilters.diagnoses.length > 3) {
                parts.push(`Diagnósticos: ${currentFilters.diagnoses.length} selecionados`);
            } else {
                parts.push(`Diagnósticos: ${currentFilters.diagnoses.join(", ")}`);
            }
        }
        
        if (parts.length === 0) {
            statusText += "Todos os dados (Anos e Diagnósticos)";
        } else {
            statusText += parts.join(" | ");
        }
        
        d3.select("#filter-status").text(statusText);
    }

    // Function to refresh all visualizations
    function refreshVisualizations() {
        const filteredData = filterData(rawMuniData);
        const filteredStateData = filterData(rawStateData);

        const aggregatedData = aggregateFilteredData(filteredData);
        const aggregatedStateData = aggregateFilteredDataStates(filteredStateData);

        // Update state dropdown with filtered states
        const states = Array.from(new Set(aggregatedData.map(d => d.UF_RES))).sort();
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
        drawChoroplethSame(muniGeo, aggregatedData, stateGeo);

        // Update filter status
        updateFilterStatus();
    }

    function refreshCommunityViz() {
        const filteredCommunitiesData = communitiesData.filter(d => {
            const diagnosisMatch = d.DIAG_PRINC === currentFilterCommunity;
            return diagnosisMatch;
        });

        d3.select("#filter-status-community").text(`Mostrando: ${currentFilterCommunity}`);

        drawCommunitiesMap(muniGeo, filteredCommunitiesData, stateGeo, muniTopology);
    }

    // Apply filters button click handler
    d3.select("#apply-filters").on("click", () => {
        refreshVisualizations();
    });

    d3.select("#apply-filters-community").on('click', () => {
        currentFilterCommunity = d3.select('#diagnosis-select-community').property("value");
        refreshCommunityViz();
    })

    // Initial visualization with all data
    refreshVisualizations();
    refreshCommunityViz();

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
    const values = weightedMeans.map(d => d.DISTANCE).filter(d => !isNaN(d) && d>0);
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
        .text("Distância Média Viajada (km). Escala Log");

    const defs = svg.append("defs");
    const linearGradient = defs.append("linearGradient")
        .attr("id", "legend-gradient");
    linearGradient.selectAll("stop")
        .data(d3.range(0, 1.01, 0.01))
        .enter().append("stop")
        .attr("offset", d => `${d * 100}%`)
        .attr("stop-color", d => color(minVal * Math.pow(maxVal / minVal, d)));

    legendSvg.append("rect")
        .attr("width", legendWidth)
        .attr("height", legendHeight)
        .style("fill", "url(#legend-gradient)");

    // Legend axis (log scale)
    const legendScale = d3.scaleLog()
        .domain([minVal, maxVal])
        .range([0, legendWidth]);
        
    let tickVals = [];
    
    tickVals.push(minVal);

    let power = 1;
    while (power <= maxVal) {
        if (power > minVal && power < maxVal) {
            // Prevent overlap: if power is very close to minVal (e.g. min=9, power=10), skip it
            // Log10 difference check:
            if (Math.abs(Math.log10(power) - Math.log10(minVal)) > 0.2) {
                tickVals.push(power);
            }
        }
        power *= 10;
    }

    const lastTick = tickVals[tickVals.length - 1];
    if (Math.abs(Math.log10(maxVal) - Math.log10(lastTick)) > 0.2) {
        tickVals.push(maxVal);
    }
    
    const legendAxis = d3.axisBottom(legendScale)
        .tickValues(tickVals) 
        .tickFormat(d => d3.format(".0f")(d))
        .tickPadding(6);

    legendSvg.append("g")
        .attr("transform", `translate(0,${legendHeight})`)
        .call(legendAxis);
}


function drawChoroplethSame(geojson, weightedMeans, state) {
    const svg = d3.select("#choropleth-same");
    svg.selectAll("*").remove();

    const width = +svg.attr("width");
    const height = +svg.attr("height");
    const projection = d3.geoMercator().center([-54, -15]).scale(750).translate([width / 2, height / 2]);
    const path = d3.geoPath().projection(projection);

    // Create a group for zooming
    const mapGroup = svg.append("g").attr("class", "choropleth-same-map-group");

    // D3 zoom behavior
    const zoom = d3.zoom()
        .scaleExtent([1, 8])
        .on("zoom", (event) => {
            mapGroup.attr("transform", event.transform);
        });
    svg.call(zoom);

    d3.select("#reset-zoom-choropleth-same").on("click", () => {
        svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity);
    });

    // Create a lookup for weighted mean by municipality name
    const meanByMuni = new Map(weightedMeans.map(d => [d.MUNIC_RES, d.PCT_SAME_MUN]));

    // Compute color scale (logarithmic)
    const values = weightedMeans.map(d => d.PCT_SAME_MUN).filter(d => !isNaN(d));
    const minVal = 0.0;
    const maxVal = 100.0;
    const color = d3.scaleSequential(d3.interpolateViridis)
        .domain([minVal, maxVal]);

    // Draw municipalities
    mapGroup.append("g")
        .selectAll("path")
        .data(geojson.features)
        .enter().append("path")
        .attr("d", path)
        .attr("fill", d => {
            const val = meanByMuni.get(d.properties.NM_MUN + " - " + d.properties.NM_UF);
            return (val !== undefined) ? color(val) : "#eee";
        })
        .attr("stroke", "#fff")
        .attr("stroke-width", 0.2)
        .append("title")
        .text(d => {
            const val = meanByMuni.get(d.properties.NM_MUN + " - " + d.properties.NM_UF);
            return `${d.properties.NM_MUN} - ${d.properties.NM_UF}\n${val !== undefined ? val.toFixed(2) + "%" : "sem dados"}`;
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
        .text("Hospitalizações atendidas no município de Residência (%).");

    const defs = svg.append("defs");
    const linearGradient = defs.append("linearGradient")
        .attr("id", "legend-gradient");
    linearGradient.selectAll("stop")
        .data(d3.range(0, 1.01, 0.01))
        .enter().append("stop")
        .attr("offset", d => `${d * 100}%`)
        .attr("stop-color", d => color(minVal * Math.pow(maxVal / minVal, d)));

    legendSvg.append("rect")
        .attr("width", legendWidth)
        .attr("height", legendHeight)
        .style("fill", "url(#legend-gradient)");

    // Legend axis (log scale)
    const legendScale = d3.scaleLinear()
        .domain([minVal, maxVal])
        .range([0, legendWidth]);
        
    let tickVals = [0.0,20.0,40.0,60.0,80.0,100.0];
    
    
    const legendAxis = d3.axisBottom(legendScale)
        .tickValues(tickVals) 
        .tickFormat(d => d3.format(".0f")(d))
        .tickPadding(6);

    legendSvg.append("g")
        .attr("transform", `translate(0,${legendHeight})`)
        .call(legendAxis);
}


function drawCommunitiesMap(geojson, communitiesData, stateGeo, topology) {
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
    svg.call(zoom)
      .on("click", function(event) {
          // If the click is directly on the svg (not on a municipality)
          if (event.target.tagName === "svg") {
              // Reset highlighting
              mapGroup.selectAll('.community-municipality').classed('selected', false);
              mapGroup.selectAll('.community-municipality').classed('dimmed', false);
              mapGroup.selectAll('.community-municipality').attr('stroke-width', 0.2);
              // Reset info panel
              d3.select("#community-info").html("<p>Clique em um município no mapa para ver detalhes da sua comunidade.</p>");
          }
      });

    d3.select("#reset-zoom-communities").on("click", () => {
        svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity);
        // Reset highlighting
        mapGroup.selectAll('.community-municipality').classed('selected', false);
        mapGroup.selectAll('.community-municipality').classed('dimmed', false);
        mapGroup.selectAll('.community-municipality').attr('stroke-width', 0.2);
        // Reset info panel
        d3.select("#community-info").html("<p>Clique em um município no mapa para ver detalhes da sua comunidade.</p>");
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
        .attr("class", "community-municipality")
        .on("click", handleClick)
        .append("title")
        .text(d => {
            const municipalityName = d.properties.NM_MUN + " - " + d.properties.NM_UF;
            const communityId = communityByMuni.get(municipalityName);
            return `${d.properties.NM_MUN} - ${d.properties.NM_UF}\nComunidade: ${communityId !== undefined ? communityId : "não identificada"}`;
        });

    // Draw community borders
    if (topology) {
        const mesh = topojsonClient.mesh(topology, topology.objects.municipalities, (a, b) => {
            const muniA = a.properties.NM_MUN + " - " + a.properties.NM_UF;
            const muniB = b.properties.NM_MUN + " - " + b.properties.NM_UF;
            return communityByMuni.get(muniA) !== communityByMuni.get(muniB);
        });

        mapGroup.append("path")
            .datum(mesh)
            .attr("d", path)
            .attr("fill", "none")
            .attr("stroke", "#000")
            .attr("stroke-width", 0.85)
            .attr("stroke-linejoin", "round")
            .attr("stroke-linecap", "round");
    }

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

    function handleClick(event, d) {
        const municipalityName = d.properties.NM_MUN + " - " + d.properties.NM_UF;
        const clickedCommunityId = communityByMuni.get(municipalityName);
        
        if (clickedCommunityId === undefined) return;
        
        // Reset any previous highlighting
        mapGroup.selectAll('.community-municipality').classed('selected', false);
        mapGroup.selectAll('.community-municipality').classed('dimmed', false);
        mapGroup.selectAll('.community-municipality').attr('stroke-width', 0.2);
        
        // Count municipalities in this community
        const municipalitiesInCommunity = communitiesData.filter(item => 
            +item.community_id === clickedCommunityId
        );
        
        // Highlight all municipalities in this community
        mapGroup.selectAll('.community-municipality')
            .filter(d => {
                const muniName = d.properties.NM_MUN + " - " + d.properties.NM_UF;
                return communityByMuni.get(muniName) === clickedCommunityId;
            })
        
        // Dim other municipalities
        mapGroup.selectAll('.community-municipality')
            .filter(d => {
                const muniName = d.properties.NM_MUN + " - " + d.properties.NM_UF;
                return communityByMuni.get(muniName) !== clickedCommunityId;
            })
            .classed('dimmed', true);
            
        // Display community information
        d3.select("#community-info").html(`
            <h4>Comunidade ${clickedCommunityId}</h4>
            <p>Município selecionado: <strong>${municipalityName}</strong></p>
            <p>Total de municípios nesta comunidade: <strong>${municipalitiesInCommunity.length}</strong></p>
            <p>Representa <strong>${(municipalitiesInCommunity.length / communitiesData.length * 100).toFixed(2)}%</strong> dos municípios analisados</p>
            <p><em>Para desselecionar, clique em uma área vazia do mapa ou no botão "Resetar Zoom"</em></p>
        `);
    }
}