import { useEffect, useState } from "react";
import { router } from "expo-router";
import { Linking, Pressable, Text, View } from "react-native";
import { userService, type CustomerProfile } from "@kabisig/shared";
import { BackHeader, FeedbackBanner, FixedScreen, FormInput, FullScreenPopup, ImageUploadField, LoadingState, MapPreviewModal, PrimaryButton, SurfaceCard } from "../src/components";
import { useAuth } from "../src/hooks/AuthProvider";
import { requestCurrentLocation } from "../src/services/location";
import { theme } from "../src/theme";
import { readableAppError } from "../src/utils/errors";
import { googleMapsEmbedUrl, googleMapsExternalUrl } from "../src/utils/maps";

export default function ProfilePersonalScreen() {
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; title: string; message: string } | null>(null);
  const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);
  const [locating, setLocating] = useState(false);
  const [showMapPreview, setShowMapPreview] = useState(false);
  const [fullName, setFullName] = useState(user?.fullName || "");
  const [addressesText, setAddressesText] = useState("");
  const [form, setForm] = useState<CustomerProfile>({
    userId: "",
    phone: "",
    addresses: [],
    defaultLocation: "",
    pinpointLocation: "",
    profilePhotoUrl: "",
    notificationPreferences: { push: true, email: true, sms: false }
  });

  useEffect(() => {
    async function load() {
      if (!user) return;
      setFullName(user.fullName || "");
      const profile = await userService.getCustomerProfile(user.id);
      if (profile) {
        const defaultLooksLikePin = Boolean(profile.defaultLocation?.trim().match(/^(-?\d+(\.\d+)?)\s*,\s*(-?\d+(\.\d+)?)$/));
        const readableAddress = profile.addresses.find((address) => !address.trim().match(/^(-?\d+(\.\d+)?)\s*,\s*(-?\d+(\.\d+)?)$/));
        setForm({
          ...profile,
          defaultLocation: defaultLooksLikePin ? readableAddress || "" : profile.defaultLocation,
          pinpointLocation: profile.pinpointLocation || (defaultLooksLikePin ? profile.defaultLocation : "")
        });
        setAddressesText(profile.addresses.join("\n"));
      } else {
        setForm((current) => ({ ...current, userId: user.id }));
        setAddressesText("");
      }
      setLoading(false);
    }

    void load();
  }, [user]);

  async function handleSave() {
    if (!user) return;
    const normalizedAddresses = addressesText
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean);

    if (!fullName.trim() || !form.phone.trim() || !form.defaultLocation.trim()) {
      setFeedback({
        type: "error",
        title: "Missing details",
        message: "Name, phone number, and complete address are required."
      });
      return;
    }
    const completeAddress = form.defaultLocation.trim();
    const savedAddresses = [
      completeAddress,
      ...normalizedAddresses.filter((address) => address.toLowerCase() !== completeAddress.toLowerCase())
    ];

    setSaving(true);
    try {
      await userService.updateCustomerProfile(user.id, {
        ...form,
        userId: user.id,
        defaultLocation: completeAddress,
        pinpointLocation: form.pinpointLocation?.trim() || "",
        addresses: savedAddresses
      });
      await userService.updateUserDocument(user.id, {
        fullName: fullName.trim(),
        profilePhoto: form.profilePhotoUrl || ""
      });
      await refreshUser();
      setFeedback({
        type: "success",
        title: "Profile updated",
        message: "Your customer details were saved successfully."
      });
      setShowSuccessOverlay(true);
      setTimeout(() => {
        setShowSuccessOverlay(false);
        router.replace("/(tabs)/profile");
      }, 1000);
    } catch (error) {
      console.error(error);
      setFeedback({
        type: "error",
        title: "Save failed",
        message: readableAppError(error, "We could not save your details right now.")
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleUseGps() {
    setLocating(true);
    try {
      const location = await requestCurrentLocation();
      if (!location.granted) {
        setFeedback({
          type: "error",
          title: "Location permission needed",
          message: "Please allow location access only if you want Kabisig to save an exact navigation pin. Your complete address remains the main address."
        });
        return;
      }

      setForm((current) => ({
        ...current,
        pinpointLocation: location.label
      }));
    } catch (error) {
      console.warn("Unable to capture GPS location:", error);
      setFeedback({
        type: "error",
        title: "Location unavailable",
        message: readableAppError(error, "We could not get your current location right now. Please try again or type your complete address.")
      });
    } finally {
      setLocating(false);
    }
  }

  if (loading) {
    return (
      <FixedScreen header={<BackHeader title="Personal Details" onBack={() => router.back()} />}>
        <LoadingState label="Loading personal details..." />
      </FixedScreen>
    );
  }

  return (
    <FixedScreen
      header={
        <>
          <BackHeader title="Personal Details" onBack={() => router.back()} />
          {feedback ? <FeedbackBanner type={feedback.type} title={feedback.title} message={feedback.message} /> : null}
          <FullScreenPopup visible={showSuccessOverlay} title="Details updated" message="Your profile information was saved successfully." />
          <FullScreenPopup
            visible={locating}
            title="Finding your location"
            message="Please wait while we request permission and capture your current GPS pin."
            icon="navigate-circle"
            tone="info"
          />
          <MapPreviewModal
            visible={showMapPreview}
            title="Pinpoint location preview"
            subtitle={form.pinpointLocation || form.defaultLocation}
            mapUrl={googleMapsEmbedUrl(form.pinpointLocation || form.defaultLocation)}
            onClose={() => setShowMapPreview(false)}
            onOpenExternal={() => void Linking.openURL(googleMapsExternalUrl(form.pinpointLocation || form.defaultLocation))}
          />
        </>
      }
      footer={<PrimaryButton label={saving ? "Saving..." : "Save details"} onPress={() => void handleSave()} disabled={saving} />}
    >
      <ImageUploadField label="Profile photo" value={form.profilePhotoUrl} onChange={(value) => setForm((current) => ({ ...current, profilePhotoUrl: value }))} compact />
      <SurfaceCard style={{ backgroundColor: theme.colors.surfaceAlt }}>
        <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: "900" }}>Why permissions are requested</Text>
        <Text style={{ color: theme.colors.textMuted, lineHeight: 20 }}>
          Location is used only when you tap Use GPS, camera/gallery access is used only when you upload photos, and notifications help show booking, payment, chat, and account updates.
        </Text>
      </SurfaceCard>
      <FormInput label="Full name" value={fullName} onChangeText={setFullName} />
      <FormInput label="Phone number" value={form.phone} onChangeText={(value) => setForm((current) => ({ ...current, phone: value }))} />
      <SurfaceCard>
        <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: "900" }}>Complete address</Text>
        <Text style={{ color: theme.colors.textMuted, lineHeight: 20 }}>
          This is the main address shown to workers and used in your bookings. Enter house/unit, street, barangay, city, and province.
        </Text>
        <FormInput
          label="Complete address"
          value={form.defaultLocation}
          onChangeText={(value) => setForm((current) => ({ ...current, defaultLocation: value }))}
          placeholder="House/Unit, Street, Barangay, City, Province"
        />
      </SurfaceCard>

      <SurfaceCard>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: "900" }}>Pinpoint location</Text>
            <Text style={{ color: theme.colors.textMuted, marginTop: 3 }}>Optional map pin for exact navigation.</Text>
          </View>
          <Pressable onPress={() => void handleUseGps()} disabled={locating}>
            <Text style={{ color: theme.colors.primary, fontWeight: "800", opacity: locating ? 0.55 : 1 }}>
              {locating ? "Locating..." : "Use GPS"}
            </Text>
          </Pressable>
        </View>
        <Text style={{ color: theme.colors.textMuted, lineHeight: 20 }}>
          The GPS pin helps the worker open the exact place in maps, but it does not replace your complete address.
        </Text>
        {form.pinpointLocation ? (
          <Pressable
            onPress={() => setShowMapPreview(true)}
            style={{
              borderRadius: 18,
              padding: 14,
              backgroundColor: theme.colors.surfaceAlt,
              borderWidth: 1,
              borderColor: theme.colors.border
            }}
          >
            <Text style={{ color: theme.colors.text, fontWeight: "800" }}>Preview pinpoint location</Text>
            <Text style={{ color: theme.colors.textMuted, marginTop: 4 }} numberOfLines={2}>
              {form.pinpointLocation}
            </Text>
          </Pressable>
        ) : (
          <Text style={{ color: theme.colors.textMuted }}>No GPS pin added yet.</Text>
        )}
      </SurfaceCard>
      <FormInput
        label="Other complete addresses"
        value={addressesText}
        onChangeText={setAddressesText}
        placeholder={"Enter one complete address per line\nExample:\nPurok 1, Barangay 1, Malaybalay City, Bukidnon\nApartment 2, Street Name, Malaybalay City, Bukidnon"}
        style={{ minHeight: 120, textAlignVertical: "top" }}
        multiline
      />
    </FixedScreen>
  );
}
