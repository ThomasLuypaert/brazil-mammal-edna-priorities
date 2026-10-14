# Input data

All public datasets are downloaded automatically by `1_Prepare_data.Rmd` when they are missing, from pinned versions, into the folders listed below. Files that are already present are never downloaded again. The only input that is not downloaded automatically is the set of primer-specific reference databases in `CRABS/`, which is produced by step 0 (`0_Get_reference_data/`).

## Datasets

| Folder | Dataset | Version | Source | Obtained | Used for |
|------------|------------|------------|------------|------------|------------|
| `CRABS/` | Primer-specific mammal reference databases built from MIDORI2 with CRABS v1.0.7 | MIDORI2 GB264 (14/12/2024) | Step 0 of this pipeline | Step 0 | Reference sequences for all analyses |
| `Species_lists/Brazilian_mammals_2024-1/` | Lista de Mamíferos do Brasil (Abreu et al. 2024); file `Mammalia_SBMz_v2024-1_Dez.xlsx` | 2024-1 | [Zenodo 14536925](https://doi.org/10.5281/zenodo.14536925) | Automatic | Species checklist, taxonomy, diet, locomotion, endemism, year of description, SALVE status |
| `Species_lists/Global_mammals_v2.0/` | Mammal Diversity Database; files `MDD_v2.0_6759species.csv`, `Species_Syn_v2.0.csv` | v2.0 | [Zenodo 15007505](https://doi.org/10.5281/zenodo.15007505) | Automatic | Synonyms, global species list, family assignments for grafting |
| `Phylogenetic_tree/Phylacine_v1.2.1/` | PHYLACINE (Faurby et al. 2018); file `PHYLACINE_v1.2.1.zip` | 1.2.1 | [Zenodo 3690867](https://doi.org/10.5281/zenodo.3690867) | Automatic (only when the phylogenies are rebuilt) | Phylogenies (first 100 of 1,000 trees) |
| `Traits/1.0.1/` | TetrapodTraits (Moura et al. 2024), main trait table `TetrapodTraits_1.0.0.csv` | 1.0.1 | [Zenodo 11303604](https://doi.org/10.5281/zenodo.11303604) | Automatic | Body mass, range size |
| `Range_maps/MDD_v1.2/` | Expert range maps (Marsh et al. 2022), harmonised to the MDD v1.2 taxonomy; files `MDD_<Order>.gpkg` for the 11 orders occurring in Brazil | MDD v1.2 taxonomy | [Zenodo 6644198](https://doi.org/10.5281/zenodo.6644198) | Automatic | Human population density within ranges (Part 1); spatial prioritisation (Part 4) |
| `Environmental_variables/` | WorldPop population density, Brazil, 2020, unconstrained; file `bra_pd_2020_1km.tif` | 2020, 30 arc-second (\~1 km) | [WorldPop](https://data.worldpop.org/GIS/Population_Density/Global_2000_2020_1km/2020/BRA/) | Automatic | Human population density within the Brazilian portion of each range |

## Data retrieved from online services

These data are retrieved through APIs whose content changes over time. They are retrieved once and cached in `output/cache/`, and later runs use the cached files. The cached files are included in the archived version on Zenodo, so that the exact data used in the paper can be reproduced.

| Service | Content | Version / access date | Package | Cached in |
|---------------|---------------|---------------|---------------|---------------|
| IUCN Red List API | Red List category for Brazilian species and all species in the global phylogeny | Red List 2025-2. | rredlist | `output/cache/iucn_data.rds` |
| GBIF backbone taxonomy | Additional synonyms for Brazilian species | Accessed 2025 | rgbif | `output/cache/brz_mam_synonyms.rds` |
| NCBI GenBank | Full records for a random 10% sample of accessions in the reference databases | Accessed 2025 | rentrez | `output/cache/genbank_records.rds` |

Rebuilding the IUCN cache requires an IUCN Red List API token, stored in the environment variable `IUCN_REDLIST_KEY` (e.g. in `~/.Renviron`).

## Licences

Each dataset remains subject to the licence and terms of use of its source; see the linked records. The cached IUCN data contain only the Red List category of each species (IUCN Red List version 2025-2), retrieved through the IUCN Red List API, and are shared for non-commercial research use with attribution: IUCN (2025). The IUCN Red List of Threatened Species. Version 2025-2. https://www.iucnredlist.org. Use of these data remains subject to the IUCN Red List terms of use.
