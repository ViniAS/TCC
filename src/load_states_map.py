import geobr
import geopandas as gpd

print("Fetching state boundaries...")

states_gdf = geobr.read_state(year=2020)

states_gdf.replace({'name_state': {
    'Amazônas': 'Amazonas',
    'Rio Grande Do Norte': 'Rio Grande do Norte',
    'Rio Grande Do Sul': 'Rio Grande do Sul',
    'Rio De Janeiro': 'Rio de Janeiro',
    'Mato Grosso Do Sul': 'Mato Grosso do Sul',
}}, inplace=True)

states_gdf['geometry'] = states_gdf['geometry'].simplify(tolerance=0.01)

states_gdf.to_file('docs/static/data/brazil-states.geojson', driver='GeoJSON')

print("'brazil-states.geojson' created successfully.")
