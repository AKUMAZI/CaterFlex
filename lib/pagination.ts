export function paginate<T>(items: T[], page: number, size: number) {
  const pageSize = Math.max(1, Math.floor(size))
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
  const currentPage = Math.min(Math.max(1, Math.floor(page)), totalPages)
  const start = (currentPage - 1) * pageSize

  return {
    items: items.slice(start, start + pageSize),
    page: currentPage,
    totalPages,
  }
}
