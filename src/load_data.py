import os
from pysus import SIH


if __name__ == "__main__":
    sih = SIH().load() 

    if not os.path.exists('data/SIH'):
        os.makedirs('data/SIH')

    files = sih.get_files('RD', uf='', year=list(range(2014,2025))) # uf vazio para baixar todos os estados
    sih.download(files, local_dir='data/SIH')
