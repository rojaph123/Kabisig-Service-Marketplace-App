import { useEffect, useMemo, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Linking, Pressable, Text, View, useWindowDimensions } from "react-native";
import {
  bookingService,
  categoryService,
  notificationService,
  providerService,
  userService,
  type CustomerProfile,
  type ServiceCategory
} from "@kabisig/shared";
import { BackHeader, FeedbackBanner, FixedScreen, FormInput, FullScreenPopup, MapPreviewModal, MultiMediaPickerField, PrimaryButton, SearchBar, SurfaceCard } from "../src/components";
import { useAuth } from "../src/hooks/AuthProvider";
import { requestCurrentLocation } from "../src/services/location";
import { theme } from "../src/theme";
import { readableAppError } from "../src/utils/errors";
import { googleMapsEmbedUrl, googleMapsExternalUrl } from "../src/utils/maps";
import { formatProviderStartingRate } from "../src/utils/rates";
import { getProviderResponseTimeLabel } from "../src/utils/responseTime";

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
  reservedSlots: string[],
  allowSavedProviderFlexibleTime = false
) {
  const dateException = provider?.scheduleExceptions?.find((item) => item.unavailable && item.date === selectedDate);
  if (dateException) return [];
  const schedule = provider?.availability?.find((slot) => slot.day === weekday && slot.available);
  if (!schedule) return allowSavedProviderFlexibleTime ? ["Flexible time"] : [];

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

export default function BookingRequestScreen() {
  const params = useLocalSearchParams<{ providerId?: string; categoryId?: string }>();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const compactGrid = width < 430;
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [providers, setProviders] = useState<ProviderCard[]>([]);
  const [savedProviderIds, setSavedProviderIds] = useState<string[]>([]);
  const [customerProfile, setCustomerProfile] = useState<CustomerProfile | null>(null);
  const [providerQuery, setProviderQuery] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState(params.categoryId || "");
  const [selectedProviderId, setSelectedProviderId] = useState(params.providerId || "");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [preferredProvider, setPreferredProvider] = useState("");
  const [selectedDate, setSelectedDate] = useState(nextUpcomingDays()[0].key);
  const [selectedTime, setSelectedTime] = useState("");
  const [pinLocation, setPinLocation] = useState("");
  const [locating, setLocating] = useState(false);
  const [damageMedia, setDamageMedia] = useState<string[]>([]);
  const [reservedSlots, setReservedSlots] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error" | "info"; title: string; message: string } | null>(null);
  const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);
  const [popupError, setPopupError] = useState<string | null>(null);
  const [showMapPreview, setShowMapPreview] = useState(false);
  const lockedProvider = Boolean(params.providerId);

  useEffect(() => {
    let mounted = true;

    async function load() {
      const [nextCategories, nextProviders] = await Promise.all([
        categoryService.getAllCategories(),
        providerService.getApprovedProviders(20)
      ]);
      const [nextSavedProviderIds, nextCustomerProfile] = user?.role === "customer"
        ? await Promise.all([userService.getSavedProviderIds(user.id), userService.getCustomerProfile(user.id)])
        : [[], null];
      if (!mounted) return;
      setCategories(nextCategories.filter((category) => Boolean(category?.id)));
      setSavedProviderIds(nextSavedProviderIds);
      setCustomerProfile(nextCustomerProfile);
      const savedProviders = nextSavedProviderIds.length
        ? (await providerService.getAllProviderProfiles()).filter((provider) => {
            const isSaved = nextSavedProviderIds.includes(provider.userId);
            const isBookable = provider.isApproved && (!provider.moderation || provider.moderation.status === "active");
            return isSaved && isBookable;
          })
        : [];
      const lockedProviderProfile =
        params.providerId && !nextProviders.some((provider) => provider.userId === params.providerId)
          ? await userService.getProviderProfile(params.providerId)
          : null;
      const mergedProviders = [
        ...nextProviders,
        ...savedProviders.filter((savedProvider) => !nextProviders.some((provider) => provider.userId === savedProvider.userId)),
        ...(lockedProviderProfile?.isApproved && (!lockedProviderProfile.moderation || lockedProviderProfile.moderation.status === "active")
          ? [{ ...lockedProviderProfile, userId: params.providerId as string }]
          : [])
      ].filter((provider, index, list) => list.findIndex((item) => item.userId === provider.userId) === index);

      setProviders(
        mergedProviders.sort((a, b) => {
          const aSaved = nextSavedProviderIds.includes(a.userId) ? 1 : 0;
          const bSaved = nextSavedProviderIds.includes(b.userId) ? 1 : 0;
          return bSaved - aSaved || (b.rating || 0) - (a.rating || 0);
        })
      );

      if (!selectedCategoryId && nextCategories.length) {
        setSelectedCategoryId(params.categoryId || nextCategories[0].id);
      }

      if (params.providerId && !selectedProviderId) {
        const initialProvider = mergedProviders.find((provider) => provider.userId === params.providerId);
        if (initialProvider) {
          setSelectedProviderId(initialProvider.userId);
          setPreferredProvider(initialProvider.displayName);
        }
      }
    }

    void load().catch((error) => {
      if (!mounted) return;
      console.warn("Unable to load booking request options:", error);
      setCategories([]);
      setSavedProviderIds([]);
      setProviders([]);
    });

    return () => {
      mounted = false;
    };
  }, [params.categoryId, params.providerId, selectedCategoryId, selectedProviderId, user?.id, user?.role]);

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
  const previewLocation = (pinLocation || address).trim();

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
  const savedAddresses = useMemo(() => {
    const all = [
      customerProfile?.defaultLocation || "",
      ...(customerProfile?.addresses || [])
    ]
      .map((value) => value.trim())
      .filter(Boolean);

    return all.filter((value, index) => all.findIndex((item) => item.toLowerCase() === value.toLowerCase()) === index);
  }, [customerProfile?.addresses, customerProfile?.defaultLocation]);

  const dates = nextUpcomingDays();
  const selectedDateInfo = dates.find((item) => item.key === selectedDate) || dates[0];
  const selectedDateException = selectedProvider?.scheduleExceptions?.find((item) => item.unavailable && item.date === selectedDate);
  const selectedProviderIsSaved = Boolean(selectedProvider && savedProviderIds.includes(selectedProvider.userId));
  const availableSlots = useMemo(
    () => buildTimeSlots(selectedProvider, selectedDateInfo.weekday, selectedDate, reservedSlots, selectedProviderIsSaved),
    [reservedSlots, selectedDate, selectedDateInfo.weekday, selectedProvider, selectedProviderIsSaved]
  );
  const canSubmitBooking = Boolean(user && selectedCategory && selectedProvider && selectedTime && address.trim());

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
    if (!lockedProvider && selectedProviderId && filteredProviders.length && !filteredProviders.some((provider) => provider.userId === selectedProviderId)) {
      setSelectedProviderId("");
      setPreferredProvider("");
    }
  }, [filteredProviders, lockedProvider, selectedProviderId]);

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
    if (locating) return;
    setLocating(true);
    try {
      const location = await requestCurrentLocation();
      if (!location.granted) {
        setFeedback({
          type: "error",
          title: "Location permission needed",
          message: "Please allow location access only if you want Kabisig to save an exact GPS pin for the worker. You still need to type the complete address."
        });
        return;
      }
      setPinLocation(location.label);
      setFeedback({
        type: "success",
        title: "Location captured",
        message: "Your GPS pin is ready. Please still type the complete address for the provider."
      });
    } catch (error) {
      console.warn("Unable to capture booking GPS location:", error);
      setFeedback({
        type: "error",
        title: "Location unavailable",
        message: readableAppError(error, "We could not get your current location right now. Please try again.")
      });
    } finally {
      setLocating(false);
    }
  }

  async function handleSubmit() {
    if (!user || !selectedCategory || !selectedProvider || !selectedTime || !address.trim()) {
      setPopupError("Please complete every required booking field before submitting.");
      setFeedback({
        type: "error",
        title: "Missing booking details",
        message: "Please choose a worker, date, and available time slot before submitting."
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

      const notificationResults = await Promise.allSettled([
        notificationService.createNotification({
          userId: user.id,
          type: "booking_created",
          title: "Booking request sent",
          body: `Your ${serviceName.toLowerCase()} request was sent to ${preferredName}.`,
          isRead: false,
          route: "/(tabs)/bookings",
          createdAt: new Date().toISOString()
        }),
        notificationService.createNotification({
          userId: selectedProvider.userId,
          type: "booking_request_received",
          title: "New booking request",
          body: `${user.fullName} requested ${serviceName.toLowerCase()} on ${scheduledAt}.`,
          isRead: false,
          route: "/(tabs)/jobs",
          createdAt: new Date().toISOString()
        }),
      ]);

      notificationResults.forEach((result, index) => {
        if (result.status === "rejected") {
          console.warn(index === 0 ? "Customer booking notification failed:" : "Provider booking notification failed:", result.reason);
        }
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
      const message = readableAppError(error, "We couldn't submit your request right now. Please try another slot or try again in a moment.");
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
          disabled={submitting || !canSubmitBooking}
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
        visible={locating}
        tone="info"
        icon="navigate-circle"
        title="Finding your location"
        message="Please wait while we request permission and capture your current GPS pin for the worker."
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
      {previewLocation ? (
        <MapPreviewModal
          visible={showMapPreview}
          title="Booking location preview"
          subtitle={previewLocation}
          mapUrl={googleMapsEmbedUrl(previewLocation)}
          onClose={() => setShowMapPreview(false)}
          onOpenExternal={() => void Linking.openURL(googleMapsExternalUrl(previewLocation))}
        />
      ) : null}

      <SurfaceCard>
        {selectedProvider?.financialStatus?.restrictedFromAcceptingBookings ? (
          <View style={{ borderRadius: 16, padding: 12, marginBottom: 12, backgroundColor: theme.colors.warningSoft, borderWidth: 1, borderColor: theme.colors.warning }}>
            <Text style={{ color: theme.colors.text, fontWeight: "900" }}>Worker cannot accept yet</Text>
            <Text style={{ color: theme.colors.textMuted, marginTop: 4, lineHeight: 18 }}>
              You may still send a booking request, but this worker cannot accept new bookings until the current commission balance is paid.
            </Text>
          </View>
        ) : null}
        <Text style={{ color: theme.colors.text, fontSize: 17, fontWeight: "800" }}>{providerHasSingleCategory ? "Selected Service Category" : "Choose Service Category"}<Text style={{ color: theme.colors.danger }}> *</Text></Text>
        {providerHasSingleCategory && selectedCategory ? (
          <View style={{ borderRadius: 18, padding: 14, backgroundColor: theme.colors.primarySoft, borderWidth: 1, borderColor: theme.colors.primary, gap: 4 }}>
            <Text style={{ color: theme.colors.text, fontWeight: "800" }}>{selectedCategory.name || selectedCategory.id}</Text>
            <Text style={{ color: theme.colors.textMuted }}>This provider only offers one service category, so it has been selected automatically.</Text>
          </View>
        ) : (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
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
        <Text style={{ color: theme.colors.text, fontSize: 17, fontWeight: "800" }}>{lockedProvider ? "Selected worker" : "Choose worker"}<Text style={{ color: theme.colors.danger }}> *</Text></Text>
        {!lockedProvider ? <SearchBar placeholder="Search provider..." value={providerQuery} onChangeText={setProviderQuery} /> : null}
        <View style={{ gap: 10 }}>
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
                  <Text style={{ color: theme.colors.textLight, marginTop: 4, lineHeight: 18 }}>
                    Service areas: {provider.serviceAreas?.length ? provider.serviceAreas.join(", ") : "Not listed yet"}
                  </Text>
                  {savedProviderIds.includes(provider.userId) ? (
                    <Text style={{ color: theme.colors.primary, marginTop: 4, fontWeight: "800" }}>Saved provider</Text>
                  ) : null}
                </View>
                <Text style={{ color: theme.colors.accent, fontWeight: "800" }}>
                  ★ {provider.rating?.toFixed(1) || "New"}
                </Text>
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                {[
                  `${provider.rating ? provider.rating.toFixed(1) : "New"} rating`,
                  `${provider.portfolio?.length || 0} completed jobs`,
                  formatProviderStartingRate(provider, categories),
                  getProviderResponseTimeLabel(provider)
                ].map((item) => (
                  <View
                    key={`${provider.userId}-${item}`}
                    style={{
                      borderRadius: 999,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      backgroundColor: theme.colors.surfaceAlt
                    }}
                  >
                    <Text style={{ color: theme.colors.text, fontWeight: "700", fontSize: 12 }}>{item}</Text>
                  </View>
                ))}
              </View>
            </Pressable>
          ))}
        </View>
      </SurfaceCard>

      <SurfaceCard>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ color: theme.colors.text, fontSize: 17, fontWeight: "800" }}>Location<Text style={{ color: theme.colors.danger }}> *</Text></Text>
          <Pressable onPress={() => void autofillLocation()} disabled={locating}>
            <Text style={{ color: theme.colors.primary, fontWeight: "800", opacity: locating ? 0.55 : 1 }}>
              {locating ? "Locating..." : "Use GPS"}
            </Text>
          </Pressable>
        </View>
        <View style={{ gap: 10 }}>
          <FormInput
            label="Service address"
            value={address}
            onChangeText={setAddress}
            placeholder="Booking location"
            required
            error={!address.trim() && !!popupError}
            helper="Enter the complete readable address first. This is what the worker will read before using the optional map pin."
          />
          {savedAddresses.length ? (
            <View style={{ gap: 8 }}>
              <Text style={{ color: theme.colors.textMuted, fontSize: 12, fontWeight: "800" }}>Saved addresses</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {savedAddresses.slice(0, 4).map((savedAddress) => (
                  <Pressable
                    key={savedAddress}
                    onPress={() => setAddress(savedAddress)}
                    style={{
                      borderRadius: 16,
                      paddingHorizontal: 12,
                      paddingVertical: 9,
                      backgroundColor: address.trim().toLowerCase() === savedAddress.toLowerCase() ? theme.colors.primarySoft : theme.colors.surfaceAlt,
                      borderWidth: 1,
                      borderColor: address.trim().toLowerCase() === savedAddress.toLowerCase() ? theme.colors.primary : theme.colors.border
                    }}
                  >
                    <Text style={{ color: theme.colors.text, fontWeight: "700", fontSize: 12 }} numberOfLines={1}>
                      {savedAddress}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
          {pinLocation ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="checkmark-circle" size={18} color={theme.colors.success} />
              <Text style={{ color: theme.colors.success, fontWeight: "800", flex: 1 }}>
                GPS pin is active for this booking. Keep the complete address as the main location.
              </Text>
            </View>
          ) : null}
        </View>
        <Pressable
          onPress={() => {
            if (!previewLocation) {
              setFeedback({
                type: "info",
                title: "Add a location first",
                message: "Enter the booking address or capture a GPS pin before opening the map preview."
              });
              return;
            }
            setShowMapPreview(true);
          }}
          disabled={!previewLocation}
          style={{
            borderRadius: 18,
            padding: 16,
            backgroundColor: theme.colors.surfaceAlt,
            borderWidth: 1,
            borderColor: theme.colors.border,
            opacity: previewLocation ? 1 : 0.64
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: theme.colors.card, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="map-outline" size={22} color={theme.colors.primaryDark} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.colors.text, fontWeight: "800" }}>Map preview</Text>
              <Text style={{ color: theme.colors.textMuted }}>
                {previewLocation ? (pinLocation ? `${address} • Exact GPS pin ready` : address) : "Add the address first to preview the map."}
              </Text>
            </View>
            <Ionicons name="chevron-forward-outline" size={18} color={theme.colors.primaryDark} />
          </View>
          <Text style={{ color: theme.colors.textLight, fontSize: 12, marginTop: 8, lineHeight: 17 }}>
            Why we need this: the GPS pin helps the worker navigate to the exact place, but it is only used when you tap Use GPS.
          </Text>
        </Pressable>
      </SurfaceCard>

      <SurfaceCard>
        <Text style={{ color: theme.colors.text, fontSize: 17, fontWeight: "800" }}>Choose date<Text style={{ color: theme.colors.danger }}> *</Text></Text>
        <Text style={{ color: theme.colors.textMuted }}>Dates are shown in a calendar-style board and reflect provider availability.</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {dates.map((day) => {
            const hasAvailability = Boolean(selectedProvider?.availability.some((slot) => slot.day === day.weekday && slot.available));
            const blockedByException = Boolean(selectedProvider?.scheduleExceptions?.some((item) => item.unavailable && item.date === day.key));
            const canSelect = hasAvailability || (selectedProviderIsSaved && !blockedByException);
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
                  backgroundColor: active ? theme.colors.primary : canSelect ? theme.colors.surfaceAlt : theme.dark ? theme.colors.card : "#ECEFF3",
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
        <Text style={{ color: theme.colors.textMuted }}>
          Saved workers can still receive a flexible booking request even when they are offline.
        </Text>
        {selectedDateException ? (
          <View style={{ borderRadius: 16, padding: 12, backgroundColor: theme.dark ? theme.colors.warningSoft : "#FFF4E5", borderWidth: 1, borderColor: theme.colors.warning, gap: 4 }}>
            <Text style={{ color: theme.colors.text, fontWeight: "900" }}>Provider unavailable on this date</Text>
            <Text style={{ color: theme.colors.textMuted }}>
              {selectedDateException.reason || "This date was blocked by the provider, so no booking times are available."}
            </Text>
          </View>
        ) : null}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
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
              No valid slots are available for the selected provider on this date yet. Save this worker as a favorite to request a flexible booking while they are offline.
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
        helper="Why we need this: photos or videos help the provider inspect the issue before visiting and prepare the right tools. Camera/gallery access is requested only when you add media."
      />

      <SurfaceCard style={{ backgroundColor: theme.colors.surfaceAlt }}>
        <Text style={{ color: theme.colors.textMuted, fontSize: 12, fontWeight: "700" }}>Estimated service fee</Text>
        <Text style={{ color: theme.colors.text, fontSize: 26, fontWeight: "900", marginTop: 6 }}>
          ₱{Number(selectedCategory?.startingPrice || 0).toLocaleString()}
        </Text>
      </SurfaceCard>

    </FixedScreen>
  );
}
