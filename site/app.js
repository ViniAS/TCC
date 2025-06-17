// Set up SVG dimensions and projection
const width = 800;
const height = 600;
const svg = d3.select("#map");

// Use a Mercator projection centered on Brazil
const projection = d3.geoMercator()
    .center([-54, -15]) // Center of Brazil
    .scale(750) // Zoom level
    .translate([width / 2, height / 2]);

// Path generator
const path = d3.geoPath().projection(projection);

// Group for map features and for connection lines
const mapGroup = svg.append("g");
const lineGroup = svg.append("g");

// Load both datasets simultaneously
Promise.all([
    // CHANGED: Using the name of your specific GeoJSON file
    d3.json("brazil_municipalities.geojson"),
    // CHANGED: Using the name of your specific CSV file
    d3.csv("graph.csv")
]).then(([geojson, mobilityData]) => {

    // Draw the municipalities
    mapGroup.selectAll("path")
        .data(geojson.features)
        .enter()
        .append("path")
        .attr("d", path)
        .attr("class", "municipality")
        // CHANGED: Use "CD_MUN" from your GeoJSON properties as the unique identifier
        .attr("data-code", d => d.properties.CD_MUN) 
        .on("click", handleClick)
        // NOTE: Added a tooltip to show the municipality name on hover
        .append("title")
        .text(d => d.properties.NM_MUN);

    // Click handler function
    function handleClick(event, d) {
        // CHANGED: Get the municipality code from the "CD_MUN" property
        const clickedMunicipalityCode = d.properties.CD_MUN;

        // --- Visual Feedback for Selection ---
        d3.selectAll('.municipality').classed('selected', false);
        d3.select(this).classed('selected', true);
        
        // --- Draw Connections ---
        lineGroup.selectAll("line").remove(); // Clear previous lines

        // CHANGED: Filter mobility data where the origin code ("CD_MUN_RES")
        // matches the code of the municipality that was clicked.
        const connections = mobilityData.filter(
            link => link.CD_MUN_RES == clickedMunicipalityCode
        );

        // Draw new lines for each connection
        connections.forEach(conn => {
            // CHANGED: Use the correct coordinate columns from your CSV.
            // Remember: D3 projection needs [longitude, latitude]
            // The `+` converts the string from the CSV to a number.
            const start = projection([+conn.RES_LON, +conn.RES_LAT]);
            const end = projection([+conn.MOV_LON, +conn.MOV_LAT]);

            if (start && end) { // Ensure points are projectable
                lineGroup.append("line")
                    .attr("x1", start[0])
                    .attr("y1", start[1])
                    .attr("x2", end[0])
                    .attr("y2", end[1])
                    .attr("class", "connection-line")
                    // NOTE: You could style lines based on the "HOSPITALIZACOES" value
                    .style("stroke-width", Math.min(Math.sqrt(conn.HOSPITALIZACOES), 5)); 
            }
        });
    }

}).catch(error => {
    console.error("Error loading the data:", error);
});

// Add zoom and pan functionality
const zoom = d3.zoom()
    .scaleExtent([1, 8])
    .on("zoom", (event) => {
        // Apply the zoom transformation to both the map and the lines
        mapGroup.attr("transform", event.transform);
        lineGroup.attr("transform", event.transform);
    });

svg.call(zoom);