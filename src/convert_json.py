import geopandas as gpd

# Define the input shapefile path and the desired output GeoJSON path
shapefile_path = 'data/BR_Municipios_2024/BR_Municipios_2024.shp'
geojson_path = 'docs/static/data/brazil_municipalities.geojson'

# Read the shapefile into a GeoDataFrame
print("Reading shapefile...")
gdf = gpd.read_file(shapefile_path)

# --- Optional but Recommended: Reproject to WGS84 ---
# Web maps (Google Maps, Leaflet, D3) use the EPSG:4326 coordinate system.
# Check if your shapefile is already in this system.
if gdf.crs != 'EPSG:4326':
    print(f"Original CRS is {gdf.crs}. Converting to EPSG:4326...")
    gdf = gdf.to_crs('EPSG:4326')

# --- Optional but Recommended: Simplify Geometries ---
# GeoJSON files for all Brazilian municipalities can be very large.
# Simplifying the polygons will significantly reduce file size and improve map performance.
# The tolerance value is in the same units as the CRS (degrees for EPSG:4326).
# Adjust the tolerance (e.g., 0.001) for more or less detail.
print("Simplifying geometries...")
gdf['geometry'] = gdf['geometry'].simplify(tolerance=0.01)


# Save the GeoDataFrame to a GeoJSON file
print(f"Saving to {geojson_path}...")
gdf.to_file(geojson_path, driver='GeoJSON')