const defaultPageSizeOptions = [10, 25, 50]

const Pagination = ({
  page,
  pageSize,
  total,
  totalPages,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = defaultPageSizeOptions,
  isLoading = false
}) => {
  const canGoPrev = page > 1 && !isLoading
  const canGoNext = page < totalPages && !isLoading

  const handlePrev = () => {
    if (canGoPrev) {
      onPageChange?.(page - 1)
    }
  }

  const handleNext = () => {
    if (canGoNext) {
      onPageChange?.(page + 1)
    }
  }

  const handlePageSize = (event) => {
    const value = Number(event.target.value)
    if (!Number.isNaN(value)) {
      onPageSizeChange?.(value)
    }
  }

  return (
    <div className='flex flex-col gap-3 border-t border-[var(--border)] bg-white/40 px-4 py-3 text-sm text-[var(--text-muted)] sm:flex-row sm:items-center sm:justify-between'>
      <div className='flex items-center gap-2'>
        <button
          type='button'
          onClick={handlePrev}
          className='btn-ghost h-9 px-3 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50'
          disabled={!canGoPrev}
        >
          Précédent
        </button>
        <button
          type='button'
          onClick={handleNext}
          className='btn-ghost h-9 px-3 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50'
          disabled={!canGoNext}
        >
          Suivant
        </button>
      </div>

      <div className='flex flex-col gap-2 text-xs sm:flex-row sm:items-center sm:gap-4'>
        <span>
          Page <strong>{Math.min(page, totalPages || 1)}</strong> sur{' '}
          <strong>{totalPages || 1}</strong>
        </span>
        <span>
          {total} résultat{total > 1 ? 's' : ''}
        </span>
        {onPageSizeChange ? (
          <label className='inline-flex items-center gap-2'>
            <span>Taille :</span>
            <select
              className='input-compact h-8 w-20 rounded-[var(--radius-md)] border border-[var(--border)] bg-white text-xs'
              value={pageSize}
              onChange={handlePageSize}
              disabled={isLoading}
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}/page
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
    </div>
  )
}

export default Pagination
