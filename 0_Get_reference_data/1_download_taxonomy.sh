#!/bin/bash
#SBATCH --job-name=1_download_taxonomy
#SBATCH --cpus-per-task=1
#SBATCH --mem=11G
#SBATCH --time=02:00:00
#SBATCH --output=%x_%j.log
#
# Step 1: download the NCBI taxonomy files used by CRABS to assign taxonomy
# to the sequences (names.dmp, nodes.dmp, nucl_gb.accession2taxid).
# Run from this folder (0_Get_reference_data/): bash 1_download_taxonomy.sh (or sbatch on a SLURM cluster).

set -euo pipefail
# Under SLURM the script runs from a copy, so config.sh is found via the submit folder
source "${SLURM_SUBMIT_DIR:-$(dirname "$0")}/config.sh"

mkdir -p "$TAX_DIR"
cd "$TAX_DIR"

log "Downloading the NCBI taxonomy to $TAX_DIR"
crabs_run --download-taxonomy

log "Done"
