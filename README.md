# Como usar
Primeiro, instale as dependências do projeto com o comando:

```bash
poetry install
```
Depois, você precisa baixar os dados do SIH/SUS:

```bash
poetry run python src/load_data.py
```
Feito isso, você pode fazer as transformações necessárias nos dados com o comando:

```bash
poetry run python src/transform_data.py
```
Com o notebook `graph.ipynb`, você pode visualizar as análises feitas até agora.

# Fontes de dados

https://pcdas.icict.fiocruz.br/conjunto-de-dados/sistema-de-informacoes-hospitalares-do-sus-sihsus/documentacao/

https://www.ibge.gov.br/estatisticas/sociais/populacao/9103-estimativas-de-populacao.html?=&t=resultados

https://www.ibge.gov.br/geociencias/organizacao-do-territorio/malhas-territoriais/15774-malhas.html