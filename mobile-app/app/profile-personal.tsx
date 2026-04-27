import { useEffect, useState } from "react";
import { router } from "expo-router";
import { Linking, Pressable, Text, View } from "react-native";
import { userService, type CustomerProfile } from "@kabisig/shared";
import { BackHeader, FeedbackBanner, FixedScreen, FormInput, FullScreenPopup, ImageUploadField, LoadingState, MapPreviewModal, PrimaryButton, SurfaceCard } from "../src/components";
import { useAuth } from "../src/hooks/AuthProvider";
import { requestCurrentLocation } from "../src/services/location";
import { theme } from "../src/theme";

function mapsUrl(address: string) {
  const coords = address.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (coords) {
    const latitude = Number(coords[1]);
    const longitude = Number(coords[2]);
    const delta = 0.008;
    const bbox = [longitude - delta, latitude - delta, longitude + delta, latitude + delta].join("%2C");
    return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${latitude}%2C${longitude}`;
  }
  return `https://www.openstreetmap.org/export/embed.html?search=${encodeURIComponent(address)}`;
}

function mapsExternalUrl(address: string) {
  const coords = address.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (coords) {
    return `https://www.openstreetmap.org/?mlat=${coords[1]}&mlon=${coords[2]}#map=17/${coords[1]}/${coords[2]}`;
  }
  return `https://www.openstreetmap.org/search?query=${encodeURIComponent(address)}`;
}

export default function ProfilePersonalScreen() {
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; title: string; message: string } | null>(null);
  const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);
  const [showMapPreview, setShowMapPreview] = useState(false);
  const [addressesText, setAddressesText] = useState("");
  const [form, setForm] = useState<CustomerProfile>({
    userId: "",
    phone: "",
    addresses: [],
    defaultLocation: "",
    profilePhotoUrl: "",
    notificationPreferences: { push: true, email: true, sms: false }
  });

  useEffect(() => {
    async function load() {
      if (!user) return;
      const profile = await userService.getCustomerProfile(user.id);
      if (profile) {
        setForm(profile);
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

    if (!form.phone.trim() || !form.defaultLocation.trim() || !normalizedAddresses.length) {
      setFeedback({
        type: "error",
        title: "Missing details",
        message: "Phone number, location, and at least one saved address are required."
      });
      return;
    }

    setSaving(true);
    try {
      await userService.updateCustomerProfile(user.id, {
        ...form,
        userId: user.id,
        addresses: normalizedAddresses
      });
      await userService.updateUserDocument(user.id, {
        profilePhoto: form.profilePhotoUrl || ""
      });
      await refreshUser();
      setFeedback({
        type: "success",
        title: "Profile updated",
        message: "Your customer details were saved successfully."
      });
      setShowSuccessOverlay(true);
      setTimeout(() => setShowSuccessOverlay(false), 1000);
    } catch (error) {
      console.error(error);
      setFeedback({
        type: "error",
        title: "Save failed",
        message: "We could not save your details right now."
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleUseGps() {
    const location = await requestCurrentLocation();
    if (!location.granted) {
      setFeedback({
        type: "error",
        title: "Location permission needed",
        message: "Please allow location access so we can capture your current pin."
      });
      return;
    }

    setForm((current) => ({
      ...current,
      defaultLocation: location.label
    }));
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
          <MapPreviewModal
            visible={showMapPreview}
            title="Saved location preview"
            subtitle={form.defaultLocation}
            mapUrl={mapsUrl(form.defaultLocation)}
            onClose={() => setShowMapPreview(false)}
            onOpenExternal={() => void Linking.openURL(mapsExternalUrl(form.defaultLocation))}
          />
        </>
      }
      footer={<PrimaryButton label={saving ? "Saving..." : "Save details"} onPress={() => void handleSave()} disabled={saving} />}
    >
      <ImageUploadField label="Profile photo" value={form.profilePhotoUrl} onChange={(value) => setForm((current) => ({ ...current, profilePhotoUrl: value }))} />
      <FormInput label="Phone number" value={form.phone} onChangeText={(value) => setForm((current) => ({ ...current, phone: value }))} />
      <SurfaceCard>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: "900" }}>Pinpoint location</Text>
          <Pressable onPress={() => void handleUseGps()}>
            <Text style={{ color: theme.colors.primary, fontWeight: "800" }}>Use GPS</Text>
          </Pressable>
        </View>
        <FormInput label="Location" value={form.defaultLocation} onChangeText={(value) => setForm((current) => ({ ...current, defaultLocation: value }))} />
        {form.defaultLocation ? (
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
            <Text style={{ color: theme.colors.text, fontWeight: "800" }}>Preview saved location</Text>
            <Text style={{ color: theme.colors.textMuted, marginTop: 4 }} numberOfLines={2}>
              {form.defaultLocation}
            </Text>
          </Pressable>
        ) : null}
      </SurfaceCard>
      <FormInput
        label="Saved addresses"
        value={addressesText}
        onChangeText={setAddressesText}
        placeholder={"Enter one address per line\nExample:\nPurok 1, Malaybalay City\nApartment 2, Valencia City"}
        style={{ minHeight: 120, textAlignVertical: "top" }}
        multiline
      />
      <FormInput
        label="Notification preferences"
        value={[
          form.notificationPreferences.push ? "Push" : null,
          form.notificationPreferences.email ? "Email" : null,
          form.notificationPreferences.sms ? "SMS" : null
        ].filter(Boolean).join(", ")}
        editable={false}
        style={{ color: theme.colors.textMuted }}
      />
    </FixedScreen>
  );
}
