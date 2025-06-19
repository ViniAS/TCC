import pandas as pd
import geopandas as gpd
from src.transform_data import get_state_name
import geobr
import geopandas as gpd


states_gdf = geobr.read_state(year=2020)

states_gdf['centroid'] = states_gdf.to_crs('+proj=cea').centroid.to_crs(states_gdf.crs)

states_gdf.replace({'name_state': {
    'Amazônas': 'Amazonas',
    'Rio Grande Do Norte': 'Rio Grande do Norte',
    'Rio Grande Do Sul': 'Rio Grande do Sul',
    'Rio De Janeiro': 'Rio de Janeiro',
    'Mato Grosso Do Sul': 'Mato Grosso do Sul',
}}, inplace=True)

states_gdf.set_index('name_state', inplace=True)

df = pd.read_csv('data/agg_data/infectious_disease.csv')

df['UF_RES'] = get_state_name(df['MUNIC_RES'])
df['UF_MOV'] = get_state_name(df['MUNIC_MOV'])

df = df[df['UF_RES'] != df['UF_MOV']]

df = df.groupby(['UF_RES', 'UF_MOV']).agg({'HOSPITALIZACOES': 'sum'}).reset_index()

df['CENTROID_RES'] = df['UF_RES'].map(states_gdf['centroid'])
df['CENTROID_MOV'] = df['UF_MOV'].map(states_gdf['centroid'])

# separate the coordinates into two columns
df['RES_LAT'] = df['CENTROID_RES'].apply(lambda p: p.y)
df['RES_LON'] = df['CENTROID_RES'].apply(lambda p: p.x)
df['MOV_LAT'] = df['CENTROID_MOV'].apply(lambda p: p.y)
df['MOV_LON'] = df['CENTROID_MOV'].apply(lambda p: p.x)

df.drop(columns=['CENTROID_RES', 'CENTROID_MOV'], inplace=True)

# Save the aggregated data to a CSV file
df.to_csv('docs/static/data/states_graph.csv', index=False)

