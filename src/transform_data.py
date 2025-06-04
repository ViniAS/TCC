import os
import pandas as pd
from concurrent.futures import ProcessPoolExecutor


def process_file(files, principal_diagnosis):
    """Process a list of files and filter by principal diagnosis.

    Args:
        files (list[str]): The paths to the parquet files to process.
        principal_diagnosis (list[str]): List of principal diagnoses to filter by.

    Returns:
        pd.DataFrame: The processed DataFrame.
    """    
    dfs = []
    for file in files:
        df = pd.read_parquet(file)
        if len(principal_diagnosis) > 0:
            df = df[df['DIAG_PRINC'].str[:3].isin(principal_diagnosis)]
        df = df.groupby(['MUNIC_MOV', 'MUNIC_RES']).size().reset_index(name='HOSPITALIZACOES')
        dfs.append(df)
    if dfs:
        df = pd.concat(dfs, ignore_index=True)
        df = df.groupby(['MUNIC_MOV', 'MUNIC_RES'], as_index=False).sum()

        df = df.dropna(subset=['MUNIC_MOV', 'MUNIC_RES'])
        df = df[~df['MUNIC_MOV'].str.isspace() & ~df['MUNIC_RES'].str.isspace()]
        return df
    else:
        return pd.DataFrame(columns=['MUNIC_MOV', 'MUNIC_RES', 'HOSPITALIZACOES'])
    

def process_file_star(args):
    """ Helper function to unpack arguments for parallel processing. """
    return process_file(*args)


def agg_num_hosp_city_hospital(uf: list[str]=[], months: list[int]=[], principal_diagnosis: list[str]=[], num_cpus: int=None):
    """ Aggregates by selected months and states (UFs) and optionally filters by principal diagnosis.
        Then, we group the number of hospitalizations by county and hospital.

    Args:

        uf (list[str], optional): List of UFs (states) to filter the data, if non empty list. Defaults to [].
        months (list[int], optional): List of months to filter the data, if non empty list. Defaults to [].
        principal_diagnosis (list[str], optional): Principal diagnosis to filter the data, if provided. Defaults to [].
        num_cpus (int, optional): Number of CPUs to use for parallel processing. Defaults to None, which uses all available CPUs.
    """  

    files = [f'data/SIH/{file}' for file in os.listdir('data/SIH') if file.endswith('.parquet')]
    if len(uf) > 0:
        files = [file for file in files if file[11:13] in uf] # Filter by UF (state)
    if len(months) > 0:
        files = [file for file in files if int(file[15:17]) in months] # Filter by month
    if len(files) == 0:
        raise ValueError("No files found matching the specified criteria.")
    
    # group filesnames in a dictionary by UF
    grouped_files = dict()
    for file in files:
        uf_code = file[11:13]
        if uf_code not in grouped_files:
            grouped_files[uf_code] = []
        grouped_files[uf_code].append(file)
    
    # Aggregate the data in parallel
    num_cpus = num_cpus or os.cpu_count()
    args = [(file_list, principal_diagnosis) for file_list in grouped_files.values()]
    with ProcessPoolExecutor(max_workers=num_cpus) as executor:
        data = list(executor.map(process_file_star, args))

    data = pd.concat(data, ignore_index=True)
    return data


def get_city_name(city_codes: pd.Series) -> pd.Series:
    """Get the name of the city from its code."""
    city_names = pd.read_csv('data/aux_data/MUNIC_BR.csv', sep=';')
    city_names = city_names.set_index('cod')['value']
    return city_codes.map(city_names).fillna('Unknown City')


if __name__ == "__main__":

    cid10_chapters = pd.read_csv('data/CID10/cid10_capitulos.csv', sep=';')
    principal_diagnosis = cid10_chapters[cid10_chapters['descricao'].str.startswith('Capítulo I -')]['codigo'].tolist()
    transformed_data = agg_num_hosp_city_hospital(uf=[], principal_diagnosis=principal_diagnosis)
    print(transformed_data.head())
    
    if not os.path.exists('data/agg_data'):
        os.makedirs('data/agg_data')
    transformed_data.to_csv('data/agg_data/infectious_disease.csv', index=False)
    print("Transformed data saved")
