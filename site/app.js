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
    .attr("viewBox", "0 -5 10 10")          // The coordinate system for the arrow shape
    .attr("refX", 10)                       // How far along the line to place the arrow (at the tip)
    .attr("refY", 0)
    .attr("markerUnits", "userSpaceOnUse")  // *** THE KEY FIX: Decouples arrow size from stroke-width ***
    .attr("markerWidth", 10)                // The new fixed width of the arrowhead in pixels
    .attr("markerHeight", 10)               // The new fixed height of the arrowhead in pixels
    .attr("orient", "auto")                 // Automatically rotates the arrow
    .attr("opacity", 0.8)
  .append("svg:path")
    .attr("d", "M0,-5L10,0L0,5")            // The path that draws the triangle shape
    .attr("fill", "#ff4136");

const zoom = d3.zoom().scaleExtent([1, 8]).on("zoom", (event) => {
    mapGroup.attr("transform", event.transform);
    lineGroup.attr("transform", event.transform);
});
svg.call(zoom);

// --- Data Loading ---
Promise.all([
    d3.json("data/brazil_municipalities.geojson"),
    d3.csv("data/graph.csv"),
    d3.json("data/brazil-states.geojson"),
    d3.csv("data/states_graph.csv")
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

}).catch(error => console.error("Error loading the data:", error));


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
            // --- THIS IS THE RESTORED LINE ---
            // It sets the stroke width based on the number of hospitalizations.
            // We add 1 so minimum-value lines are visible, and divide by 5 to scale down the larger state-level numbers.
            .style("stroke-width", d => Math.min(1 + Math.sqrt(d.HOSPITALIZACOES) / 5, 8));
    }

    drawConnectionLines(mobilityData);

    function handleClick(event, d) {
        const clickedStateName = d.properties.name_state;
        d3.select(this.parentNode).selectAll('path').classed('selected', false);
        d3.select(this).classed('selected', true);
        const filteredConnections = mobilityData.filter(link => link.UF_RES === clickedStateName);
        drawConnectionLines(filteredConnections);
    }
}


// --- Drawing Function for Municipalities (Unchanged) ---
function drawMunicipalities(geojson, mobilityData) {
    // This function already has the dynamic stroke-width and will now also
    // benefit from the updated translucent style in the CSS.
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
                    .style("stroke-width", Math.min(Math.sqrt(conn.HOSPITALIZACOES), 5));
            }
        });
    }
}