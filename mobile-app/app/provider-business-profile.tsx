import { useEffect, useState } from "react";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { categoryService, coverageAreaService, userService, type CoverageArea, type ProviderProfile, type ServiceCategory } from "@kabisig/shared";
import { BackHeader, FeedbackBanner, FixedScreen, FormInput, FullScreenPopup, ImageUploadField, LoadingState, PrimaryButton, SurfaceCard } from "../src/components";
import { useAuth } from "../src/hooks/AuthProvider";
import { theme } from "../src/theme";
import { formatProviderStartingRate, getProviderMinimumJobRate } from "../src/utils/rates";

export default function ProviderBusinessProfileScreen() {
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; title: string; message: string } | null>(null);
  const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);
  const [form, setForm] = useState<ProviderProfile | null>(null);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [coverageAreas, setCoverageAreas] = useState<CoverageArea[]>([]);
  const [showServiceAreaPicker, setShowServiceAreaPicker] = useState(false);

  useEffect(() => {
    async function load() {
      if (!user) return;
      const [profile, nextCategories, nextCoverageAreas] = await Promise.all([
        userService.getProviderProfile(user.id),
        categoryService.getAllCategories(),
        coverageAreaService.getAllCoverageAreas()
      ]);
      const enabledAreaNames = new Set(nextCoverageAreas.map((area) => area.name));
      const currentAreas = profile?.serviceAreas?.length
        ? profile.serviceAreas
        : profile?.city
          ? profile.city.split(",").map((item) => item.trim()).filter(Boolean)
          : [];
      const normalizedProfile = profile
        ? {
            ...profile,
            serviceAreas: currentAreas.filter((area) => enabledAreaNames.has(area))
          }
        : profile;
      setForm(normalizedProfile);
      setCategories(nextCategories);
      setCoverageAreas(nextCoverageAreas);
      setLoading(false);
    }

    void load();
  }, [user]);

  async function handleSave() {
    if (!user || !form) return;
    if (!form.displayName.trim() || !form.phone.trim() || !form.address.trim() || !form.serviceAreas.length) {
      setFeedback({
        type: "error",
        title: "Missing details",
        message: "Display name, phone, complete address, and at least one service area are required."
      });
      return;
    }

    setSaving(true);
    try {
      const minimumJobRate = getProviderMinimumJobRate(form, categories);
      await userService.updateProviderProfile(user.id, {
        ...form,
        city: form.serviceAreas.join(", "),
        hourlyRate: minimumJobRate
      });
      await userService.updateUserDocument(user.id, {
        fullName: form.displayName,
        profilePhoto: form.profilePhotoUrl || ""
      });
      await refreshUser();
      setFeedback({
        type: "success",
        title: "Business profile updated",
        message: "Your provider details were saved successfully."
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
        message: "We could not save your provider profile right now."
      });
    } finally {
      setSaving(false);
    }
  }

  function toggleServiceArea(name: string) {
    setForm((current) => {
      if (!current) return current;
      const nextAreas = current.serviceAreas.includes(name)
        ? current.serviceAreas.filter((area) => area !== name)
        : [...current.serviceAreas, name];
      return {
        ...current,
        serviceAreas: nextAreas
      };
    });
  }

  if (loading || !form) {
    return (
      <FixedScreen header={<BackHeader title="Business Profile" onBack={() => router.back()} />}>
        <LoadingState label="Loading business profile..." />
      </FixedScreen>
    );
  }

  return (
    <FixedScreen
      header={
        <>
          <BackHeader title="Business Profile" onBack={() => router.back()} />
          {feedback ? <FeedbackBanner type={feedback.type} title={feedback.title} message={feedback.message} /> : null}
          <FullScreenPopup visible={showSuccessOverlay} title="Business profile saved" message="Your provider information was updated successfully." />
        </>
      }
      footer={<PrimaryButton label={saving ? "Saving..." : "Save business profile"} onPress={() => void handleSave()} disabled={saving} />}
    >
      <ImageUploadField label="Profile photo" value={form.profilePhotoUrl} onChange={(value) => setForm((current) => (current ? { ...current, profilePhotoUrl: value } : current))} compact />
      <FormInput label="Display name" value={form.displayName} onChangeText={(value) => setForm((current) => (current ? { ...current, displayName: value } : current))} />
      <FormInput label="Business name" value={form.businessName} onChangeText={(value) => setForm((current) => (current ? { ...current, businessName: value } : current))} />
      <FormInput label="Phone number" value={form.phone} onChangeText={(value) => setForm((current) => (current ? { ...current, phone: value } : current))} />
      <FormInput label="Address" value={form.address} onChangeText={(value) => setForm((current) => (current ? { ...current, address: value } : current))} />
      <SurfaceCard style={{ gap: 12 }}>
        <Text style={{ color: theme.colors.text, fontSize: 15, fontWeight: "900" }}>Service areas</Text>
        <Text style={{ color: theme.colors.textMuted, lineHeight: 19 }}>
          Choose from the service areas enabled by the admin.
        </Text>
        <Pressable
          onPress={() => setShowServiceAreaPicker(true)}
          style={{
            borderRadius: 18,
            borderWidth: 1,
            borderColor: form.serviceAreas.length ? theme.colors.border : theme.colors.danger,
            backgroundColor: theme.colors.card,
            padding: 14,
            flexDirection: "row",
            alignItems: "center",
            gap: 10
          }}
        >
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={{ color: form.serviceAreas.length ? theme.colors.text : theme.colors.textMuted, fontWeight: "800" }}>
              {form.serviceAreas.length ? form.serviceAreas.join(", ") : "Select service areas"}
            </Text>
          </View>
          <Ionicons name="chevron-down-outline" size={20} color={theme.colors.primaryDark} />
        </Pressable>
      </SurfaceCard>
      <SurfaceCard style={{ gap: 12 }}>
        <Text style={{ color: theme.colors.text, fontSize: 15, fontWeight: "900" }}>Service categories</Text>
        <Text style={{ color: theme.colors.textMuted, lineHeight: 19 }}>
          Categories are locked from your approved provider application. Request a profile revision if these need to change.
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {form.serviceCategories.length ? (
            form.serviceCategories.map((category) => (
              <View key={category} style={{ borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: theme.colors.primarySoft }}>
                <Text style={{ color: theme.colors.primaryDark, fontWeight: "800" }}>{category}</Text>
              </View>
            ))
          ) : (
            <Text style={{ color: theme.colors.textMuted }}>No approved service categories yet.</Text>
          )}
        </View>
      </SurfaceCard>
      <FormInput label="Years of experience" value={String(form.yearsExperience || 0)} keyboardType="numeric" onChangeText={(value) => setForm((current) => (current ? { ...current, yearsExperience: Number(value) || 0 } : current))} />
      <SurfaceCard style={{ gap: 8 }}>
        <Text style={{ color: theme.colors.text, fontSize: 15, fontWeight: "900" }}>Starting rate</Text>
        <Text style={{ color: theme.colors.textMuted, lineHeight: 19 }}>
          This is calculated from the minimum starting price of your approved service categories.
        </Text>
        <Text style={{ color: theme.colors.primaryDark, fontSize: 24, fontWeight: "900" }}>{formatProviderStartingRate(form, categories)}</Text>
      </SurfaceCard>
      <FormInput label="Professional bio" value={form.bio} onChangeText={(value) => setForm((current) => (current ? { ...current, bio: value } : current))} multiline style={{ minHeight: 120, textAlignVertical: "top" }} />
      <Modal visible={showServiceAreaPicker} transparent animationType="fade" onRequestClose={() => setShowServiceAreaPicker(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(8,17,32,0.58)", justifyContent: "center", padding: 18 }}>
          <SurfaceCard style={{ maxHeight: "82%", gap: 14 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.colors.text, fontSize: 20, fontWeight: "900" }}>Select service areas</Text>
                <Text style={{ color: theme.colors.textMuted, marginTop: 4 }}>Only active admin-enabled areas are shown.</Text>
              </View>
              <Pressable onPress={() => setShowServiceAreaPicker(false)} style={{ width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.surfaceAlt }}>
                <Ionicons name="close-outline" size={22} color={theme.colors.text} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {coverageAreas.length ? (
                coverageAreas.map((area) => {
                  const active = form.serviceAreas.includes(area.name);
                  return (
                    <Pressable
                      key={area.id}
                      onPress={() => toggleServiceArea(area.name)}
                      style={{
                        borderRadius: 18,
                        padding: 14,
                        backgroundColor: active ? theme.colors.primarySoft : theme.colors.card,
                        borderWidth: 1,
                        borderColor: active ? theme.colors.primary : theme.colors.border,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 12
                      }}
                    >
                      <Ionicons name={active ? "checkmark-circle" : "ellipse-outline"} size={22} color={active ? theme.colors.primary : theme.colors.textMuted} />
                      <Text style={{ color: theme.colors.text, fontWeight: "800", flex: 1 }}>{area.name}</Text>
                    </Pressable>
                  );
                })
              ) : (
                <Text style={{ color: theme.colors.textMuted, textAlign: "center", paddingVertical: 18 }}>
                  No service areas are enabled by the admin right now.
                </Text>
              )}
            </ScrollView>
            <PrimaryButton label="Done" onPress={() => setShowServiceAreaPicker(false)} />
          </SurfaceCard>
        </View>
      </Modal>
    </FixedScreen>
  );
}
