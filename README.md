# Distribuição Geográfica de Hospitais Públicos e Mobilidade para Atendimento de Doenças Infecciosas no Brasil

## Acesse O Site
Você pode acessar o site do projeto [aqui](https://vinias.github.io/TCC/)

## Baixar e transformar os dados
Primeiro, instale as dependências do projeto com o comando:

```bash
poetry install
```
Depois, você precisa baixar os dados do SIH/SUS:

```bash
poetry run python -m src.load_data
```
Feito isso, você pode fazer as transformações necessárias nos dados com o comando:

```bash
poetry run python -m src.transform_data
```
Com o notebook `graph.ipynb`, você pode visualizar as análises feitas até agora.

Para gerar os dados necessários para o site, execute:

```bash
poetry run python -m src.agg_county_level
```
```bash
poetry run python -m src.county_site_data
```
```bash
poetry run python -m src.community
```
```bash
poetry run python -m src.agg_state_level
```
```bash
poetry run python -m src.convert_json
```
```bash
poetry run python -m src.load_states_map
```

## Fontes de dados

https://pcdas.icict.fiocruz.br/conjunto-de-dados/sistema-de-informacoes-hospitalares-do-sus-sihsus/documentacao/

https://www.ibge.gov.br/estatisticas/sociais/populacao/9103-estimativas-de-populacao.html?=&t=resultados

https://www.ibge.gov.br/geociencias/organizacao-do-territorio/malhas-territoriais/15774-malhas.html