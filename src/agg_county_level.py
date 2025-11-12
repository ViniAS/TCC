import pandas as pd
import numpy as np
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
    

def haversine_vectorized(lat1, lon1, lat2, lon2):
    """
    Calculate the great circle distance between two points 
    on the earth (specified in decimal degrees) using vectorized operations
    """
    # Convert decimal degrees to radians
    lat1, lon1, lat2, lon2 = map(np.radians, [lat1, lon1, lat2, lon2])
    
    # Haversine formula
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    
    a = np.sin(dlat/2)**2 + np.cos(lat1) * np.cos(lat2) * np.sin(dlon/2)**2
    c = 2 * np.arcsin(np.sqrt(a))
    
    # Radius of earth in kilometers
    r = 6371
    
    return c * r


if __name__ == "__main__":

    df = pd.read_parquet('data/agg_data/hospitalizacoes.parquet')
    
    groups = pd.read_csv('data/CID10/cid10_capitulos.csv',sep=';',index_col='codigo')['descricao_breve']
    groups = groups[~groups.index.duplicated(keep='first')]
    df['DIAG_PRINC'] = df['DIAG_PRINC'].map(groups)
    
    df= df.groupby([
        'MUNIC_MOV',
        'MUNIC_RES',
        'DIAG_PRINC',
        'ANO_CMPT'
    ], as_index=False).sum()

    df['UF_RES'] = get_state_name(df['MUNIC_RES'])
    df['UF_MOV'] = get_state_name(df['MUNIC_MOV'])
    
    df['MUNIC_RES'] = get_city_name(df['MUNIC_RES'])
    df['MUNIC_MOV'] = get_city_name(df['MUNIC_MOV'])

    df['MUNIC_RES'] = df['MUNIC_RES'].astype(str) + ' - ' + df['UF_RES']
    df['MUNIC_MOV'] = df['MUNIC_MOV'].astype(str) + ' - ' + df['UF_MOV']

    df['MUNIC_RES'] = df['MUNIC_RES'].replace('Eldorado dos Carajás - Pará', 'Eldorado do Carajás - Pará')
    df['MUNIC_RES'] = df['MUNIC_RES'].replace('Santa Isabel do Pará - Pará', 'Santa Izabel do Pará - Pará')
    df['MUNIC_RES'] = df['MUNIC_RES'].replace('Ererê - Ceará', 'Ereré - Ceará')
    df['MUNIC_RES'] = df['MUNIC_RES'].replace('Itapagé - Ceará', 'Itapajé - Ceará')
    df['MUNIC_RES'] = df['MUNIC_RES'].replace("Olho-d'Água do Borges - Rio Grande do Norte", "Olho d'Água do Borges - Rio Grande do Norte")
    df['MUNIC_RES'] = df['MUNIC_RES'].replace("Presidente Juscelino - Rio Grande do Norte", "Serra Caiada - Rio Grande do Norte")
    df = df[df['MUNIC_RES']!='Seridó - Paraíba'].copy()
    df['MUNIC_RES'] = df['MUNIC_RES'].replace('Iguaraci - Pernambuco', 'Iguaracy - Pernambuco')
    df['MUNIC_RES'] = df['MUNIC_RES'].replace('São Vicente Ferrer - Pernambuco', 'São Vicente Férrer - Pernambuco')
    df['MUNIC_RES'] = df['MUNIC_RES'].replace('Araças - Bahia', 'Araçás - Bahia')
    df['MUNIC_RES'] = df['MUNIC_RES'].replace('Iuiú - Bahia', 'Iuiu - Bahia')
    df['MUNIC_RES'] = df['MUNIC_RES'].replace('Santa Teresinha - Bahia', 'Santa Terezinha - Bahia')
    df['MUNIC_RES'] = df['MUNIC_RES'].replace('Brasópolis - Minas Gerais', 'Brazópolis - Minas Gerais')
    df['MUNIC_RES'] = df['MUNIC_RES'].replace('Atilio Vivacqua - Espírito Santo', 'Atílio Vivácqua - Espírito Santo')
    df['MUNIC_RES'] = df['MUNIC_RES'].replace('Moji Mirim - São Paulo', 'Mogi Mirim - São Paulo')
    df['MUNIC_RES'] = df['MUNIC_RES'].replace('São Luís do Paraitinga - São Paulo', 'São Luiz do Paraitinga - São Paulo')
    df['MUNIC_RES'] = df['MUNIC_RES'].replace('Lauro Muller - Santa Catarina', 'Lauro Müller - Santa Catarina')
    df['MUNIC_RES'] = df['MUNIC_RES'].replace('Restinga Seca - Rio Grande do Sul', 'Restinga Sêca - Rio Grande do Sul')
    df['MUNIC_RES'] = df['MUNIC_RES'].replace('Poxoréo - Mato Grosso', 'Poxoréu - Mato Grosso')
    df['MUNIC_RES'] = df['MUNIC_RES'].replace('São Luíz do Norte - Goiás', 'São Luiz do Norte - Goiás')
    df = df[df['MUNIC_RES']!='Unknown City - Distrito Federal'].copy()
    df['MUNIC_RES'] = df['MUNIC_RES'].replace('Santo Antônio do Leverger - Mato Grosso', 'Santo Antônio de Leverger - Mato Grosso')
    df['MUNIC_RES'] = df['MUNIC_RES'].replace('Westfalia - Rio Grande do Sul', 'Westfália - Rio Grande do Sul')
    df['MUNIC_RES'] = df['MUNIC_RES'].replace('Vespasiano Correa - Rio Grande do Sul', 'Vespasiano Corrêa - Rio Grande do Sul')
    df['MUNIC_RES'] = df['MUNIC_RES'].replace('Passa-Vinte - Minas Gerais', 'Passa Vinte - Minas Gerais')
    df['MUNIC_RES'] = df['MUNIC_RES'].replace('Dona Eusébia - Minas Gerais', 'Dona Euzébia - Minas Gerais')
    df['MUNIC_RES'] = df['MUNIC_RES'].replace('São Thomé das Letras - Minas Gerais', 'São Tomé das Letras - Minas Gerais')
    df['MUNIC_RES'] = df['MUNIC_RES'].replace('Barão de Monte Alto - Minas Gerais', 'Barão do Monte Alto - Minas Gerais')
    df['MUNIC_RES'] = df['MUNIC_RES'].replace('Gracho Cardoso - Sergipe', 'Graccho Cardoso - Sergipe')
    df['MUNIC_RES'] = df['MUNIC_RES'].replace('Amparo de São Francisco - Sergipe', 'Amparo do São Francisco - Sergipe')
    df['MUNIC_RES'] = df['MUNIC_RES'].replace('São Cristovão do Sul - Santa Catarina', 'São Cristóvão do Sul - Santa Catarina')
    df['MUNIC_RES'] = df['MUNIC_RES'].replace('Grão Pará - Santa Catarina', 'Grão-Pará - Santa Catarina')
    df['MUNIC_RES'] = df['MUNIC_RES'].replace('Biritiba-Mirim - São Paulo', 'Biritiba Mirim - São Paulo')
    df['MUNIC_RES'] = df['MUNIC_RES'].replace('Itaóca - São Paulo', 'Itaoca - São Paulo')
    df['MUNIC_RES'] = df['MUNIC_RES'].replace('Florínia - São Paulo', 'Florínea - São Paulo')
    df['MUNIC_RES'] = df['MUNIC_RES'].replace('Fortaleza do Tabocão - Tocantins', 'Tabocão - Tocantins')
    df['MUNIC_RES'] = df['MUNIC_RES'].replace('Muquém de São Francisco - Bahia', 'Muquém do São Francisco - Bahia')
    df['MUNIC_RES'] = df['MUNIC_RES'].replace('Quixabá - Paraíba', 'Quixaba - Paraíba')
    df['MUNIC_RES'] = df['MUNIC_RES'].replace('Augusto Severo - Rio Grande do Norte', 'Campo Grande - Rio Grande do Norte')
    
    df['MUNIC_MOV'] = df['MUNIC_MOV'].replace('Eldorado dos Carajás - Pará', 'Eldorado do Carajás - Pará')
    df['MUNIC_MOV'] = df['MUNIC_MOV'].replace('Santa Isabel do Pará - Pará', 'Santa Izabel do Pará - Pará')
    df['MUNIC_MOV'] = df['MUNIC_MOV'].replace('Ererê - Ceará', 'Ereré - Ceará')
    df['MUNIC_MOV'] = df['MUNIC_MOV'].replace('Itapagé - Ceará', 'Itapajé - Ceará')
    df['MUNIC_MOV'] = df['MUNIC_MOV'].replace("Olho-d'Água do Borges - Rio Grande do Norte", "Olho d'Água do Borges - Rio Grande do Norte")
    df['MUNIC_MOV'] = df['MUNIC_MOV'].replace("Presidente Juscelino - Rio Grande do Norte", "Serra Caiada - Rio Grande do Norte")
    df = df[df['MUNIC_MOV']!='Seridó - Paraíba'].copy()
    df['MUNIC_MOV'] = df['MUNIC_MOV'].replace('Iguaraci - Pernambuco', 'Iguaracy - Pernambuco')
    df['MUNIC_MOV'] = df['MUNIC_MOV'].replace('São Vicente Ferrer - Pernambuco', 'São Vicente Férrer - Pernambuco')
    df['MUNIC_MOV'] = df['MUNIC_MOV'].replace('Araças - Bahia', 'Araçás - Bahia')
    df['MUNIC_MOV'] = df['MUNIC_MOV'].replace('Iuiú - Bahia', 'Iuiu - Bahia')
    df['MUNIC_MOV'] = df['MUNIC_MOV'].replace('Santa Teresinha - Bahia', 'Santa Terezinha - Bahia')
    df['MUNIC_MOV'] = df['MUNIC_MOV'].replace('Brasópolis - Minas Gerais', 'Brazópolis - Minas Gerais')
    df['MUNIC_MOV'] = df['MUNIC_MOV'].replace('Atilio Vivacqua - Espírito Santo', 'Atílio Vivácqua - Espírito Santo')
    df['MUNIC_MOV'] = df['MUNIC_MOV'].replace('Moji Mirim - São Paulo', 'Mogi Mirim - São Paulo')
    df['MUNIC_MOV'] = df['MUNIC_MOV'].replace('São Luís do Paraitinga - São Paulo', 'São Luiz do Paraitinga - São Paulo')
    df['MUNIC_MOV'] = df['MUNIC_MOV'].replace('Lauro Muller - Santa Catarina', 'Lauro Müller - Santa Catarina')
    df['MUNIC_MOV'] = df['MUNIC_MOV'].replace('Restinga Seca - Rio Grande do Sul', 'Restinga Sêca - Rio Grande do Sul')
    df['MUNIC_MOV'] = df['MUNIC_MOV'].replace('Poxoréo - Mato Grosso', 'Poxoréu - Mato Grosso')
    df['MUNIC_MOV'] = df['MUNIC_MOV'].replace('São Luíz do Norte - Goiás', 'São Luiz do Norte - Goiás')
    df = df[df['MUNIC_MOV']!='Unknown City - Distrito Federal'].copy()
    
    mapa = gpd.read_file("data/BR_Municipios_2024/BR_Municipios_2024.shp")

    mapa['MUN'] = mapa['NM_MUN'].astype(str) + ' - ' + mapa['NM_UF']
    mapa.set_index('MUN', inplace=True)
    
    print(df.head())

    # Pre-compute centroids for all municipalities (vectorized operation)
    mapa['centroid'] = mapa.geometry.centroid
    mapa['centroid_lat'] = mapa['centroid'].y
    mapa['centroid_lon'] = mapa['centroid'].x

    # Create lookup dictionaries for fast access
    centroid_lat_dict = mapa['centroid_lat'].to_dict()
    centroid_lon_dict = mapa['centroid_lon'].to_dict()
    
    df['RES_LAT'] = df['MUNIC_RES'].map(centroid_lat_dict)
    df['RES_LON'] = df['MUNIC_RES'].map(centroid_lon_dict)
    df['MOV_LAT'] = df['MUNIC_MOV'].map(centroid_lat_dict)
    df['MOV_LON'] = df['MUNIC_MOV'].map(centroid_lon_dict)

    df['CD_MUN_RES'] = df['MUNIC_RES'].map(mapa['CD_MUN'])
    df['CD_MUN_MOV'] = df['MUNIC_MOV'].map(mapa['CD_MUN'])

    # Add distance column to your dataframe
    df['DISTANCE'] = haversine_vectorized(
        df['RES_LAT'], df['RES_LON'], 
        df['MOV_LAT'], df['MOV_LON']
    )
    df = df.astype({'MUNIC_MOV':'string','MUNIC_RES':'string',
           'DIAG_PRINC':'string',
           'ANO_CMPT':'string',
           'HOSPITALIZACOES':np.int32,
           'UF_RES':'string',
           'UF_MOV':'string','RES_LAT':np.float32,
           'RES_LON':np.float32,'MOV_LAT':np.float32,
           'MOV_LON':np.float32,'CD_MUN_RES':np.int32,'CD_MUN_MOV':np.int32, 'DISTANCE':np.float32})

    df.to_parquet('data/agg_data/graph.parquet', index=False)

