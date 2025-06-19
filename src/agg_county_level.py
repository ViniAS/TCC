import pandas as pd
import geopandas as gpd
from geopy.distance import geodesic

from src.transform_data import get_state_name, get_city_name

def get_centroid_coords(mun_name):
    try:
        geom = mapa.loc[mun_name].geometry
        if geom is None:
            return None
        centroid = geom.centroid
        return (centroid.y, centroid.x)
    except KeyError:
        return None
    

def calc_distance(row):
    coords_res = get_centroid_coords(row['MUNIC_RES'])
    coords_mov = get_centroid_coords(row['MUNIC_MOV'])
    if coords_res is None or coords_mov is None:
        return None  # If county not found in mapa or geometry is missing
    return geodesic(coords_res, coords_mov).kilometers


if __name__ == "__main__":

    df = pd.read_csv('data/agg_data/infectious_disease.csv')

    df['UF_RES'] = get_state_name(df['MUNIC_RES'])
    df['UF_MOV'] = get_state_name(df['MUNIC_MOV'])
    
    df['MUNIC_RES'] = get_city_name(df['MUNIC_RES'])
    df['MUNIC_MOV'] = get_city_name(df['MUNIC_MOV'])

    df['MUNIC_RES'] = df['MUNIC_RES'].astype(str) + ' - ' + df['UF_RES']
    df['MUNIC_MOV'] = df['MUNIC_MOV'].astype(str) + ' - ' + df['UF_MOV']

    mapa = gpd.read_file("data/BR_Municipios_2024/BR_Municipios_2024.shp")

    mapa['MUN'] = mapa['NM_MUN'].astype(str) + ' - ' + mapa['NM_UF']
    mapa.set_index('MUN', inplace=True)
    
    print(df.head())



    df['RES_CENTROID'] = df['MUNIC_RES'].apply(get_centroid_coords)
    df['MOV_CENTROID'] = df['MUNIC_MOV'].apply(get_centroid_coords)
    
    # print null values in RES_CENTROID and MOV_CENTROID
    if df['RES_CENTROID'].isnull().any():
        print("Null values in RES_CENTROID:")
        print(df[~df['RES_CENTROID'].isnull()]['MUNIC_RES'].shape)
    
    if df['MOV_CENTROID'].isnull().any():
        print("Null values in MOV_CENTROID:")
        print(df[~df['MOV_CENTROID'].isnull()]['MUNIC_MOV'].shape)

    # separate centroid coordinates into latitude and longitude
    df[['RES_LAT', 'RES_LON']] = pd.DataFrame(df['RES_CENTROID'].tolist(), index=df.index)
    df[['MOV_LAT', 'MOV_LON']] = pd.DataFrame(df['MOV_CENTROID'].tolist(), index=df.index)

    df.drop(columns=['RES_CENTROID', 'MOV_CENTROID'], inplace=True)

    df['CD_MUN_RES'] = df['MUNIC_RES'].map(mapa['CD_MUN'])
    df['CD_MUN_MOV'] = df['MUNIC_MOV'].map(mapa['CD_MUN'])




    df['DIST_KM'] = df.apply(calc_distance, axis=1)


    df.to_csv('site/data/graph.csv', index=False)

