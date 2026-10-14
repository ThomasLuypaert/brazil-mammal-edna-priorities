# Step 0: Build the reference databases

The scripts in this folder build one curated reference database per primer set with CRABS v1.0.7 (Jeunen et al. 2023), and write the final FASTA files to `data/CRABS/`. The final databases are included in the repository, so this step is only needed to rebuild them.

## Procedure

1. Download the NCBI taxonomy used by CRABS to assign taxonomy to the sequences.
2. Download the 12S, 16S, COI and CytB sequences from MIDORI2 (Leray et al. 2022; GenBank release 264, 14/12/2024, database type "total", RAW) and import them into CRABS format.
3. Run in-silico PCR with each primer set (Table 1 in the paper) to extract the amplicons.
4. Use the extracted amplicons as seeds for pairwise global alignment, to recover amplicons that lack one or both primer-binding regions (sequences up to 10,000 bp; at least 95% identity and 95% coverage).
5. Dereplicate (keeping unique sequences per species), keep mammals only, and export in SINTAX format.

## Scripts

| Script | Step | Output (in `work/`, unless stated) |
|---|---|---|
| `config.sh` | Settings shared by all scripts: paths, CRABS container, MIDORI2 release, primer sequences | – |
| `1_download_taxonomy.sh` | 1 | `taxonomy/names.dmp`, `nodes.dmp`, `nucl_gb.accession2taxid` |
| `2_download_MIDORI.sh` | 2 | `<locus>/1_midori_<locus>_download_final.fasta` |
| `3_insilico_PCR.sh` | 3 | `<locus>/3_midori_<locus>_insilico_pcr_<primer>.fasta` |
| `4_pairwise_global_alignment.sh` | 4 | `<locus>/4_midori_<locus>_PGA_<primer>.fasta` |
| `5_dereplicate_subset_export.sh` | 5 | `<locus>/5_…`, `6_…`, `7_midori_<locus>_export_<primer>.fasta`; the last is copied to `data/CRABS/` |

To run, first check the settings in `config.sh`:

- `WORK_DIR`: folder for downloads and intermediate files (several GB; default `0_Get_reference_data/work/`, which is not tracked by git).
- `CRABS_SIF`: path to a Singularity/Apptainer image of CRABS v1.0.7 (e.g. built from `docker://quay.io/biocontainers/crabs:1.0.7--pyhdfd78af_0`). Leave empty to use a local installation.

Then run the scripts in order from this folder, either with `bash` or, on a SLURM cluster, with `sbatch`:

```bash
cd 0_Get_reference_data
sbatch 1_download_taxonomy.sh          # or: bash 1_download_taxonomy.sh
sbatch 2_download_MIDORI.sh
sbatch 3_insilico_PCR.sh
sbatch 4_pairwise_global_alignment.sh
sbatch 5_dereplicate_subset_export.sh
```

Each script needs the output of the previous one, so start a script only when the previous one has finished (or chain them with `sbatch --dependency=afterok:<job id>`). The `#SBATCH` resource settings are those used for the paper; steps 4 and 5 can each take a few days.

The NCBI taxonomy is not versioned: `1_download_taxonomy.sh` downloads the current files, so rebuilding the databases later may give slightly different taxonomic assignments.

## Output

`data/CRABS/` contains one FASTA file per primer set, named `7_midori_<locus>_export_<primer>.fasta`. `1_Prepare_data.Rmd` reads these files and names them by the primer identifiers used in the paper (Table 1):

| File | Primer (paper) | Original name |
|---|---|---|
| `7_midori_12S_export_mimammal.fasta` | Ushio | MiMammal-U |
| `7_midori_12S_export_riaz_degen.fasta` | Riaz | 12S-V5 (with the degenerate reverse primer of Kocher et al.) |
| `7_midori_12S_export_taberlet.fasta` | Taberlet | Mamm01 |
| `7_midori_16S_export_kitano.fasta` | Kitano | L2513/H2714 |
| `7_midori_16S_export_sarri.fasta` | Sarri | (unnamed) |
| `7_midori_16S_export_taberlet_guiget.fasta` | Tabgig | Mamm02 |
| `7_midori_16S_export_taylor.fasta` | Taylor | 16Smam1/16Smam2 |
| `7_midori_COI_export_kocher_1.fasta` | Kocher | COI_minimam |
| `7_midori_COI_export_leray.fasta` | Leray | mlCOIintF/jgHCO2198 |
| `7_midori_Cytb_export_steuber.fasta` | Steuber | cyt b1/cyt b2 |

## References

Jeunen, G.-J. et al. (2023). Crabs—A software program to generate curated reference databases for metabarcoding sequencing data. *Molecular Ecology Resources*, 23, 725–738.

Leray, M., Knowlton, N. & Machida, R. J. (2022). MIDORI2: A collection of quality controlled, preformatted, and regularly updated reference databases for taxonomic assignment of eukaryotic mitochondrial sequences. *Environmental DNA*, 4, 894–907.
