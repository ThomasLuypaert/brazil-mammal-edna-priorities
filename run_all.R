# Runs the analysis pipeline from start to finish.
#
# Each document is rendered in a separate R session, so it can only use
# the objects it loads explicitly from output/intermediate/.
#
# Step 0 (building the reference databases with CRABS) runs outside R.
# See 0_Get_reference_data/README.md. Its output (data/CRABS/) must be
# in place before step 1.
#
# To run part of the pipeline, change steps_to_run, e.g. steps_to_run <- 3:4.
# Later steps require the outputs of earlier steps. Runtimes are added to
# output/runtimes.csv, replacing earlier runtimes of the same steps.

steps <- c(
  "1_Prepare_data.Rmd",
  "2_Assess_completeness_ambiguity_complementarity.Rmd",
  "3_Drivers_of_database_omission.Rmd",
  "4_Barcoding_priorities.Rmd"
)

steps_to_run <- seq_along(steps)

project_dir  <- here::here()
report_dir   <- file.path(project_dir, "output", "reports")
session_dir  <- file.path(project_dir, "output", "session_info")
runtime_file <- file.path(project_dir, "output", "runtimes.csv")
dir.create(report_dir, recursive = TRUE, showWarnings = FALSE)
dir.create(session_dir, recursive = TRUE, showWarnings = FALSE)

# Runtimes of earlier runs, so that a partial run does not overwrite them

runtimes <- if (file.exists(runtime_file)) {
  utils::read.csv(runtime_file, stringsAsFactors = FALSE)
} else {
  data.frame(step = character(), minutes = numeric(), date = character())
}

for (i in steps_to_run) {
  rmd <- file.path(project_dir, steps[i])
  if (!file.exists(rmd)) stop("Not found: ", steps[i])

  message("\nRendering ", steps[i], " (started ", format(Sys.time(), "%H:%M"), ")")
  start <- Sys.time()

  session <- callr::r(
    function(input, output_dir, root_dir) {
      rmarkdown::render(
        input,
        output_dir = output_dir,
        knit_root_dir = root_dir,
        envir = globalenv(),
        quiet = TRUE
      )
      utils::capture.output(utils::sessionInfo())
    },
    args = list(input = rmd, output_dir = report_dir, root_dir = project_dir),
    show = TRUE
  )

  minutes <- as.numeric(difftime(Sys.time(), start, units = "mins"))
  message(sprintf("Finished %s in %.1f min", steps[i], minutes))

  writeLines(session, file.path(session_dir, sub("\\.Rmd$", ".txt", steps[i])))

  runtimes <- rbind(
    runtimes[runtimes$step != steps[i], , drop = FALSE],
    data.frame(step = steps[i], minutes = round(minutes, 1), date = format(Sys.Date()))
  )
  runtimes <- runtimes[order(match(runtimes$step, steps)), , drop = FALSE]
  utils::write.csv(runtimes, runtime_file, row.names = FALSE)
}

print(runtimes)
