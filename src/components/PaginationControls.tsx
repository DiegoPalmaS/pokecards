type PaginationControlsProps = {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
}

function buildPages(currentPage: number, totalPages: number) {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  const pages = new Set<number>([1, totalPages])

  for (let page = currentPage - 1; page <= currentPage + 1; page += 1) {
    if (page > 1 && page < totalPages) {
      pages.add(page)
    }
  }

  return Array.from(pages).sort((left, right) => left - right)
}

export function PaginationControls({
  currentPage,
  totalPages,
  onPageChange,
}: PaginationControlsProps) {
  const pages = buildPages(currentPage, totalPages)

  return (
    <nav className="pagination-panel" aria-label="Navegación de páginas">
      <div className="pagination-copy">
        <strong>
          Página {currentPage} de {totalPages}
        </strong>
      </div>

      <div className="pagination-controls">
        <button
          type="button"
          className="pagination-button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
        >
          Anterior
        </button>

        {pages.map((page, index) => {
          const previousPage = pages[index - 1]
          const showEllipsis = previousPage && page - previousPage > 1

          return (
            <span className="pagination-segment" key={page}>
              {showEllipsis ? <span className="pagination-ellipsis">…</span> : null}
              <button
                type="button"
                className={page === currentPage ? 'pagination-button active' : 'pagination-button'}
                onClick={() => onPageChange(page)}
                aria-current={page === currentPage ? 'page' : undefined}
              >
                {page}
              </button>
            </span>
          )
        })}

        <button
          type="button"
          className="pagination-button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
        >
          Siguiente
        </button>
      </div>
    </nav>
  )
}