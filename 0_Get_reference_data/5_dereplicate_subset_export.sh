#!/bin/bash
#SBATCH --job-name=5_dereplicate_subset_export
#SBATCH --cpus-per-task=1
#SBATCH --mem=11G
#SBATCH --time=3-12:00:00
#SBATCH --output=%x_%j.log
#
# Step 5: for each primer set, dereplicate (keep unique sequences per species),
# keep mammals only, export in SINTAX format, and copy the final database to
# data/CRABS/, where 1_Prepare_data.Rmd reads it.
# Run from this folder (0_Get_reference_data/): bash 5_dereplicate_subset_export.sh (or sbatch on a SLURM cluster).

set -euo pipefail
# Under SLURM the script runs from a copy, so config.sh is found via the submit folder
source "${SLURM_SUBMIT_DIR:-$(dirname "$0")}/config.sh"

mkdir -p "$OUT_DIR"

for entry in "${PRIMERS[@]}"; do
  IFS='|' read -r primer locus fwd rev <<< "$entry"
  dir="$WORK_DIR/$locus"

  log "$primer ($locus): dereplicating"
  crabs_run --dereplicate \
    --input "$dir/4_midori_${locus}_PGA_${primer}.fasta" \
    --output "$dir/5_midori_${locus}_derep_${primer}.fasta" \
    --dereplication-method 'unique_species'

  log "$primer ($locus): keeping Mammalia"
  crabs_run --subset \
    --input "$dir/5_midori_${locus}_derep_${primer}.fasta" \
    --output "$dir/6_midori_${locus}_subset_${primer}.fasta" \
    --include 'Mammalia'

  log "$primer ($locus): exporting (SINTAX format)"
  final="7_midori_${locus}_export_${primer}.fasta"
  crabs_run --export \
    --input "$dir/6_midori_${locus}_subset_${primer}.fasta" \
    --output "$dir/$final" \
    --export-format 'sintax'

  cp "$dir/$final" "$OUT_DIR/$final"
done

log "Done: final databases in $OUT_DIR"
