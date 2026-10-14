#!/bin/bash
#SBATCH --job-name=2_download_MIDORI
#SBATCH --cpus-per-task=1
#SBATCH --mem=11G
#SBATCH --time=04:00:00
#SBATCH --output=%x_%j.log
#
# Step 2: download the 12S (srRNA), 16S (lrRNA), COI and CytB sequences from
# MIDORI2 (GenBank 264, database type "total", RAW) and import them into CRABS
# format with the NCBI taxonomy from step 1.
# Run from this folder (0_Get_reference_data/): bash 2_download_MIDORI.sh (or sbatch on a SLURM cluster).

set -euo pipefail
# Under SLURM the script runs from a copy, so config.sh is found via the submit folder
source "${SLURM_SUBMIT_DIR:-$(dirname "$0")}/config.sh"

BASE_URL="https://www.reference-midori.info/download/Databases/$MIDORI_RELEASE/RAW/total"

# MIDORI2 file name of each locus
declare -A MIDORI_GENE=( [12S]=srRNA [16S]=lrRNA [COI]=CO1 [Cytb]=Cytb )

for locus in "${LOCI[@]}"; do
  dir="$WORK_DIR/$locus"
  mkdir -p "$dir"
  raw="$dir/1_midori_${locus}_download.fasta"
  url="$BASE_URL/MIDORI2_TOTAL_NUC_GB${MIDORI_GB}_${MIDORI_GENE[$locus]}_RAW.fasta.gz"

  log "$locus: downloading $url"
  wget --progress=dot:giga -O "$raw.gz" "$url"
  gunzip -f "$raw.gz"

  log "$locus: importing into CRABS format"
  crabs_run --import --import-format ncbi \
    --input "$raw" \
    --names "$TAX_DIR/names.dmp" \
    --nodes "$TAX_DIR/nodes.dmp" \
    --acc2tax "$TAX_DIR/nucl_gb.accession2taxid" \
    --output "$(midori_db "$locus")" \
    --ranks 'superkingdom;phylum;class;order;family;genus;species'
done

log "Done"
