'use client'

import { useEffect, useState } from 'react'

import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Loader2,
} from 'lucide-react'

import { DashboardLayout } from '@/app/dashboard-layout'

import { Badge } from '@/components/ui/badge'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

import type {
  IngredientShortfall,
  OverPurchasedIngredient,
  ScrapSuggestion,
  SufficiencyCheckResult,
} from '@/lib/macroflex'

interface MenuItemWithStatus {
  menuItemId: number
  itemName: string
  category: string
  price: number
  status: 'available' | 'insufficient'
  shortfalls: IngredientShortfall[]
  suggestions: ScrapSuggestion[]
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-PH', {
    maximumFractionDigits: 2,
  }).format(value)
}

function formatPrice(value: number) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
  }).format(value)
}

export default function MacroFlexPage() {
  const [menuItems, setMenuItems] = useState<MenuItemWithStatus[]>([])
  const [overPurchased, setOverPurchased] = useState<
    OverPurchasedIngredient[]
  >([])

  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  // Tracks which menu cards are expanded.
  const [expandedItems, setExpandedItems] = useState<Set<number>>(
    new Set()
  )

  useEffect(() => {
    async function loadMacroFlexData() {
      setLoading(true)
      setErrorMessage('')

      if (
        !process.env.NEXT_PUBLIC_SUPABASE_URL ||
        !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
      ) {
        setErrorMessage(
          'Supabase is not configured. Add the project connection in Vercel.'
        )
        setLoading(false)
        return
      }

      try {
        // Fetch all menu items
        const { supabase } = await import('@/lib/supabase')

        const {
          data: menuData,
          error: menuError,
        } = await supabase
          .from('MENU_ITEM')
          .select(
            'MenuItemID, ItemName, Category, Price'
          )
          .order('ItemName')

        if (menuError) {
          throw menuError
        }

        // Check over-purchased ingredients
        const overPurchaseRes = await fetch(
          '/api/macroflex/overstock'
        )

        if (!overPurchaseRes.ok) {
          throw new Error(
            'Failed to fetch over-purchase data'
          )
        }

        const {
          overPurchased: overPurchasedData,
        } = await overPurchaseRes.json()

        setOverPurchased(overPurchasedData)

        // For each menu item, check sufficiency
        // and get suggestions if insufficient.
        const itemsWithStatus: MenuItemWithStatus[] = []

        if (menuData) {
          for (const item of menuData) {
            const sufficiencyRes = await fetch(
              `/api/macroflex/check?menuItemId=${item.MenuItemID}`
            )

            if (!sufficiencyRes.ok) {
              throw new Error(
                'Failed to check sufficiency'
              )
            }

            const sufficiencyData: SufficiencyCheckResult =
              await sufficiencyRes.json()

            let suggestions: ScrapSuggestion[] = []

            if (
              !sufficiencyData.sufficient &&
              !sufficiencyData.hasNoIngredients
            ) {
              const suggestionsRes = await fetch(
                `/api/macroflex/suggestions/${item.MenuItemID}`
              )

              if (suggestionsRes.ok) {
                const { alternatives } =
                  await suggestionsRes.json()

                suggestions = alternatives
              }
            }

            itemsWithStatus.push({
              menuItemId: item.MenuItemID,
              itemName: item.ItemName,
              category: item.Category,
              price: item.Price,
              status: sufficiencyData.sufficient
                ? 'available'
                : 'insufficient',
              shortfalls:
                sufficiencyData.shortfalls,
              suggestions,
            })
          }
        }

        setMenuItems(itemsWithStatus)
      } catch (error) {
        console.error(
          'MacroFlex loading error:',
          error
        )

        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Failed to load MacroFlex data'
        )
      } finally {
        setLoading(false)
      }
    }

    void loadMacroFlexData()
  }, [])

  const availableCount = menuItems.filter(
    (item) => item.status === 'available'
  ).length

  const insufficientCount = menuItems.filter(
    (item) => item.status === 'insufficient'
  ).length

  const toggleItem = (menuItemId: number) => {
    setExpandedItems((current) => {
      const next = new Set(current)

      if (next.has(menuItemId)) {
        next.delete(menuItemId)
      } else {
        next.add(menuItemId)
      }

      return next
    })
  }

  const expandAll = () => {
    setExpandedItems(
      new Set(
        menuItems.map((item) => item.menuItemId)
      )
    )
  }

  const collapseAll = () => {
    setExpandedItems(new Set())
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-8">

        {/* HEADER */}
        <div className="flex flex-col gap-2">
          <h1 className="font-heading text-3xl font-bold text-surface-foreground">
            MacroFlex
          </h1>

          <p className="text-muted-foreground">
            Real-time menu sufficiency analysis against
            current ingredient inventory.
          </p>
        </div>

        {/* ERROR */}
        {errorMessage && (
          <Card className="border-destructive/20 bg-destructive/5">
            <CardContent className="pt-6 text-sm text-destructive">
              {errorMessage}
            </CardContent>
          </Card>
        )}

        {/* LOADING */}
        {loading ? (
          <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed p-12 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading MacroFlex data...
          </div>
        ) : (
          <>
            {/* MENU AVAILABILITY */}
            <Card>
              <CardHeader>
                <CardTitle>
                  Menu Availability
                </CardTitle>

                <CardDescription>
                  Real-time status of all menu items based
                  on current ingredient stock.
                </CardDescription>
              </CardHeader>

              <CardContent>
                {menuItems.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">
                    No menu items found.
                  </div>
                ) : (
                  <div className="space-y-6">

                    {/* SUMMARY STATS */}
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">

                      {/* TOTAL */}
                      <div className="rounded-2xl border border-border bg-[#FAF6F0] p-4">
                        <p className="text-sm text-muted-foreground">
                          Total Items
                        </p>

                        <p className="text-2xl font-semibold text-card-foreground">
                          {menuItems.length}
                        </p>
                      </div>

                      {/* AVAILABLE */}
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                        <p className="text-sm text-emerald-700">
                          Available Now
                        </p>

                        <p className="text-2xl font-semibold text-emerald-900">
                          {availableCount}
                        </p>
                      </div>

                      {/* INSUFFICIENT */}
                      <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4">
                        <p className="text-sm text-destructive">
                          Insufficient
                        </p>

                        <p className="text-2xl font-semibold text-destructive">
                          {insufficientCount}
                        </p>
                      </div>
                    </div>

                    {/* EXPAND / COLLAPSE */}
                    <div className="flex items-center justify-end gap-3">
                      <button
                        type="button"
                        onClick={expandAll}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        Expand all
                      </button>

                      <span className="text-muted-foreground">
                        |
                      </span>

                      <button
                        type="button"
                        onClick={collapseAll}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        Collapse all
                      </button>
                    </div>

                    {/* MENU CARDS */}
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">

                      {menuItems.map((item) => {
                        const isExpanded =
                          expandedItems.has(
                            item.menuItemId
                          )

                        const hasDetails =
                          item.shortfalls.length > 0 ||
                          item.suggestions.length > 0

                        return (
                          <div
                            key={item.menuItemId}
                            className="overflow-hidden rounded-2xl border border-border bg-[#FAF6F0] transition-all hover:bg-[#F5F0E8] hover:shadow-sm"
                          >

                            {/* CLICKABLE CARD HEADER */}
                            <button
                              type="button"
                              onClick={() =>
                                toggleItem(
                                  item.menuItemId
                                )
                              }
                              className="w-full p-5 text-left"
                            >
                              <div className="flex items-start justify-between gap-4">

                                <div className="min-w-0 flex-1">

                                  <p className="font-semibold text-card-foreground">
                                    {item.itemName}
                                  </p>

                                  <p className="mt-1 text-sm text-muted-foreground">
                                    {item.category} ·{' '}
                                    {formatPrice(
                                      item.price
                                    )}
                                  </p>

                                </div>

                                {/* CHEVRON */}
                                <div className="shrink-0 pt-1 text-muted-foreground">
                                  {isExpanded ? (
                                    <ChevronDown className="size-5" />
                                  ) : (
                                    <ChevronRight className="size-5" />
                                  )}
                                </div>
                              </div>

                              {/* STATUS */}
                              <div className="mt-4">
                                <Badge
                                  className={
                                    item.status ===
                                    'available'
                                      ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100'
                                      : 'bg-red-100 text-red-800 hover:bg-red-100'
                                  }
                                >
                                  {item.status ===
                                  'available' ? (
                                    <>
                                      <CheckCircle2 className="mr-1 size-3" />
                                      Available
                                    </>
                                  ) : (
                                    <>
                                      <AlertTriangle className="mr-1 size-3" />
                                      Insufficient
                                    </>
                                  )}
                                </Badge>
                              </div>
                            </button>

                            {/* COLLAPSED SUMMARY */}
                            {!isExpanded && (
                              <div className="border-t border-border px-5 pb-5 pt-4">

                                {item.status ===
                                'available' ? (
                                  <p className="text-sm text-muted-foreground">
                                    All required ingredients
                                    are currently available.
                                  </p>
                                ) : (
                                  <p className="text-sm text-destructive">
                                    {item.shortfalls.length}{' '}
                                    ingredient
                                    {item.shortfalls.length !==
                                    1
                                      ? 's'
                                      : ''}{' '}
                                    need attention.
                                  </p>
                                )}

                                <p className="mt-3 text-sm font-medium text-primary">
                                  View details →
                                </p>
                              </div>
                            )}

                            {/* EXPANDED DETAILS */}
                            {isExpanded && (
                              <div className="border-t border-border px-5 pb-5 pt-4">

                                {/* AVAILABLE */}
                                {item.status ===
                                  'available' &&
                                  item.shortfalls
                                    .length === 0 && (
                                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                                      <div className="flex items-start gap-3">

                                        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-700" />

                                        <div>
                                          <p className="font-medium text-emerald-900">
                                            Ready to prepare
                                          </p>

                                          <p className="mt-1 text-sm text-emerald-700">
                                            All required
                                            ingredients are
                                            currently
                                            available.
                                          </p>
                                        </div>

                                      </div>
                                    </div>
                                  )}

                                {/* MISSING INGREDIENTS */}
                                {item.shortfalls.length >
                                  0 && (
                                  <div className="space-y-3">

                                    <p className="text-xs font-semibold uppercase tracking-wide text-destructive">
                                      Missing Ingredients
                                    </p>

                                    <div className="space-y-2">

                                      {item.shortfalls.map(
                                        (
                                          shortfall,
                                          idx
                                        ) => (
                                          <div
                                            key={`${shortfall.ingredientName}-${idx}`}
                                            className="rounded-xl border border-destructive/20 bg-destructive/5 p-3"
                                          >
                                            <p className="font-medium text-destructive">
                                              {
                                                shortfall.ingredientName
                                              }
                                            </p>

                                            <p className="mt-1 text-xs text-destructive/80">
                                              Required:{' '}
                                              {formatNumber(
                                                shortfall.required
                                              )}{' '}
                                              {
                                                shortfall.unitOfMeasure
                                              }
                                              {' | '}
                                              Available:{' '}
                                              {formatNumber(
                                                shortfall.available
                                              )}{' '}
                                              {
                                                shortfall.unitOfMeasure
                                              }
                                              {' | '}
                                              Short by:{' '}
                                              <span className="font-semibold">
                                                {formatNumber(
                                                  shortfall.shortBy
                                                )}{' '}
                                                {
                                                  shortfall.unitOfMeasure
                                                }
                                              </span>
                                            </p>
                                          </div>
                                        )
                                      )}

                                    </div>
                                  </div>
                                )}

                                {/* SUGGESTIONS */}
                                {item.suggestions
                                  .length > 0 && (
                                  <div className="mt-5 space-y-3">

                                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                                      Suggested Alternatives
                                    </p>

                                    <div className="space-y-2">

                                      {item.suggestions.map(
                                        (
                                          suggestion
                                        ) => (
                                          <div
                                            key={
                                              suggestion.menuItemId
                                            }
                                            className="rounded-xl border border-emerald-200 bg-emerald-50 p-3"
                                          >
                                            <p className="font-medium text-emerald-900">
                                              {
                                                suggestion.itemName
                                              }
                                            </p>

                                            <p className="mt-1 text-xs text-emerald-700">
                                              {
                                                suggestion.category
                                              }{' '}
                                              ·{' '}
                                              {formatPrice(
                                                suggestion.price
                                              )}
                                            </p>
                                          </div>
                                        )
                                      )}

                                    </div>
                                  </div>
                                )}

                                {/* NO SPECIAL DETAILS */}
                                {hasDetails ===
                                  false && (
                                  <p className="text-sm text-muted-foreground">
                                    No additional details
                                    available for this
                                    menu item.
                                  </p>
                                )}

                                {/* COLLAPSE */}
                                <button
                                  type="button"
                                  onClick={() =>
                                    toggleItem(
                                      item.menuItemId
                                    )
                                  }
                                  className="mt-5 text-sm font-medium text-primary hover:underline"
                                >
                                  Hide details ↑
                                </button>

                              </div>
                            )}
                          </div>
                        )
                      })}

                    </div>
                  </div>
                )}
                </CardContent>
              </Card>

              {/* OVER-PURCHASED INGREDIENTS */}
              {overPurchased.length > 0 && (
                <Card className="border-amber-200 bg-amber-50">

                <CardContent>
                  <div className="space-y-3">

                    {overPurchased.map(
                      (ingredient, idx) => (
                        <div
                          key={idx}
                          className="rounded-lg border border-amber-200 bg-white p-4"
                        >
                          <div className="flex items-start justify-between gap-4">

                            <div>
                              <p className="font-medium text-amber-900">
                                {
                                  ingredient.ingredientName
                                }
                              </p>

                              <p className="text-sm text-amber-800">
                                Current:{' '}
                                {formatNumber(
                                  ingredient.currentStock
                                )}{' '}
                                {
                                  ingredient.unitOfMeasure
                                }{' '}
                                | Capacity:{' '}
                                {formatNumber(
                                  ingredient.maxCapacity
                                )}{' '}
                                {
                                  ingredient.unitOfMeasure
                                }
                              </p>
                            </div>

                            <Badge
                              variant="destructive"
                              className="whitespace-nowrap"
                            >
                              +
                              {formatNumber(
                                ingredient.exceededBy
                              )}{' '}
                              over
                            </Badge>

                          </div>
                        </div>
                      )
                    )}

                  </div>
                </CardContent>
              </Card>
            )}

          </>
        )}
      </div>
    </DashboardLayout>
  )
}
