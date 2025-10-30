const DEFAULT_PAGE_SIZE = Number(process.env.DEFAULT_PAGE_SIZE) || 10
const MAX_PAGE_SIZE = Number(process.env.MAX_PAGE_SIZE) || 100

export const getPaginationParams = (query = {}) => {
  const pageRaw = parseInt(query.page, 10)
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1

  const pageSizeRaw = parseInt(query.pageSize, 10)
  let pageSize = Number.isFinite(pageSizeRaw) && pageSizeRaw > 0 ? pageSizeRaw : DEFAULT_PAGE_SIZE
  pageSize = Math.min(pageSize, MAX_PAGE_SIZE)

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  return { page, pageSize, from, to }
}

export const buildPaginationMeta = (count = 0, page = 1, pageSize = DEFAULT_PAGE_SIZE) => {
  const total = Number.isFinite(count) && count >= 0 ? count : 0
  const totalPages = total > 0 ? Math.max(Math.ceil(total / pageSize), 1) : 1
  const safePage = Math.min(page, totalPages)

  return {
    page: safePage,
    pageSize,
    total,
    totalPages
  }
}
