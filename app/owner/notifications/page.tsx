'use client'

import { useEffect, useMemo, useState } from 'react'

import {
  Archive,
  Bell,
  Check,
  Inbox,
  Search,
  Star,
  Trash2,
} from 'lucide-react'

import {
  getOwnerNotifications,
  markNotificationRead,
} from '@/app/actions/notification-actions'

import { DashboardLayout } from '@/app/dashboard-layout'

export default function OwnerNotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([])
  const [search, setSearch] = useState('')

  const [activeTab, setActiveTab] = useState<
    'all' | 'archive' | 'favorite'
  >('all')

  const [favorites, setFavorites] = useState<number[]>([])
  const [archived, setArchived] = useState<number[]>([])

  // --------------------------------------------------
  // LOAD NOTIFICATIONS
  // --------------------------------------------------

  useEffect(() => {
    getOwnerNotifications().then((result) => {
      if (result.ok) {
        setNotifications(result.notifications as any[])
      }
    })
  }, [])

  // --------------------------------------------------
  // LOAD SAVED FAVORITES / ARCHIVED NOTIFICATIONS
  // --------------------------------------------------

  useEffect(() => {
    try {
      const savedFavorites = localStorage.getItem(
        'owner-notification-favorites'
      )

      if (savedFavorites) {
        setFavorites(JSON.parse(savedFavorites))
      }

      const savedArchived = localStorage.getItem(
        'owner-notification-archived'
      )

      if (savedArchived) {
        setArchived(JSON.parse(savedArchived))
      }
    } catch (error) {
      console.error(
        'Failed to load notification preferences:',
        error
      )
    }
  }, [])

  // --------------------------------------------------
  // SAVE FAVORITES
  // --------------------------------------------------

  useEffect(() => {
    localStorage.setItem(
      'owner-notification-favorites',
      JSON.stringify(favorites)
    )
  }, [favorites])

  // --------------------------------------------------
  // SAVE ARCHIVED NOTIFICATIONS
  // --------------------------------------------------

  useEffect(() => {
    localStorage.setItem(
      'owner-notification-archived',
      JSON.stringify(archived)
    )
  }, [archived])

  // --------------------------------------------------
  // MARK AS READ
  // --------------------------------------------------

  async function read(id: number) {
    const result = await markNotificationRead(id)

    if (result.ok) {
      setNotifications((current) =>
        current.map((item) =>
          Number(item.NotificationID) === id
            ? {
                ...item,
                IsRead: true,
              }
            : item
        )
      )
    }
  }

  // --------------------------------------------------
  // FAVORITE
  // --------------------------------------------------

  function toggleFavorite(id: number) {
    setFavorites((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    )
  }

  // --------------------------------------------------
  // ARCHIVE
  // --------------------------------------------------

  function archiveNotification(id: number) {
    setArchived((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    )
  }

  // --------------------------------------------------
  // DELETE
  // --------------------------------------------------

  function deleteNotification(id: number) {
    setNotifications((current) =>
      current.filter(
        (item) =>
          Number(item.NotificationID) !== id
      )
    )

    setFavorites((current) =>
      current.filter((item) => item !== id)
    )

    setArchived((current) =>
      current.filter((item) => item !== id)
    )
  }

  // --------------------------------------------------
  // FILTER NOTIFICATIONS
  // --------------------------------------------------

  const filteredNotifications = useMemo(() => {
    const query = search.trim().toLowerCase()

    return notifications.filter((item) => {
      const id = Number(item.NotificationID)

      const isRead = Boolean(item.IsRead)

      const isArchived =
        archived.includes(id)

      // ----------------------------------------------
      // ALL
      //
      // Show EVERYTHING:
      // - unread
      // - read
      // - manually archived
      // ----------------------------------------------

      if (activeTab === 'all') {
        // No filtering here.
        // Archived/read notifications remain visible.
      }

      // ----------------------------------------------
      // ARCHIVE
      //
      // Show:
      // - read notifications
      // - manually archived notifications
      // ----------------------------------------------

      if (activeTab === 'archive') {
        if (!isRead && !isArchived) {
          return false
        }
      }

      // ----------------------------------------------
      // FAVORITE
      // ----------------------------------------------

      if (
        activeTab === 'favorite' &&
        !favorites.includes(id)
      ) {
        return false
      }

      // ----------------------------------------------
      // SEARCH
      // ----------------------------------------------

      if (!query) {
        return true
      }

      const message =
        String(item.Message ?? '').toLowerCase()

      const type =
        String(
          item.NotificationType ?? ''
        ).toLowerCase()

      return (
        message.includes(query) ||
        type.includes(query)
      )
    })
  }, [
    notifications,
    search,
    activeTab,
    archived,
    favorites,
  ])

  // --------------------------------------------------
  // COUNTS
  // --------------------------------------------------

  const unreadCount = notifications.filter(
    (item) =>
      !item.IsRead &&
      !archived.includes(
        Number(item.NotificationID)
      )
  ).length

  const archiveCount = notifications.filter(
    (item) =>
      Boolean(item.IsRead) ||
      archived.includes(
        Number(item.NotificationID)
      )
  ).length

  const favoriteCount = notifications.filter(
    (item) =>
      favorites.includes(
        Number(item.NotificationID)
      )
  ).length

  // --------------------------------------------------
  // PAGE
  // --------------------------------------------------

  return (
    <DashboardLayout>
      <section className="flex flex-col gap-6">

        {/* ============================================
            HEADER
        ============================================ */}

        <div className="flex items-center justify-between gap-6">
          <div>
            <h1 className="font-heading text-3xl font-bold text-surface-foreground">
              Notifications
            </h1>

            <p className="mt-1 text-sm text-surface-muted-foreground">
              Booking and preparation updates for your operation.
            </p>
          </div>

          {/* SEARCH */}

          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

            <input
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search notifications"
              className="h-10 w-full rounded-full border bg-muted/40 pl-10 pr-4 text-sm outline-none transition focus:border-primary focus:bg-[#FAF6F0]"
            />
          </div>
        </div>

        {/* ============================================
            TABS
        ============================================ */}

        <div className="border-b">
          <div className="grid grid-cols-3">

            {/* ALL */}

            <button
              type="button"
              onClick={() =>
                setActiveTab('all')
              }
              className={`relative flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition ${
                activeTab === 'all'
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  activeTab === 'all'
                    ? 'bg-red-100 text-red-700'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {unreadCount}
              </span>

              <span>All</span>

              {activeTab === 'all' && (
                <span className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-foreground" />
              )}
            </button>

            {/* ARCHIVE */}

            <button
              type="button"
              onClick={() =>
                setActiveTab('archive')
              }
              className={`relative flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition ${
                activeTab === 'archive'
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span
                className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
              >
                {archiveCount}
              </span>

              <span>Archive</span>

              {activeTab === 'archive' && (
                <span className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-foreground" />
              )}
            </button>

            {/* FAVORITE */}

            <button
              type="button"
              onClick={() =>
                setActiveTab('favorite')
              }
              className={`relative flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition ${
                activeTab === 'favorite'
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span
                className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
              >
                {favoriteCount}
              </span>

              <span>Favorite</span>

              {activeTab === 'favorite' && (
                <span className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-foreground" />
              )}
            </button>

          </div>
        </div>

        {/* ============================================
            NOTIFICATION LIST
        ============================================ */}

        <div className="flex flex-col gap-2">

          {filteredNotifications.length === 0 ? (
            <div className="rounded-lg border p-10 text-center">
              <Star className="mx-auto mb-3 size-8 text-muted-foreground" />

              <p className="font-medium text-foreground">
                No Favorites
              </p>

              <p className="mt-1 text-sm text-muted-foreground">
                Your favorites will be stored here.
              </p>
            </div>
          ) : (
            filteredNotifications.map((item) => {
              const id =
                Number(item.NotificationID)

              const isFavorite =
                favorites.includes(id)

              const isArchived =
                archived.includes(id)

              const isRead =
                Boolean(item.IsRead)

              const isOld =
                isRead || isArchived

              return (
                <article
                  key={item.NotificationID}
                  className={`group flex items-center gap-3 rounded-md border border-border bg-[#FAF6F0] px-4 py-3 transition ${
                    isOld
                      ? 'opacity-60'
                      : ''
                  }`}
                >

                  {/* ==================================
                      UNREAD DOT
                  ================================== */}

                  <div className="w-2 flex-shrink-0">
                    {!isOld && (
                      <span className="block size-2 rounded-full bg-emerald-400" />
                    )}
                  </div>

                  {/* ==================================
                      FAVORITE
                  ================================== */}

                  <button
                    type="button"
                    onClick={() =>
                      toggleFavorite(id)
                    }
                    aria-label={
                      isFavorite
                        ? 'Remove from favorites'
                        : 'Add to favorites'
                    }
                    className="flex size-8 flex-shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  >
                    <Star
                      className="size-5"
                      fill={
                        isFavorite
                          ? 'currentColor'
                          : 'none'
                      }
                    />
                  </button>

                  {/* ==================================
                      NOTIFICATION / ARCHIVE ICON
                  ================================== */}

                  <div className="flex size-8 flex-shrink-0 items-center justify-center text-muted-foreground">
                    {isOld ? (
                      <Archive className="size-5" />
                    ) : (
                      <Bell className="size-5" />
                    )}
                  </div>

                  {/* ==================================
                      MESSAGE
                  ================================== */}

                  <div className="min-w-0 flex-1">
                    <p
                      className={`truncate text-sm ${
                        isOld
                          ? 'font-normal text-muted-foreground'
                          : 'font-medium text-foreground'
                      }`}
                    >
                      {item.Message}
                    </p>

                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.NotificationType}
                    </p>
                  </div>

                  {/* ==================================
                      DATE
                  ================================== */}

                  <span className="hidden flex-shrink-0 text-xs text-muted-foreground sm:block">
                    {new Date(
                      item.CreatedAt
                    ).toLocaleString()}
                  </span>

                  {/* ==================================
                      MARK AS READ
                  ================================== */}

                  {!isRead && !isArchived && (
                    <button
                      type="button"
                      onClick={() =>
                        read(id)
                      }
                      aria-label="Mark notification as read"
                      className="flex size-8 flex-shrink-0 items-center justify-center rounded-md border text-muted-foreground transition hover:bg-muted hover:text-foreground"
                    >
                      <Check className="size-4" />
                    </button>
                  )}

                  {/* ==================================
                      ARCHIVE
                  ================================== */}

                  <button
                    type="button"
                    onClick={() =>
                      archiveNotification(id)
                    }
                    aria-label={
                      isArchived
                        ? 'Remove from archive'
                        : 'Archive notification'
                    }
                    className="flex size-8 flex-shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  >
                    <Archive className="size-5" />
                  </button>

                  {/* ==================================
                      DELETE
                  ================================== */}

                  <button
                    type="button"
                    onClick={() =>
                      deleteNotification(id)
                    }
                    aria-label="Delete notification"
                    className="flex size-8 flex-shrink-0 items-center justify-center rounded-md bg-red-100 text-red-600 transition hover:bg-red-200"
                  >
                    <Trash2 className="size-4" />
                  </button>

                </article>
              )
            })
          )}

        </div>

      </section>
    </DashboardLayout>
  )
}