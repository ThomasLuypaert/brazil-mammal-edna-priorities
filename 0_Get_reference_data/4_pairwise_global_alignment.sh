#!/bin/bash
#SBATCH --job-name=4_pairwise_global_alignment
#SBATCH --cpus-per-task=1
#SBATCH --mem=11G
#SBATCH --time=3-12:00:00
#SBATCH --output=%x_%j.log
#
# Step 4: pairwise global alignment, using the amplicons from step 3 as seeds
# to recover amplicons that lack one or both primer-binding regions.
# Sequences up to 10,000 bp; matches need >= 95% identity and >= 95% coverage.
# Run from this folder (0_Get_reference_data/): bash 4_pairwise_global_alignment.sh (or sbatch on a SLURM cluster).

set -euo pipefail
# Under SLURM the script runs from a copy, so config.sh is found via the submit folder
source "${SLURM_SUBMIT_DIR:-$(dirname "$0")}/config.sh"

for entry in "${PRIMERS[@]}"; do
  IFS='|' read -r primer locus fwd rev <<< "$entry"
  log "$primer ($locus): pairwise global alignment"
  crabs_run --pairwise-global-alignment \
    --input "$(midori_db "$locus")" \
    --amplicons "$WORK_DIR/$locus/3_midori_${locus}_insilico_pcr_${primer}.fasta" \
    --output "$WORK_DIR/$locus/4_midori_${locus}_PGA_${primer}.fasta" \
    --forward "$fwd" --reverse "$rev" \
    --size-select 10000 --percent-identity 0.95 --coverage 95
done

log "Done"
