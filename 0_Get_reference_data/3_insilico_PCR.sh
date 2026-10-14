#!/bin/bash
#SBATCH --job-name=3_insilico_PCR
#SBATCH --cpus-per-task=1
#SBATCH --mem=11G
#SBATCH --time=08:00:00
#SBATCH --output=%x_%j.log
#
# Step 3: in-silico PCR with each primer set, to extract the amplicons from
# the MIDORI2 database of the corresponding locus.
# Run from this folder (0_Get_reference_data/): bash 3_insilico_PCR.sh (or sbatch on a SLURM cluster).

set -euo pipefail
# Under SLURM the script runs from a copy, so config.sh is found via the submit folder
source "${SLURM_SUBMIT_DIR:-$(dirname "$0")}/config.sh"

for entry in "${PRIMERS[@]}"; do
  IFS='|' read -r primer locus fwd rev <<< "$entry"
  log "$primer ($locus): in-silico PCR"
  crabs_run --in-silico-pcr \
    --input "$(midori_db "$locus")" \
    --output "$WORK_DIR/$locus/3_midori_${locus}_insilico_pcr_${primer}.fasta" \
    --forward "$fwd" --reverse "$rev"
done

log "Done"
