import pandas as pd
import numpy as np

if __name__ == "__main__":
    df = pd.read_parquet('data/agg_data/graph.parquet')
    
    df['HOSPxDIST'] = df['HOSPITALIZACOES'] * df['DISTANCE']
    distdf = df.groupby(['CD_MUN_RES','ANO_CMPT','DIAG_PRINC']).agg({'HOSPITALIZACOES':'sum','HOSPxDIST':'sum'})
    distdf['DISTANCE'] = distdf['HOSPxDIST'] / distdf['HOSPITALIZACOES']
    distdf = distdf.drop('HOSPxDIST',axis =1)
    distdf['DISTANCE'] = distdf['DISTANCE'].round(3)
    distdf = distdf.reset_index(drop=False)
    
    diag = pd.DataFrame(distdf['DIAG_PRINC'].unique()).rename({0:'DIAG_PRINC'},axis=1) \
    .reset_index(drop=False).set_index('DIAG_PRINC').rename({'index':'COD'},axis=1) + 1
    
    distdf['DIAG_PRINC'] = distdf['DIAG_PRINC'].map(diag['COD'])
    
    county_info =  df.groupby(['CD_MUN_RES']).agg({'MUNIC_RES':'first','UF_RES':'first','RES_LAT':'first','RES_LON':'first'}) \
    .rename({'CD_MUN_RES':'CD_MUN','UF_RES':'UF','RES_LAT':'LAT','RES_LON':'LON'},axis=1).rename_axis('CD_MUN')
    
    distdf.to_csv('docs/static/data/counties.csv',index=False)
    diag = pd.concat([pd.DataFrame({'DIAG_PRINC':['Todos'],'COD':[0]}).set_index('DIAG_PRINC',drop=True), diag],axis=0)
    diag.to_csv('docs/static/data/diag.csv')
    county_info.to_csv('docs/static/data/county_info.csv')