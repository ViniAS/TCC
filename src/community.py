import pandas as pd
import geopandas as gpd
import networkx as nx
import numpy as np
import matplotlib.pyplot as plt
import igraph as ig

from networkx.algorithms import community


df = pd.read_parquet('data/agg_data/graph.parquet')
df = df[['CD_MUN_MOV','CD_MUN_RES','HOSPITALIZACOES','DIAG_PRINC']]
# df = df[df['CD_MUN_MOV'] != df['CD_MUN_RES']]
df = df.groupby(['CD_MUN_MOV','CD_MUN_RES','DIAG_PRINC']).agg({'HOSPITALIZACOES':'sum'}).reset_index()
df.head()

communities_df = []
for diag in df['DIAG_PRINC'].unique():
    df_diag = df[df['DIAG_PRINC']==diag].drop('DIAG_PRINC',axis=1)
    
    edges = [(df_diag.iloc[i]['CD_MUN_MOV'], df_diag.iloc[i]['CD_MUN_RES']) for i in range(len(df_diag))]
    weights = df_diag['HOSPITALIZACOES'].tolist()
    g_ig = ig.Graph.TupleList(edges, directed=True)
    g_ig.es['weight'] = weights

    # Apply Leiden algorithm
    communities = g_ig.community_infomap(edge_weights='weight', vertex_weights=None)

    print(f"{diag}.\n Number of communities found: {len(communities)}")
    
    membership = communities.membership
    
    community_df = pd.DataFrame({
    'municipality': [g_ig.vs[i]['name'] for i in range(len(g_ig.vs))],
    'community_id': membership
    })
    
    community_df['DIAG_PRINC'] = diag
    
    communities_df.append(community_df)
    
df = df.groupby(['CD_MUN_MOV','CD_MUN_RES']).agg({'HOSPITALIZACOES':'sum'}).reset_index()

edges = [(df.iloc[i]['CD_MUN_MOV'], df.iloc[i]['CD_MUN_RES']) for i in range(len(df))]
weights = df['HOSPITALIZACOES'].tolist()
g_ig = ig.Graph.TupleList(edges, directed=True)
g_ig.es['weight'] = weights

# Apply Leiden algorithm
communities = g_ig.community_infomap(edge_weights='weight', vertex_weights=None)

print(f"Todos.\n Number of communities found: {len(communities)}")

membership = communities.membership

community_df = pd.DataFrame({
'municipality': [g_ig.vs[i]['name'] for i in range(len(g_ig.vs))],
'community_id': membership
})

community_df['DIAG_PRINC'] = 'Todos'

communities_df.append(community_df)
    
communities_df = pd.concat(communities_df)

diags = pd.read_csv('docs/static/data/diag.csv',index_col='DIAG_PRINC')

communities_df['DIAG_PRINC'] = communities_df['DIAG_PRINC'].map(diags['COD'])

communities_df.to_csv('docs/static/data/communities.csv')