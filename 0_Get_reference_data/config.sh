#!/bin/bash
# Settings shared by the scripts in 0_Get_reference_data/ (sourced, not run).
# Edit the paths below before running.

# Folder for downloads and intermediate files (large: several GB)
WORK_DIR="${WORK_DIR:-$(pwd)/work}"

# Final databases, read by 1_Prepare_data.Rmd
OUT_DIR="${OUT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/data/CRABS}"

# CRABS v1.0.7. Set CRABS_SIF to a Singularity/Apptainer image
# (e.g. built from docker://quay.io/biocontainers/crabs:1.0.7--pyhdfd78af_0),
# or leave it empty to use a local installation of CRABS v1.0.7.
CRABS_SIF="${CRABS_SIF:-}"

# MIDORI2 release used in the paper: GenBank 264 (14 December 2024), database type "total", RAW
MIDORI_RELEASE="GenBank264_2024-12-14"
MIDORI_GB="264"

TAX_DIR="$WORK_DIR/taxonomy"
LOCI=(12S 16S COI Cytb)

# Primer sets (Table 1 in the paper): id | locus | forward | reverse
# The ids are those of the output files; 1_Prepare_data.Rmd maps them to the
# names used in the paper (see README.md).
PRIMERS=(
  "mimammal|12S|GGGTTGGTAAATTTCGTGCCAGC|CATAGTGGGGTATCTAATCCCAGTTTG"
  "riaz_degen|12S|TTAGATACCCCACTATGC|YAGAACAGGCTCCTCTAG"
  "taberlet|12S|CCGCCCGTCACYCTCCT|GTAYRCTTACCWTGTTACGAC"
  "kitano|16S|GCCTGTTTACCAAAAACATCAC|CTCCATAGGGTCTTCTCGTCTT"
  "sarri|16S|AYAAGACGAGAAGACCC|GATTGCGCTGTTATTCC"
  "taberlet_guiget|16S|CGAGAAGACCCTRTGGAGCT|CCGAGGTCRCCCCAACC"
  "taylor|16S|CGGTTGGGGTGACCTCGGA|GCTGTTATCCCTAGGGTAACT"
  "kocher_1|COI|CCCATGCATTCGTAATAA|GTAGAAGTCAGAAGCTTA"
  "leray|COI|GGWACWGGWTGAACWGTWTAY|TANACYTCNGGRTGNCCRAARA"
  "steuber|Cytb|CCATCCAACATCTCAGCATGATGAAA|GCCCCTCAGAATGATATTTGTCCTCA"
)

# Runs CRABS from the container if one is set, otherwise from the local installation
crabs_run() {
  if [[ -n "$CRABS_SIF" ]]; then
    singularity exec "$CRABS_SIF" crabs "$@"
  else
    crabs "$@"
  fi
}

log() { echo "$(date '+%Y-%m-%d %H:%M:%S')  $*"; }

# Full MIDORI2 database of a locus, imported into CRABS format (step 2)
midori_db() { echo "$WORK_DIR/$1/1_midori_$1_download_final.fasta"; }
