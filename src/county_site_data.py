import pandas as pd
import numpy as np

if __name__ == "__main__":
    df = pd.read_parquet('data/agg_data/graph.parquet')
    
    df['HOSPxDIST'] = df['HOSPITALIZACOES'] * df['DISTANCE']
    distdf = df.groupby(['MUNIC_RES','ANO_CMPT','DIAG_PRINC']).agg({'HOSPITALIZACOES':'sum','HOSPxDIST':'sum'})
    distdf['DISTANCE'] = distdf['HOSPxDIST'] / distdf['HOSPITALIZACOES']
    distdf = distdf.drop('HOSPxDIST',axis =1)
    distdf['DISTANCE'] = distdf['DISTANCE'].round(3)
    
    distdf.to_csv('docs/static/data/counties.csv')