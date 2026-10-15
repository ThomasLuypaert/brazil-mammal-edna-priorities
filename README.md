# Knowledge gaps and sequencing priorities for mammalian eDNA metabarcoding in the world's largest tropical forest country

Code and data for:

> Luypaert T., Farias I.P., Hrbek T., Peres C.A. & Haugaasen T. (2026). Knowledge gaps and sequencing priorities for mammalian eDNA metabarcoding in the world's largest tropical forest country. *Nature Communications* [in review].

Archived version (Zenodo): [10.5281/zenodo.23365811](https://doi.org/10.5281/zenodo.23365811)\
Interactive website: <https://thomasluypaert.github.io/brazil-mammal-edna-priorities/>

## Overview

The pipeline quantifies reference database completeness for 731 Brazilian mammal species across 10 eDNA metabarcoding primers targeting four mitochondrial loci (12S, 16S, COI, CytB), models the drivers of omission from reference databases, and derives a Barcoding Priority Score (BPS) to identify sequencing priorities from a global and a local (Brazilian) perspective.

| Step | File | Description | Main outputs |
|------------------|------------------|------------------|------------------|
| 0 | `0_Get_reference_data/` | Download MIDORI2 sequences and build primer-specific reference databases with CRABS | `data/CRABS/` |
| 1 | `1_Prepare_data.Rmd` | Read the reference databases and trace the source of their sequences. Harmonise the species list, synonyms, phylogenies, IUCN status, traits and range-based covariates | `output/intermediate/1_Prepare_data.rds`, Fig. S1 |
| 2 | `2_Assess_completeness_ambiguity_complementarity.Rmd` | Quantify database completeness, sequence ambiguity and its sources, haplotypic depth, and primer complementarity | Figs 1-2, Figs S2-S25, Table S1 |
| 3 | `3_Drivers_of_database_omission.Rmd` | Fit bayesian models of database inclusion, diagnostics and marginal effects | Fig. 3, Figs S26-S50, Tables S2-S3, fitted models in `output/models/` |
| 4 | `4_Barcoding_priorities.Rmd` | Derive a Barcoding Priority Score, priority lists and spatial prioritisation maps | Figs 4-5, Figs S51-S53, Tables S4-S5 |

An fifth document, `5_Website.Rmd`, prepares the data for the [website](#interactive-website) that can be used to engage interactively with the priority lists and download reference datasets.

Each step saves the objects needed by later steps to `output/intermediate/`, and each later step loads only the objects it uses, listed at the top of the document. The statistics reported in the main text are calculated in specific chunks ("Statistics reported in the main text") and appear in the rendered reports in `output/reports/`.

## Data

All public input datasets are downloaded automatically from pinned versions when they are missing. Sources, versions and file names are listed in `data/README.md`. The only input that must be generated separately is the set of reference databases in `data/CRABS/` (step 0), which are included in this repository.

Data retrieved from online services (IUCN Red List, GBIF, NCBI GenBank, PhyloPic) change over time. They are retrieved once and cached in `output/cache/`. To recompute them, set `rebuild_cache <- TRUE` at the top of the relevant document, or delete the files in `output/cache/`. Slow steps (grafting species onto the phylogenies, extracting population density within range maps, calculating evolutionary distinctiveness) are cached in the same way. The cached files and fitted models used for the paper are included in the archived version on Zenodo.

## Requirements

- R 4.6.1. Package versions are recorded in `renv.lock`.
- CRABS v1.0.7 (step 0 only), with bash on Linux. The databases in the paper were built on a SLURM cluster with a Singularity container of CRABS.
- An internet connection (when input files are missing or cached data are rebuilt).
- An IUCN Red List API token, set as the environment variable `IUCN_REDLIST_KEY` (e.g. in `~/.Renviron`). This is only needed if the IUCN data are retrieved again.

## How to run

1.  Clone or download this repository and open `Pipeline.Rproj`.
2.  Restore the package library: `renv::restore()`.
3.  To skip the slow and online steps, use the Zenodo archive instead of the GitHub repository. It contains the same code together with the fitted models, cached online data, intermediate objects and all outputs. The archive is split into several zip files (code, data and website; outputs; fitted models; cache and intermediate objects). Unzip all of them into the same folder to restore the complete project. `MANIFEST.csv` lists which zip file contains each file.
4.  Run `source("run_all.R")`. Missing input data are downloaded on the first run.

Each step can also be executed on its own once the previous steps have run, or run chunk by chunk in RStudio. To run part of the pipeline with `run_all.R`, set `steps_to_run` (e.g. `steps_to_run <- 3:4`). The rendered reports are written to `output/reports/`, and the R session information of each step to `output/session_info/`.

## Runtime and hardware

| Step | Approximate runtime |
|------------------------------------|------------------------------------|
| 1 | 1 min with cached data (longer on the first run, which queries IUCN, GBIF and NCBI and grafts the phylogenies) |
| 2 | 35 min |
| 3 | 53 min with cached models (longer if fitting the models from scratch) |
| 4 | 31 min with cached evolutionary distinctiveness (longer if calculating from scratch) |

Fitted brms models are cached in `output/models/` and reused unless the data or model specification change. Delete these files to force a refit (several hours). The fits used in the paper are included in the Zenodo archive.

## Repository structure

```         
0_Get_reference_data/   CRABS scripts to build the reference databases
R/                      Shared functions (reading/writing intermediate objects, saving figures and tables)
data/                   Input data (see data/README.md)
output/
  intermediate/         Objects passed between steps
  cache/                Cached online data and results of slow steps
  models/               Cached brms fits
  figures/main/         Figures 1-5 (PNG, SVG, PDF)
  figures/supplementary/ Figures S1-S53 (PNG, PDF)
  tables/supplementary/ Tables S1-S5 (CSV)
  tables/additional/    Values behind the figures and reported statistics (CSV)
  reports/              Rendered HTML reports
  session_info/         R session information per step
run_all.R               Runs steps 1-4
5_Website.Rmd           Optional: data for the interactive website
docs/                   Interactive website (GitHub Pages); docs/data/ is written by 5_Website.Rmd
make_archive.R          Builds the Zenodo archive (project plus large outputs, split into zip files)
```

## Outputs

File names are given without extension. Supplementary figure and table files start with their number in the Supplementary Information.

**Main figures** (`output/figures/main/`)

| Figure | Files | Step |
|------------------------|------------------------|------------------------|
| Fig. 1a | `Fig1a_completeness_by_primer` | 2 |
| Fig. 1b | `Fig1b_completeness_by_order_all`, `Fig1b_completeness_by_order_unambiguous` | 2 |
| Fig. 1c | `Fig1c_completeness_by_depth_all`, `Fig1c_completeness_by_depth_unambiguous` | 2 |
| Fig. 1d | `Fig1d_ambiguity_vs_divergence` | 2 |
| Fig. 1e | `Fig1e_ambiguity_by_order` | 2 |
| Fig. 2a | `Fig2a_completeness_range_by_order_all`, `Fig2a_completeness_range_by_order_unambiguous` | 2 |
| Fig. 2b | `Fig2b_primer_complementarity` | 2 |
| Fig. 2c | `Fig2c_primer_rank` | 2 |
| Fig. 2d | `Fig2d_primer_pair_rank` | 2 |
| Fig. 3 | `Fig3_composite` (panels: `Fig3a_time_since_description` to `Fig3g_endemism`) | 3 |
| Fig. 4a | `Fig4a_priority_species_tree` | 4 |
| Fig. 4b | `Fig4b_priority_species_scores` | 4 |
| Fig. 4c | `Fig4c_priority_rank_global_vs_brazil` | 4 |
| Fig. 4d | `Fig4d_priority_categories_by_order` | 4 |
| Fig. 4e | `Fig4e_priority_list_composition_by_order` | 4 |
| Fig. 5a | `Fig5a_species_richness` | 4 |
| Fig. 5b | `Fig5b_priority_richness_<category>_global` | 4 |
| Fig. 5c | `Fig5c_priority_richness_<category>_local` | 4 |
| Fig. 5d | `Fig5d_priority_richness_all`, `Fig5d_priority_richness_<Order>` | 4 |

**Supplementary figures** (`output/figures/supplementary/`)

| Figure | Files | Step |
|------------------------|------------------------|------------------------|
| Fig. S1 | `FigS1_sequence_source_classification` | 1 |
| Figs S2-S12 | `FigS<n>_completeness_by_primer_<Order>` (orders in alphabetical order) | 2 |
| Fig. S13 | `FigS13_ambiguity_and_divergence_by_primer` | 2 |
| Fig. S14 | `FigS14_sources_of_sequence_ambiguity` | 2 |
| Figs S15-S25 | `FigS<n>_primer_complementarity_<Order>` | 2 |
| Fig. S26 | `FigS26_species_described_by_decade` | 3 |
| Fig. S27 | `FigS27_ppc_model0` | 3 |
| Fig. S28 | `FigS28_ppc_model1` | 3 |
| Figs S29-S31 | `FigS29_ppc_model1_body_mass`, `FigS30_ppc_model1_human_population`, `FigS31_ppc_model1_range_size` | 3 |
| Figs S32-S38 | `FigS<n>_traceplots_model1_<group>` | 3 |
| Fig. S39 | `FigS39_ppc_model2` | 3 |
| Figs S40-S42 | `FigS40_ppc_model2_body_mass`, `FigS41_ppc_model2_human_population`, `FigS42_ppc_model2_range_size` | 3 |
| Figs S43-S49 | `FigS<n>_traceplots_model2_<group>` | 3 |
| Fig. S50 | `FigS50a_range_size_model2` to `FigS50e_phylogenetic_effect_model2` | 3 |
| Fig. S51 | `FigS51_score_drivers_by_category` | 4 |
| Fig. S52 | `FigS52_score_drivers_by_order` | 4 |
| Fig. S53 | `FigS53_score_drivers_by_biome` | 4 |

**Supplementary tables** (`output/tables/supplementary/`)

| Table | File | Step |
|------------------------|------------------------|------------------------|
| Table S1 | `TableS1_cross_vs_within_locus_pairs` | 2 |
| Table S2 | `TableS2_model1_parameters` | 3 |
| Table S3 | `TableS3_model2_parameters` | 3 |
| Table S4 | `TableS4_global_priority_species` (one row per species), `TableS4_global_priority_species_formatted` (layout of the Supplementary Information) | 4 |
| Table S5 | `TableS5_local_priority_species`, `TableS5_local_priority_species_formatted` | 4 |

Table 1 (primers) is compiled from the literature and is not produced by the pipeline.

**Additional tables** (`output/tables/additional/`)

These tables are not part of the Supplementary Information, but give the exact values behind the figures and the statistics reported in the text.

| File | Content | Step |
|------------------------|------------------------|------------------------|
| `completeness_by_primer_and_order` | Database completeness per primer and order, for all and unambiguous sequences | 2 |
| `ambiguity_by_primer_and_order` | Species affected by sequence ambiguity per primer and order | 2 |
| `ambiguity_sources_by_order` | Sources of sequence ambiguity per order (Fig. S14) | 2 |
| `sister_pair_distances` | Sequence distance and divergence time for each sister-species pair (Fig. S14c,d) | 2 |
| `best_primer_pair_by_order` | Best primer pair per order, compared with the best pair across all species | 2 |
| `species_described_by_decade`, `species_described_by_decade_and_locus` | Species described per decade and their database inclusion (Fig. S26) | 3 |
| `all_parameters_Model_1`, `all_parameters_Model_2` | All model parameters, including the imputation submodels, at full precision | 3 |
| `barcoding_priority_scores_all_species` | Score components, BPS and priority categories for all 731 species, both perspectives | 4 |
| `priorities_by_region` | Mean priority richness per grid cell, per biome | 4 |
| `threatened_species_by_region` | Traits and scores of globally threatened species per biome | 4 |

## Interactive website {#interactive-website}

The results can be explored at <https://thomasluypaert.github.io/brazil-mammal-edna-priorities/> (in English and Portuguese):

- **Map:** priority species richness per 25 × 25 km grid cell, by priority category and perspective, with the list of priority species in any cell and the range of any species.
- **Priority list:** all 731 species with their priority categories, Barcoding Priority Score and its components, searchable, filterable and downloadable (CSV).
- **Reference sequences:** the reference sequences of Brazilian mammals per primer (FASTA or CSV), filtered by order, priority category or location.

The website is generated from the outputs of Parts 1-4 by `5_Website.Rmd` and served from `docs/`.

## Licence

Code: MIT (see `LICENSE`). Derived data and outputs: CC BY 4.0. Third-party input data remain subject to their original licences (see `data/README.md`).

## Contact

Thomas Luypaert (thomas.luypaert\@outlook.com/thomas.luypaert\@nmbu.no)
