import { useEffect, useMemo, useState } from "react";
import { router } from "expo-router";
import { Pressable, Switch, Text, View } from "react-native";
import { userService, type ProviderProfile } from "@kabisig/shared";
import { BackHeader, FeedbackBanner, FixedScreen, FormInput, FullScreenPopup, LoadingState, PrimaryButton, SurfaceCard } from "../src/components";
import { useAuth } from "../src/hooks/AuthProvider";
import { theme } from "../src/theme";
import { readableAppError } from "../src/utils/errors";

const startSlots = ["06:00", "07:00", "08:00", "09:00", "10:00", "11:00", "12:00"];
const endSlots = ["12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00"];

function formatTimeLabel(value: string) {
  const [rawHour, rawMinute] = value.split(":").map(Number);
  const suffix = rawHour >= 12 ? "PM" : "AM";
  const hour = ((rawHour + 11) % 12) + 1;
  return `${hour}:${(rawMinute || 0).toString().padStart(2, "0")} ${suffix}`;
}

function nextExceptionDates() {
  return Array.from({ length: 30 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() + index + 1);
    return {
      key: date.toISOString().slice(0, 10),
      label: date.toLocaleDateString("en-US", { month: "short", day: "numeric", weekday: "short" })
    };
  });
}

export default function ProviderScheduleScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; title: string; message: string } | null>(null);
  const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);
  const [form, setForm] = useState<ProviderProfile | null>(null);
  const [selectedDay, setSelectedDay] = useState("Mon");
  const [exceptionDate, setExceptionDate] = useState(nextExceptionDates()[0]?.key || "");
  const [exceptionReason, setExceptionReason] = useState("");

  const exceptionDateOptions = useMemo(() => nextExceptionDates(), []);
  const sortedExceptions = useMemo(
    () => [...(form?.scheduleExceptions ?? [])].sort((a, b) => a.date.localeCompare(b.date)),
    [form?.scheduleExceptions]
  );

  useEffect(() => {
    async function load() {
      if (!user) return;
      const profile = await userService.getProviderProfile(user.id);
      setForm(profile);
      if (profile?.availability?.[0]?.day) {
        setSelectedDay(profile.availability[0].day);
      }
      setLoading(false);
    }

    void load();
  }, [user]);

  async function handleSave() {
    if (!user || !form) return;
    setSaving(true);
    try {
      await userService.updateProviderProfile(user.id, {
        availability: form.availability,
        scheduleExceptions: form.scheduleExceptions ?? []
      });
      setFeedback({
        type: "success",
        title: "Schedule updated",
        message: "Your working days, available hours, and unavailable dates were saved."
      });
      setShowSuccessOverlay(true);
      setTimeout(() => setShowSuccessOverlay(false), 1000);
    } catch (error) {
      console.error(error);
      setFeedback({
        type: "error",
        title: "Save failed",
        message: readableAppError(error, "We could not save the schedule right now.")
      });
    } finally {
      setSaving(false);
    }
  }

  function addUnavailableDate() {
    if (!form) return;
    if (!exceptionDate.trim() || !exceptionReason.trim()) {
      setFeedback({
        type: "error",
        title: "Exception details needed",
        message: "Please choose an unavailable date and add a short reason before saving it."
      });
      return;
    }

    const nextException = {
      id: `exception-${Date.now()}`,
      date: exceptionDate,
      reason: exceptionReason.trim(),
      unavailable: true,
      createdAt: new Date().toISOString()
    };

    setForm({
      ...form,
      scheduleExceptions: [
        ...(form.scheduleExceptions ?? []).filter((item) => item.date !== exceptionDate),
        nextException
      ]
    });
    setExceptionReason("");
    setFeedback({
      type: "success",
      title: "Unavailable date added",
      message: "This date will be treated as unavailable in booking and reschedule flows after you save."
    });
  }

  function removeException(id: string) {
    setForm((current) =>
      current
        ? {
            ...current,
            scheduleExceptions: (current.scheduleExceptions ?? []).filter((item) => item.id !== id)
          }
        : current
    );
  }

  if (loading || !form) {
    return (
      <FixedScreen header={<BackHeader title="Working Days & Schedule" onBack={() => router.back()} />}>
        <LoadingState label="Loading schedule..." />
      </FixedScreen>
    );
  }

  return (
    <FixedScreen
      header={
        <>
          <BackHeader title="Working Days & Schedule" onBack={() => router.back()} />
          {feedback ? <FeedbackBanner type={feedback.type} title={feedback.title} message={feedback.message} /> : null}
          <FullScreenPopup visible={showSuccessOverlay} title="Schedule saved" message="Your working days and available hours were updated." />
        </>
      }
      footer={<PrimaryButton label={saving ? "Saving..." : "Save schedule"} onPress={() => void handleSave()} disabled={saving} />}
    >
      <SurfaceCard style={{ gap: 12 }}>
        <Text style={{ color: theme.colors.text, fontSize: 18, fontWeight: "900" }}>Weekly availability planner</Text>
        <Text style={{ color: theme.colors.textMuted, lineHeight: 20 }}>
          Pick a day below, switch availability on or off, then choose your available time window in AM or PM.
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {form.availability.map((slot) => {
            const active = selectedDay === slot.day;
            return (
              <Pressable
                key={`day-${slot.day}`}
                onPress={() => setSelectedDay(slot.day)}
                style={{
                  borderRadius: 16,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  backgroundColor: active ? theme.colors.primary : theme.colors.surfaceAlt,
                  borderWidth: 1,
                  borderColor: active ? theme.colors.primary : theme.colors.border
                }}
              >
                <Text style={{ color: active ? "#fff" : theme.colors.text, fontWeight: "800" }}>{slot.day}</Text>
              </Pressable>
            );
          })}
        </View>
      </SurfaceCard>
      {form.availability.filter((slot) => slot.day === selectedDay).map((slot) => (
        <SurfaceCard key={slot.day} style={{ gap: 14 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View>
              <Text style={{ color: theme.colors.text, fontSize: 17, fontWeight: "900" }}>{slot.day}</Text>
              <Text style={{ color: theme.colors.textMuted, marginTop: 4 }}>Set whether you are bookable on this day and choose your time range.</Text>
            </View>
            <Switch
              value={slot.available}
              onValueChange={(value) =>
                setForm((current) =>
                  current
                    ? {
                        ...current,
                        availability: current.availability.map((item) => (item.day === slot.day ? { ...item, available: value } : item))
                      }
                    : current
                )
              }
              trackColor={{ true: theme.colors.primary }}
            />
          </View>

          <View style={{ gap: 10 }}>
            <Text style={{ color: theme.colors.textLight, fontWeight: "700" }}>Start time</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {startSlots.map((value) => {
                const active = slot.start === value;
                return (
                  <Pressable
                    key={`${slot.day}-start-${value}`}
                    onPress={() =>
                      setForm((current) =>
                        current
                          ? {
                              ...current,
                              availability: current.availability.map((item) => (item.day === slot.day ? { ...item, start: value } : item))
                            }
                          : current
                      )
                    }
                    style={{
                      borderRadius: 999,
                      paddingHorizontal: 12,
                      paddingVertical: 9,
                      backgroundColor: active ? theme.colors.primary : theme.colors.surfaceAlt,
                      borderWidth: 1,
                      borderColor: active ? theme.colors.primary : theme.colors.border
                    }}
                  >
                    <Text style={{ color: active ? "#fff" : theme.colors.text, fontWeight: "700" }}>{formatTimeLabel(value)}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={{ gap: 10 }}>
            <Text style={{ color: theme.colors.textLight, fontWeight: "700" }}>End time</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {endSlots.map((value) => {
                const active = slot.end === value;
                return (
                  <Pressable
                    key={`${slot.day}-end-${value}`}
                    onPress={() =>
                      setForm((current) =>
                        current
                          ? {
                              ...current,
                              availability: current.availability.map((item) => (item.day === slot.day ? { ...item, end: value } : item))
                            }
                          : current
                      )
                    }
                    style={{
                      borderRadius: 999,
                      paddingHorizontal: 12,
                      paddingVertical: 9,
                      backgroundColor: active ? theme.colors.accent : theme.colors.surfaceAlt,
                      borderWidth: 1,
                      borderColor: active ? theme.colors.accent : theme.colors.border
                    }}
                  >
                    <Text style={{ color: active ? "#fff" : theme.colors.text, fontWeight: "700" }}>{formatTimeLabel(value)}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={{ borderRadius: 16, padding: 12, backgroundColor: theme.colors.surfaceAlt }}>
            <Text style={{ color: theme.colors.textLight, fontWeight: "700" }}>Current window</Text>
            <Text style={{ color: theme.colors.text, fontWeight: "900", marginTop: 6 }}>
              {formatTimeLabel(slot.start)} - {formatTimeLabel(slot.end)}
            </Text>
          </View>
        </SurfaceCard>
      ))}

      <SurfaceCard style={{ gap: 14 }}>
        <Text style={{ color: theme.colors.text, fontSize: 18, fontWeight: "900" }}>Unavailable dates</Text>
        <Text style={{ color: theme.colors.textMuted, lineHeight: 20 }}>
          Add full-day exceptions for dates when you should not receive bookings, even if your weekly schedule is normally open.
        </Text>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {exceptionDateOptions.slice(0, 12).map((option) => {
            const active = exceptionDate === option.key;
            return (
              <Pressable
                key={option.key}
                onPress={() => setExceptionDate(option.key)}
                style={{
                  borderRadius: 999,
                  paddingHorizontal: 12,
                  paddingVertical: 9,
                  backgroundColor: active ? theme.colors.primary : theme.colors.surfaceAlt,
                  borderWidth: 1,
                  borderColor: active ? theme.colors.primary : theme.colors.border
                }}
              >
                <Text style={{ color: active ? "#fff" : theme.colors.text, fontWeight: "800", fontSize: 12 }}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <FormInput
          label="Reason for unavailable date"
          value={exceptionReason}
          onChangeText={setExceptionReason}
          placeholder="Example: Fully booked, personal leave, travel, training"
          helper="Customers will not see time slots for this date."
        />

        <PrimaryButton label="Add unavailable date" icon="calendar-clear-outline" onPress={addUnavailableDate} />

        <View style={{ gap: 10 }}>
          <Text style={{ color: theme.colors.text, fontWeight: "900" }}>Saved exceptions</Text>
          {sortedExceptions.length ? (
            sortedExceptions.map((item) => (
              <View
                key={item.id}
                style={{
                  borderRadius: 18,
                  padding: 14,
                  backgroundColor: theme.colors.surfaceAlt,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  flexDirection: "row",
                  gap: 12,
                  alignItems: "flex-start"
                }}
              >
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={{ color: theme.colors.text, fontWeight: "900" }}>{item.date}</Text>
                  <Text style={{ color: theme.colors.textMuted }}>{item.reason}</Text>
                </View>
                <Pressable
                  onPress={() => removeException(item.id)}
                  style={{ borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: theme.colors.card }}
                >
                  <Text style={{ color: theme.colors.danger, fontWeight: "800" }}>Remove</Text>
                </Pressable>
              </View>
            ))
          ) : (
            <Text style={{ color: theme.colors.textMuted }}>No unavailable dates added yet.</Text>
          )}
        </View>
      </SurfaceCard>
    </FixedScreen>
  );
}
