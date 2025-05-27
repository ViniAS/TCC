import os
import pandas as pd

def transform_data(uf: list[str]=[], months: list[int]=[], principal_diagnosis: list[str]=[]):
    """ Transforms the data. Aggregates by selected months and states (UFs) and optionally
    filters by principal diagnosis. then We group the number of hospitalizations by county and hospital.

    Args:

        uf (list[str], optional): List of UFs (states) to filter the data, if non empty list. Defaults to [].
        months (list[int], optional): List of months to filter the data, if non empty list. Defaults to [].
        principal_diagnosis (list[str], optional): Principal diagnosis to filter the data, if provided. Defaults to [].
    """    

    # get all files in the data/SIH directory
    files = [f'data/SIH/{file}' for file in os.listdir('data/SIH') if file.endswith('.parquet')]
    
    # filter files by uf and months
    if len(uf) > 0:
        files = [file for file in files if file[11:13] in uf]
    if len(months) > 0:
        files = [file for file in files if int(file[15:17]) in months]

    data = [pd.read_parquet(file) for file in files]

    if len(principal_diagnosis) > 0:
        data = [df[df['DIAG_PRINC'].str[:3].isin(principal_diagnosis)] for df in data]

    data = [df.groupby(['CGC_HOSP', 'MUNIC_RES']).size().reset_index(name='HOSPITALIZACOES') for df in data]

    data = pd.concat(data, ignore_index=True)
    
    return data

if __name__ == "__main__":
    # Example usage
    transformed_data = transform_data(uf=['RJ', 'DF'], months=[1, 2], principal_diagnosis=[])
    print(transformed_data.head())
    transformed_data.to_csv('data/transformed_data.csv', index=False)
    print("Transformed data saved to 'data/transformed_data.csv'")