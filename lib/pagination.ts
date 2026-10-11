export interface PaginationResult<T> {
  items: T[]
  page: number
  totalPages: number
}

export function paginate<T>(items: T[], page: number, size: number): PaginationResult<T> {
  if (items.length === 0 || size <= 0) {
    return { items: [], page: 1, totalPages: 0 }
  }

  const totalPages = Math.ceil(items.length / size)
  const safePage = Math.min(Math.max(1, Math.floor(page)), totalPages)
  const start = (safePage - 1) * size

  return {
    items: items.slice(start, start + size),
    page: safePage,
    totalPages,
  }
}

export function getPageCount(itemsLength: number, size: number) {
  return size > 0 ? Math.ceil(itemsLength / size) : 0
}

export function clampPage(page: number, totalPages: number) {
  return totalPages === 0 ? 1 : Math.min(Math.max(1, Math.floor(page)), totalPages)
}

export function getPaginatedItems<T>(items: T[], page: number, size: number) {
  return paginate(items, page, size).items
}

export function getPaginationState(itemsLength: number, page: number, size: number) {
  const totalPages = getPageCount(itemsLength, size)
  return { page: clampPage(page, totalPages), totalPages }
}
