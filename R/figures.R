# Save figures and tables to the output folders.
#
# Figures: output/figures/main/          (Figs 1-5)
#          output/figures/supplementary/ (Figs S1-S53)
# Tables:  output/tables/supplementary/  (Tables S1-S5)
#          output/tables/additional/     (values behind figures and reported
#                                         statistics, not in the Supplementary
#                                         Information)

figure_dir <- function(type = c("main", "supplementary")) {
  type <- match.arg(type)
  dir <- here::here("output", "figures", type)
  dir.create(dir, recursive = TRUE, showWarnings = FALSE)
  dir
}

table_dir <- function(type = c("main", "supplementary", "additional")) {
  type <- match.arg(type)
  dir <- here::here("output", "tables", type)
  dir.create(dir, recursive = TRUE, showWarnings = FALSE)
  dir
}

# Saves one ggplot in several formats with the same dimensions. Main figures
# are also saved as SVG for final layout; supplementary figures as PNG and PDF
# only (their SVGs are large and not needed).
save_figure <- function(plot, name, width, height,
                        type = c("main", "supplementary"),
                        formats = NULL,
                        dpi = 400) {
  type <- match.arg(type)
  if (is.null(formats)) {
    formats <- if (type == "main") c("png", "svg", "pdf") else c("png", "pdf")
  }
  dir <- figure_dir(type)
  for (fmt in formats) {
    # cairo_pdf embeds fonts registered with showtext/sysfonts, which the
    # default pdf device cannot find
    ggplot2::ggsave(
      filename = file.path(dir, paste0(name, ".", fmt)),
      plot = plot,
      width = width,
      height = height,
      dpi = dpi,
      device = if (fmt == "pdf") grDevices::cairo_pdf else NULL
    )
  }
  invisible(file.path(dir, paste0(name, ".", formats)))
}

save_table <- function(x, name, type = c("main", "supplementary", "additional")) {
  path <- file.path(table_dir(match.arg(type)), paste0(name, ".csv"))
  utils::write.csv(x, path, row.names = FALSE)
  invisible(path)
}
