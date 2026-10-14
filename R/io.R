# Read and write objects passed between the analysis documents.
#
# Each document saves the objects it produces to
# output/intermediate/<step>.rds. Downstream documents load the objects
# they need by name, so every dependency is listed at the top of the
# document that uses it.
 
intermediate_dir <- function() here::here("output", "intermediate")
 
save_step <- function(step, objects, envir = parent.frame()) {
  found <- vapply(objects, exists, logical(1), envir = envir, inherits = FALSE)
  if (!all(found)) {
    stop("Not found in environment: ", paste(objects[!found], collapse = ", "))
  }
  dir.create(intermediate_dir(), recursive = TRUE, showWarnings = FALSE)
  path <- file.path(intermediate_dir(), paste0(step, ".rds"))
  saveRDS(mget(objects, envir = envir), path)
  message("Saved ", length(objects), " objects to ", basename(path))
  invisible(path)
}
 
load_step <- function(step, objects, envir = parent.frame()) {
  path <- file.path(intermediate_dir(), paste0(step, ".rds"))
  if (!file.exists(path)) {
    stop("Missing ", basename(path), ". Run ", step, ".Rmd first.")
  }
  saved <- readRDS(path)
  absent <- setdiff(objects, names(saved))
  if (length(absent) > 0) {
    stop(basename(path), " does not contain: ", paste(absent, collapse = ", "))
  }
  list2env(saved[objects], envir = envir)
  invisible(objects)
}
 
# Path for a cached brms fit, for use with brm(file = model_file("fit_2")).
# brms adds the .rds extension itself.
model_file <- function(name) {
  dir <- here::here("output", "models")
  dir.create(dir, recursive = TRUE, showWarnings = FALSE)
  file.path(dir, name)
}
 
# Path for slow intermediate results cached within a single document
# (e.g. API downloads, tree grafting).
cache_file <- function(name) {
  dir <- here::here("output", "cache")
  dir.create(dir, recursive = TRUE, showWarnings = FALSE)
  file.path(dir, name)
}
