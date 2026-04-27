import { useEffect, useMemo, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Linking, Pressable, Text, View, useWindowDimensions } from "react-native";
import {
  bookingService,
  categoryService,
  notificationService,
  paymentService,
  providerService,
  type ServiceCategory
} from "@kabisig/shared";
import { BackHeader, FeedbackBanner, FixedScreen, FormInput, FullScreenPopup, MapPreviewModal, MultiMediaPickerField, PrimaryButton, SearchBar, SurfaceCard } from "../src/components";
import { useAuth } from "../src/hooks/AuthProvider";
import { requestCurrentLocation } from "../src/services/location";
import { theme } from "../src/theme";

type ProviderCard = Awaited<ReturnType<typeof providerService.getApprovedProviders>>[number];

function nextUpcomingDays() {
  return Array.from({ length: 21 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() + index);
    return {
      key: date.toISOString().slice(0, 10),
      label: date.getDate().toString(),
      month: date.toLocaleDateString("en-US", { month: "short" }),
      weekday: date.toLocaleDateString("en-US", { weekday: "short" })
    };
  });
}

function buildTimeSlots(
  provider: ProviderCard | undefined,
  weekday: string,
  selectedDate: string,
  reservedSlots: string[]
) {
  const schedule = provider?.availability?.find((slot) => slot.day === weekday && slot.available);
  if (!schedule) return [];

  const [startHour] = schedule.start.split(":").map(Number);
  const [endHour] = schedule.end.split(":").map(Number);
  const slots: string[] = [];

  for (let hour = startHour; hour < endHour; hour += 1) {
    const suffix = hour >= 12 ? "PM" : "AM";
    const formatted = `${((hour + 11) % 12) + 1}:00 ${suffix}`;
    const now = new Date();
    const isToday = selectedDate === now.toISOString().slice(0, 10);
    const isPastHour = isToday && hour <= now.getHours();
    const isReserved = reservedSlots.includes(formatted);
    if (!isPastHour && !isReserved) {
      slots.push(formatted);
    }
  }

  return slots;
}

function mapsUrl(address: string) {
  const normalized = address.trim();
  const coordsMatch = normalized.match(/^(-?\d+(\.\d+)?)\s*,\s*(-?\d+(\.\d+)?)$/);
  if (coordsMatch) {
    return `https://www.openstreetmap.org/export/embed.html?bbox=${Number(coordsMatch[3]) - 0.01}%2C${Number(coordsMatch[1]) - 0.01}%2C${Number(coordsMatch[3]) + 0.01}%2C${Number(coordsMatch[1]) + 0.01}&layer=mapnik&marker=${coordsMatch[1]}%2C${coordsMatch[3]}`;
  }
  return `https://www.openstreetmap.org/export/embed.html?search=${encodeURIComponent(normalized)}`;
}

function mapsExternalUrl(address: string) {
  const normalized = address.trim();
  const coordsMatch = normalized.match(/^(-?\d+(\.\d+)?)\s*,\s*(-?\d+(\.\d+)?)$/);
  if (coordsMatch) {
    return `https://www.openstreetmap.org/?mlat=${coordsMatch[1]}&mlon=${coordsMatch[3]}#map=18/${coordsMatch[1]}/${coordsMatch[3]}`;
  }
  return `https://www.openstreetmap.org/search?query=${encodeURIComponent(normalized)}`;
}

export default function BookingRequestScreen() {
  const params = useLocalSearchParams<{ providerId?: string; categoryId?: string }>();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const compactGrid = width < 430;
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [providers, setProviders] = useState<ProviderCard[]>([]);
  const [providerQuery, setProviderQuery] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState(params.categoryId || "");
  const [selectedProviderId, setSelectedProviderId] = useState(params.providerId || "");
  const [address, setAddress] = useState("Malaybalay City, Bukidnon");
  const [notes, setNotes] = useState("");
  const [preferredProvider, setPreferredProvider] = useState("");
  const [selectedDate, setSelectedDate] = useState(nextUpcomingDays()[0].key);
  const [selectedTime, setSelectedTime] = useState("");
  const [pinLocation, setPinLocation] = useState("");
  const [damageMedia, setDamageMedia] = useState<string[]>([]);
  const [reservedSlots, setReservedSlots] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error" | "info"; title: string; message: string } | null>(null);
  const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);
  const [popupError, setPopupError] = useState<string | null>(null);
  const [showMapPreview, setShowMapPreview] = useState(false);
  const lockedProvider = Boolean(params.providerId);
  const lockedCategory = Boolean(params.categoryId);

  useEffect(() => {
    async function load() {
      const [nextCategories, nextProviders] = await Promise.all([
        categoryService.getAllCategories(),
        providerService.getApprovedProviders(20)
      ]);
      setCategories(nextCategories.filter((category) => Boolean(category?.id)));
      setProviders(nextProviders);

      if (!selectedCategoryId && nextCategories.length) {
        setSelectedCategoryId(params.categoryId || nextCategories[0].id);
      }

      if (!selectedProviderId && nextProviders.length) {
        const initialProvider = params.providerId
          ? nextProviders.find((provider) => provider.userId === params.providerId) ?? nextProviders[0]
          : nextProviders[0];
        setSelectedProviderId(initialProvider.userId);
        setPreferredProvider(initialProvider.displayName);
      }
    }

    void load();
  }, [params.categoryId, params.providerId, selectedCategoryId, selectedProviderId]);

  const selectedCategory = categories.find((category) => category.id === selectedCategoryId) || null;
  const filteredProviders = useMemo(() => {
    const normalized = providerQuery.trim().toLowerCase();
    return providers.filter((provider) => {
      const matchesCategory =
        !selectedCategoryId ||
        provider.serviceCategories.includes(selectedCategoryId) ||
        provider.serviceCategories.includes(selectedCategory?.name || "");
      const matchesQuery =
        !normalized ||
        [provider.displayName, provider.businessName, provider.city, ...provider.serviceCategories]
          .join(" ")
          .toLowerCase()
          .includes(normalized);
      return matchesCategory && matchesQuery;
    });
  }, [providerQuery, providers, selectedCategory?.name, selectedCategoryId]);

  const selectedProvider =
    filteredProviders.find((provider) => provider.userId === selectedProviderId) ||
    providers.find((provider) => provider.userId === selectedProviderId);

  const providerCategoryOptions = useMemo(() => {
    if (!selectedProvider) return categories;

    return categories.filter((category) => {
      const normalizedCategoryName = (category.name || "").trim().toLowerCase();
      return selectedProvider.serviceCategories.some((entry) => {
        const normalizedProviderCategory = entry.trim().toLowerCase();
        return normalizedProviderCategory === category.id.toLowerCase() || normalizedProviderCategory === normalizedCategoryName;
      });
    });
  }, [categories, selectedProvider]);

  const providerHasSingleCategory = lockedProvider && providerCategoryOptions.length === 1;

  const dates = nextUpcomingDays();
  const selectedDateInfo = dates.find((item) => item.key === selectedDate) || dates[0];
  const availableSlots = useMemo(
    () => buildTimeSlots(selectedProvider, selectedDateInfo.weekday, selectedDate, reservedSlots),
    [reservedSlots, selectedDate, selectedDateInfo.weekday, selectedProvider]
  );

  useEffect(() => {
    if (!selectedProviderId || !selectedDate) {
      setReservedSlots([]);
      return;
    }

    const unsubscribe = bookingService.subscribeReservedSlotTimes(selectedProviderId, selectedDate, (times) => {
      setReservedSlots(times);
    });

    return unsubscribe;
  }, [selectedDate, selectedProviderId]);

  useEffect(() => {
    if (filteredProviders.length && !filteredProviders.some((provider) => provider.userId === selectedProviderId)) {
      const nextProvider = filteredProviders[0];
      setSelectedProviderId(nextProvider.userId);
      setPreferredProvider(nextProvider.displayName);
    }
  }, [filteredProviders, selectedProviderId]);

  useEffect(() => {
    if (availableSlots.length && !availableSlots.includes(selectedTime)) {
      setSelectedTime(availableSlots[0]);
    }
    if (!availableSlots.length) {
      setSelectedTime("");
    }
  }, [availableSlots, selectedTime]);

  useEffect(() => {
    if (!lockedProvider || !selectedProvider) return;

    const nextCategory =
      providerCategoryOptions.find((category) => {
        const normalizedSelected = selectedCategoryId.trim().toLowerCase();
        return category.id.toLowerCase() === normalizedSelected || (category.name || "").trim().toLowerCase() === normalizedSelected;
      }) || providerCategoryOptions[0];

    if (nextCategory && nextCategory.id !== selectedCategoryId) {
      setSelectedCategoryId(nextCategory.id);
    }
  }, [lockedProvider, providerCategoryOptions, selectedCategoryId, selectedProvider]);

  async function autofillLocation() {
    const location = await requestCurrentLocation();
    if (!location.granted) {
      setFeedback({
        type: "error",
        title: "Location permission needed",
        message: "Please allow location access so we can autofill your booking address."
      });
      return;
    }
    setPinLocation(location.label);
    if (!address.trim() || address === "Malaybalay City, Bukidnon") {
      setAddress("Current pinned location");
    }
    setFeedback({
      type: "success",
      title: "Location captured",
      message: "Your GPS pin is ready. You can still type the complete address for the provider."
    });
  }

  async function handleSubmit() {
    if (!user || !selectedCategory || !selectedProvider || !selectedTime || !address.trim()) {
      setPopupError("Please complete every required booking field before submitting.");
      setFeedback({
        type: "error",
        title: "Missing booking details",
        message: "Please choose a provider, date, and available time slot before submitting."
      });
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    try {
      const scheduledAt = `${selectedDateInfo.month} ${selectedDateInfo.label}, ${selectedDateInfo.weekday} - ${selectedTime}`;
      const serviceName = selectedCategory.name?.trim() || selectedCategory.id || "Service Request";
      const preferredName = preferredProvider || selectedProvider.displayName || "Selected provider";

      const bookingId = await bookingService.createBooking({
        customerId: user.id,
        providerId: selectedProvider.userId,
        serviceCategoryId: selectedCategory.id,
        serviceName,
        scheduledAt,
        scheduledDate: selectedDate,
        scheduledTime: selectedTime,
        address: address.trim(),
        location: pinLocation || address.trim(),
        notes: notes.trim() || `Preferred provider: ${preferredName}`,
        attachments: damageMedia,
        status: "Pending",
        amount: Number(selectedCategory.startingPrice || 0),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      await paymentService.createPayment({
        bookingId,
        customerId: user.id,
        providerId: selectedProvider.userId,
        amount: Number(selectedCategory.startingPrice || 0),
        method: "Cash on Service",
        status: "Pending",
        createdAt: new Date().toISOString()
      });

      await notificationService.createNotification({
        userId: user.id,
        type: "booking_created",
        title: "Booking request sent",
        body: `Your ${serviceName.toLowerCase()} request was sent to ${preferredName}.`,
        isRead: false,
        route: "/(tabs)/bookings",
        createdAt: new Date().toISOString()
      });

      await notificationService.createNotification({
        userId: user.id,
        type: "payment_pending",
        title: "Payment pending",
        body: `A pending payment record was created for ${serviceName.toLowerCase()}.`,
        isRead: false,
        route: "/(tabs)/payments",
        createdAt: new Date().toISOString()
      });

      await notificationService.createNotification({
        userId: selectedProvider.userId,
        type: "booking_request_received",
        title: "New booking request",
        body: `${user.fullName} requested ${serviceName.toLowerCase()} on ${scheduledAt}.`,
        isRead: false,
        route: "/(tabs)/jobs",
        createdAt: new Date().toISOString()
      });

      setShowSuccessOverlay(true);
      setFeedback({
        type: "success",
        title: "Booking successful",
        message: "Your request was submitted successfully. Preparing your booking details now."
      });

      setTimeout(() => {
        setShowSuccessOverlay(false);
        router.replace({ pathname: "/booking-detail", params: { bookingId, backTo: "/(tabs)/home" } });
      }, 1200);
    } catch (error) {
      console.error("Booking error:", error);
      const message = error instanceof Error ? error.message : "We couldn't submit your request right now. Please try another slot or try again in a moment.";
      setPopupError(message);
      setFeedback({
        type: "error",
        title: "Booking failed",
        message
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <FixedScreen
      style={{ backgroundColor: theme.colors.background }}
      header={<BackHeader title="Book a Service" onBack={() => router.back()} />}
      footer={
        <PrimaryButton
          label={submitting ? "Submitting request..." : "Submit booking request"}
          onPress={() => void handleSubmit()}
          disabled={submitting}
        />
      }
    >
      {feedback ? <FeedbackBanner type={feedback.type} title={feedback.title} message={feedback.message} /> : null}
      <FullScreenPopup
        visible={submitting}
        tone="info"
        icon="hourglass-outline"
        title="Submitting booking"
        message="We are reserving the provider slot and preparing your booking details."
      />
      <FullScreenPopup
        visible={showSuccessOverlay}
        title="Booking successful"
        message="Your request was sent to the provider and saved to your bookings."
      />
      <FullScreenPopup
        visible={!!popupError}
        tone="error"
        icon="alert-circle"
        title="Booking incomplete"
        message={popupError || ""}
        dismissLabel="Continue editing"
        onDismiss={() => setPopupError(null)}
      />
      <MapPreviewModal
        visible={showMapPreview}
        title="Booking location preview"
        subtitle={pinLocation || address}
        mapUrl={mapsUrl(pinLocation || address)}
        onClose={() => setShowMapPreview(false)}
        onOpenExternal={() => void Linking.openURL(mapsExternalUrl(pinLocation || address))}
      />

      <SurfaceCard>
        <Text style={{ color: theme.colors.text, fontSize: 17, fontWeight: "800" }}>{providerHasSingleCategory ? "Selected Service Category" : "Choose Service Category"}<Text style={{ color: theme.colors.danger }}> *</Text></Text>
        {providerHasSingleCategory && selectedCategory ? (
          <View style={{ marginTop: 12, borderRadius: 18, padding: 14, backgroundColor: theme.colors.primarySoft, borderWidth: 1, borderColor: theme.colors.primary }}>
            <Text style={{ color: theme.colors.text, fontWeight: "800" }}>{selectedCategory.name || selectedCategory.id}</Text>
            <Text style={{ color: theme.colors.textMuted, marginTop: 4 }}>This provider only offers one service category, so it has been selected automatically.</Text>
          </View>
        ) : (
          <View style={{ marginTop: 12, flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {(lockedProvider ? providerCategoryOptions : categories).map((category) => (
              <Pressable
                key={category.id}
                onPress={() => setSelectedCategoryId(category.id)}
                style={{
                  borderRadius: 18,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  backgroundColor: selectedCategoryId === category.id ? theme.colors.primary : theme.colors.surfaceAlt,
                  borderWidth: 1,
                  borderColor: selectedCategoryId === category.id ? theme.colors.primary : theme.colors.border
                }}
              >
                <Text style={{ color: selectedCategoryId === category.id ? theme.colors.textOnPrimary : theme.colors.text, fontWeight: "700" }}>
                  {category.name || category.id}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </SurfaceCard>

      <SurfaceCard>
        <Text style={{ color: theme.colors.text, fontSize: 17, fontWeight: "800" }}>{lockedProvider ? "Selected provider" : "Preferred provider"}<Text style={{ color: theme.colors.danger }}> *</Text></Text>
        {!lockedProvider ? <SearchBar placeholder="Search provider..." value={providerQuery} onChangeText={setProviderQuery} /> : null}
        <View style={{ marginTop: 12, gap: 10 }}>
          {(lockedProvider && selectedProvider ? [selectedProvider] : filteredProviders).map((provider) => (
            <Pressable
              key={provider.userId}
              disabled={lockedProvider}
              onPress={() => {
                setSelectedProviderId(provider.userId);
                setPreferredProvider(provider.displayName);
              }}
              style={{
                borderRadius: 20,
                padding: 14,
                backgroundColor: selectedProviderId === provider.userId ? theme.colors.primarySoft : theme.colors.card,
                borderWidth: 1,
                borderColor: selectedProviderId === provider.userId ? theme.colors.primary : theme.colors.border
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.colors.text, fontWeight: "800" }}>{provider.displayName}</Text>
                  <Text style={{ color: theme.colors.textMuted, marginTop: 4 }}>
                    {provider.serviceCategories.join(", ") || "General services"} - {provider.city || "Location pending"}
                  </Text>
                </View>
                <Text style={{ color: theme.colors.accent, fontWeight: "800" }}>
                  ★ {provider.rating?.toFixed(1) || "New"}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      </SurfaceCard>

      <SurfaceCard>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ color: theme.colors.text, fontSize: 17, fontWeight: "800" }}>Location<Text style={{ color: theme.colors.danger }}> *</Text></Text>
          <Pressable onPress={() => void autofillLocation()}>
            <Text style={{ color: theme.colors.primary, fontWeight: "800" }}>Use GPS</Text>
          </Pressable>
        </View>
        <View style={{ marginTop: 12 }}>
          <FormInput label="Service address" value={address} onChangeText={setAddress} placeholder="Booking location" required error={!address.trim() && !!popupError} />
        </View>
        <Pressable
          onPress={() => setShowMapPreview(true)}
          style={{
            marginTop: 10,
            borderRadius: 18,
            padding: 16,
            backgroundColor: theme.colors.surfaceAlt,
            borderWidth: 1,
            borderColor: theme.colors.border
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: theme.colors.card, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="map-outline" size={22} color={theme.colors.primaryDark} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.colors.text, fontWeight: "800" }}>Map preview</Text>
              <Text style={{ color: theme.colors.textMuted }} numberOfLines={2}>
                {pinLocation ? `${address} • Exact GPS pin ready` : address}
              </Text>
            </View>
            <Ionicons name="chevron-forward-outline" size={18} color={theme.colors.primaryDark} />
          </View>
        </Pressable>
      </SurfaceCard>

      <SurfaceCard>
        <Text style={{ color: theme.colors.text, fontSize: 17, fontWeight: "800" }}>Choose date<Text style={{ color: theme.colors.danger }}> *</Text></Text>
        <Text style={{ color: theme.colors.textMuted, marginTop: 4 }}>Dates are shown in a calendar-style board and reflect provider availability.</Text>
        <View style={{ marginTop: 12, flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {dates.map((day) => {
            const canSelect = Boolean(selectedProvider?.availability.some((slot) => slot.day === day.weekday && slot.available));
            const active = selectedDate === day.key;
            return (
              <Pressable
                key={day.key}
                disabled={!canSelect}
                onPress={() => setSelectedDate(day.key)}
                style={{
                  width: compactGrid ? "30%" : "22%",
                  minWidth: compactGrid ? 82 : 72,
                  borderRadius: 20,
                  paddingVertical: 12,
                  alignItems: "center",
                  backgroundColor: active ? theme.colors.primary : canSelect ? theme.colors.surfaceAlt : "#ECEFF3",
                  borderWidth: 1,
                  borderColor: active ? theme.colors.primary : theme.colors.border,
                  opacity: canSelect ? 1 : 0.48
                }}
              >
                <Text style={{ color: active ? "#fff" : theme.colors.textMuted, fontSize: 11, fontWeight: "700" }}>{day.weekday}</Text>
                <Text style={{ color: active ? "#fff" : theme.colors.text, fontSize: 20, fontWeight: "900", marginTop: 4 }}>{day.label}</Text>
                <Text style={{ color: active ? "#fff" : theme.colors.textLight, fontSize: 11 }}>{day.month}</Text>
              </Pressable>
            );
          })}
        </View>
      </SurfaceCard>

      <SurfaceCard>
        <Text style={{ color: theme.colors.text, fontSize: 17, fontWeight: "800" }}>Available time slots<Text style={{ color: theme.colors.danger }}> *</Text></Text>
        <Text style={{ color: theme.colors.textMuted, marginTop: 4 }}>
          We only show schedules that are currently marked available and not already reserved by another booking.
        </Text>
        <View style={{ marginTop: 12, flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {availableSlots.length ? (
            availableSlots.map((slot) => (
              <Pressable
                key={slot}
                onPress={() => setSelectedTime(slot)}
                style={{
                  borderRadius: 20,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  backgroundColor: selectedTime === slot ? theme.colors.primary : theme.colors.surfaceAlt,
                  borderWidth: 1,
                  borderColor: selectedTime === slot ? theme.colors.primary : theme.colors.border
                }}
              >
                <Text style={{ color: selectedTime === slot ? theme.colors.textOnPrimary : theme.colors.text, fontWeight: "700" }}>
                  {slot}
                </Text>
              </Pressable>
            ))
          ) : (
            <Text style={{ color: theme.colors.textMuted }}>
              No valid slots are available for the selected provider on this date yet. The provider may already be busy working on another booking.
            </Text>
          )}
        </View>
      </SurfaceCard>

      <FormInput
        label="Issue details or notes"
        value={notes}
        onChangeText={setNotes}
        multiline
        style={{ minHeight: 110, textAlignVertical: "top" }}
        placeholder="Describe the issue, scope of work, access instructions, or anything the provider should know."
      />

      <MultiMediaPickerField
        label="Damage photos or videos"
        values={damageMedia}
        onChange={setDamageMedia}
        helper="Attach as many photos or videos as needed so the provider can inspect the issue before visiting."
      />

      <SurfaceCard style={{ backgroundColor: theme.colors.surfaceAlt }}>
        <Text style={{ color: theme.colors.textMuted, fontSize: 12, fontWeight: "700" }}>Estimated service fee</Text>
        <Text style={{ color: theme.colors.text, fontSize: 26, fontWeight: "900", marginTop: 6 }}>
          PHP {Number(selectedCategory?.startingPrice || 0).toLocaleString()}
        </Text>
      </SurfaceCard>

    </FixedScreen>
  );
}
