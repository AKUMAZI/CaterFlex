'use client';

import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/app/dashboard-layout';
import { supabase } from '@/lib/supabase';
import type { DayOfWeek } from '@/lib/types';
import { Card } from '@/components/ui/card';

const OPERATOR_ID = 2;

const DAY_LABELS: Record<DayOfWeek, string> = {
  0: 'Sunday',
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
};

const ALL_DAYS: DayOfWeek[] = [0, 1, 2, 3, 4, 5, 6];

type OperatorSettingRow = {
  SettingID: number;
  OperatorID: number | null;
  DayOfWeek: string;
  OperatingStartTime: string | null;
  OperatingEndTime: string | null;
  MaxCateringEventsPerDay: number | null;
  MaxMealPrepOrdersPerDay: number | null;
  MaxGuestCountPerEvent: number | null;
};

type SettingsState = {
  operatingDays: DayOfWeek[];
  operatingHoursStart: string;
  operatingHoursEnd: string;
  maxEventsPerDay: Record<DayOfWeek, number>;
  maxMealPrepOrdersPerDay: Record<DayOfWeek, number>;
  maxGuestsPerEvent: number;
};

const DEFAULT_SETTINGS: SettingsState = {
  operatingDays: [1, 2, 3, 4, 5, 6],
  operatingHoursStart: '08:00',
  operatingHoursEnd: '18:00',
  maxEventsPerDay: {
    0: 0,
    1: 1,
    2: 1,
    3: 2,
    4: 2,
    5: 2,
    6: 3,
  },
  maxMealPrepOrdersPerDay: {
    0: 0,
    1: 5,
    2: 5,
    3: 5,
    4: 5,
    5: 5,
    6: 3,
  },
  maxGuestsPerEvent: 100,
};

function normalizeTime(value: string | null): string {
  if (!value) return '';

  // Supabase may return PostgreSQL time as HH:MM:SS.
  // HTML time inputs expect HH:MM.
  return value.slice(0, 5);
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsState>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setLoading(true);
    setError('');

    const { data, error: fetchError } = await supabase
      .from('OPERATOR_SETTINGS')
      .select(
        `
          SettingID,
          OperatorID,
          DayOfWeek,
          OperatingStartTime,
          OperatingEndTime,
          MaxCateringEventsPerDay,
          MaxMealPrepOrdersPerDay,
          MaxGuestCountPerEvent
        `
      )
      .eq('OperatorID', OPERATOR_ID)
      .order('SettingID');

    if (fetchError) {
      console.error('Failed to load operating rules:', fetchError);
      setError(
        fetchError.message || 'Could not load operating rules from Supabase.'
      );
      setLoading(false);
      return;
    }

    
    const rows = (data ?? []) as OperatorSettingRow[];
    
    if (rows.length === 0) {
      setError('No operating rules were found for this operator.');
      setLoading(false);
      return;
    }

    const nextSettings: SettingsState = {
      operatingDays: [],
      operatingHoursStart: DEFAULT_SETTINGS.operatingHoursStart,
      operatingHoursEnd: DEFAULT_SETTINGS.operatingHoursEnd,
      maxEventsPerDay: { ...DEFAULT_SETTINGS.maxEventsPerDay },
      maxMealPrepOrdersPerDay: {
        ...DEFAULT_SETTINGS.maxMealPrepOrdersPerDay,
      },
      maxGuestsPerEvent: DEFAULT_SETTINGS.maxGuestsPerEvent,
    };

    for (const row of rows) {
      const day = Number(row.DayOfWeek) as DayOfWeek;

      if (!ALL_DAYS.includes(day)) continue;

      const cateringLimit = row.MaxCateringEventsPerDay ?? 0;

      // A day with 0 catering events is treated as a closed day.
      if (cateringLimit > 0) {
        nextSettings.operatingDays.push(day);
      }

      nextSettings.maxEventsPerDay[day] = cateringLimit;

      nextSettings.maxMealPrepOrdersPerDay[day] =
        row.MaxMealPrepOrdersPerDay ?? 0;

      if (row.OperatingStartTime) {
        nextSettings.operatingHoursStart = normalizeTime(
          row.OperatingStartTime
        );
      }

      if (row.OperatingEndTime) {
        nextSettings.operatingHoursEnd = normalizeTime(
          row.OperatingEndTime
        );
      }

      if (row.MaxGuestCountPerEvent !== null) {
        nextSettings.maxGuestsPerEvent = row.MaxGuestCountPerEvent;
      }
    }

    nextSettings.operatingDays.sort();

    setSettings(nextSettings);
    setLoading(false);
  }

  function updateSettings(updates: Partial<SettingsState>) {
    setSettings((current) => ({
      ...current,
      ...updates,
    }));

    setMessage('');
    setError('');
  }

  function toggleDay(day: DayOfWeek) {
    const isCurrentlyOpen = settings.operatingDays.includes(day);

    const operatingDays = isCurrentlyOpen
      ? settings.operatingDays.filter((d) => d !== day)
      : [...settings.operatingDays, day].sort();

    // When a day is closed, set catering capacity to 0.
    // When reopened, restore it to at least 1.
    const maxEventsPerDay = {
      ...settings.maxEventsPerDay,
      [day]: isCurrentlyOpen
        ? 0
        : Math.max(settings.maxEventsPerDay[day], 1),
    };

    // Meal prep follows the same open/closed state.
    const maxMealPrepOrdersPerDay = {
      ...settings.maxMealPrepOrdersPerDay,
      [day]: isCurrentlyOpen
        ? 0
        : Math.max(settings.maxMealPrepOrdersPerDay[day], 1),
    };

    updateSettings({
      operatingDays,
      maxEventsPerDay,
      maxMealPrepOrdersPerDay,
    });
  }

  async function saveSettings() {
    setSaving(true);
    setMessage('');
    setError('');

    try {
      const { data: rows, error: fetchError } = await supabase
        .from('OPERATOR_SETTINGS')
        .select(
          `
            SettingID,
            DayOfWeek
          `
        )
        .eq('OperatorID', OPERATOR_ID);

      if (fetchError) {
        throw fetchError;
      }

      const existingRows = (rows ?? []) as Array<{
        SettingID: number;
        DayOfWeek: string;
      }>;

      /*
       * Update each existing day individually.
       *
       * We intentionally do not use upsert here because your current
       * database already contains the 7 settings rows and we do not
       * need to create duplicate rows.
       */
      for (const row of existingRows) {
        const day = Number(row.DayOfWeek) as DayOfWeek;

        if (!ALL_DAYS.includes(day)) continue;

        const { error: updateError } = await supabase
          .from('OPERATOR_SETTINGS')
          .update({
            OperatingStartTime: settings.operatingHoursStart,
            OperatingEndTime: settings.operatingHoursEnd,
            MaxCateringEventsPerDay: settings.maxEventsPerDay[day] ?? 0,
            MaxMealPrepOrdersPerDay:
              settings.maxMealPrepOrdersPerDay[day] ?? 0,
            MaxGuestCountPerEvent: settings.maxGuestsPerEvent,
          })
          .eq('SettingID', row.SettingID)
          .eq('OperatorID', OPERATOR_ID);

        if (updateError) {
          throw updateError;
        }
      }

      setMessage('Operating rules saved successfully.');

      // Reload from Supabase so the UI reflects the actual database values.
      await loadSettings();
    } catch (saveError) {
      console.error('Failed to save operating rules:', saveError);

      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Could not save operating rules.'
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-8 max-w-3xl">
          <div>
            <h1 className="font-heading text-3xl font-bold text-surface-foreground">
              Operating Rules
            </h1>
            <p className="text-surface-muted-foreground mt-2">
              Configure availability and capacity thresholds used when
              validating bookings.
            </p>
          </div>

          <Card className="p-6">
            <p className="text-sm text-muted-foreground">
              Loading operating rules...
            </p>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8 max-w-3xl">
        <div>
          <h1 className="font-heading text-3xl font-bold text-surface-foreground">
            Operating Rules
          </h1>

          <p className="text-surface-muted-foreground mt-2">
            Configure availability and capacity thresholds used when
            validating bookings.
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {message && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {message}
          </div>
        )}

        <Card className="p-6">
          <h2 className="font-heading text-lg font-bold text-card-foreground mb-4">
            Operating Days
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {ALL_DAYS.map((day) => (
              <label
                key={day}
                className="flex items-center gap-2 cursor-pointer text-sm text-card-foreground"
              >
                <input
                  type="checkbox"
                  checked={settings.operatingDays.includes(day)}
                  onChange={() => toggleDay(day)}
                  className="rounded border-border"
                />

                {DAY_LABELS[day]}
              </label>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="font-heading text-lg font-bold text-card-foreground mb-4">
            Operating Hours
          </h2>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-muted-foreground">
                Start
              </label>

              <input
                type="time"
                value={settings.operatingHoursStart}
                onChange={(e) =>
                  updateSettings({
                    operatingHoursStart: e.target.value,
                  })
                }
                className="mt-1 w-full px-3 py-2 border border-border rounded-lg"
              />
            </div>

            <div>
              <label className="text-sm text-muted-foreground">
                End
              </label>

              <input
                type="time"
                value={settings.operatingHoursEnd}
                onChange={(e) =>
                  updateSettings({
                    operatingHoursEnd: e.target.value,
                  })
                }
                className="mt-1 w-full px-3 py-2 border border-border rounded-lg"
              />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="font-heading text-lg font-bold text-card-foreground mb-4">
            Max Events Per Day
          </h2>

          <div className="space-y-3">
            {ALL_DAYS.map((day) => (
              <div
                key={day}
                className="flex items-center justify-between gap-4"
              >
                <span className="text-sm text-card-foreground w-28">
                  {DAY_LABELS[day]}
                </span>

                <input
                  type="number"
                  min={0}
                  value={settings.maxEventsPerDay[day]}
                  onChange={(e) => {
                    const value = parseInt(e.target.value, 10);

                    updateSettings({
                      maxEventsPerDay: {
                        ...settings.maxEventsPerDay,
                        [day]: Number.isNaN(value) ? 0 : Math.max(value, 0),
                      },
                    });
                  }}
                  className="w-24 px-3 py-2 border border-border rounded-lg text-right"
                />
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="font-heading text-lg font-bold text-card-foreground mb-4">
            Max Meal Prep Orders Per Day
          </h2>

          <div className="space-y-3">
            {ALL_DAYS.map((day) => (
              <div
                key={day}
                className="flex items-center justify-between gap-4"
              >
                <span className="text-sm text-card-foreground w-28">
                  {DAY_LABELS[day]}
                </span>

                <input
                  type="number"
                  min={0}
                  value={settings.maxMealPrepOrdersPerDay[day]}
                  onChange={(e) => {
                    const value = parseInt(e.target.value, 10);

                    updateSettings({
                      maxMealPrepOrdersPerDay: {
                        ...settings.maxMealPrepOrdersPerDay,
                        [day]: Number.isNaN(value) ? 0 : Math.max(value, 0),
                      },
                    });
                  }}
                  className="w-24 px-3 py-2 border border-border rounded-lg text-right"
                />
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="font-heading text-lg font-bold text-card-foreground mb-4">
            Guest Limit
          </h2>

          <label className="text-sm text-muted-foreground">
            Max guests per event
          </label>

          <input
            type="number"
            min={1}
            value={settings.maxGuestsPerEvent}
            onChange={(e) => {
              const value = parseInt(e.target.value, 10);

              updateSettings({
                maxGuestsPerEvent: Number.isNaN(value)
                  ? 1
                  : Math.max(value, 1),
              });
            }}
            className="mt-1 w-full max-w-xs px-3 py-2 border border-border rounded-lg"
          />
        </Card>

        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-surface-muted-foreground">
            Changes are saved to Supabase when you click Save Operating Rules.
          </p>

          <button
            type="button"
            onClick={saveSettings}
            disabled={saving}
            className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save Operating Rules'}
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}