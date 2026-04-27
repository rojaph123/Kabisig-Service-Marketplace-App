import { useEffect, useState } from "react";
import { router } from "expo-router";
import { userService, type ProviderProfile } from "@kabisig/shared";
import { BackHeader, FeedbackBanner, FixedScreen, FormInput, FullScreenPopup, ImageUploadField, LoadingState, PrimaryButton } from "../src/components";
import { useAuth } from "../src/hooks/AuthProvider";

export default function ProviderBusinessProfileScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; title: string; message: string } | null>(null);
  const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);
  const [form, setForm] = useState<ProviderProfile | null>(null);

  useEffect(() => {
    async function load() {
      if (!user) return;
      setForm(await userService.getProviderProfile(user.id));
      setLoading(false);
    }

    void load();
  }, [user]);

  async function handleSave() {
    if (!user || !form) return;
    if (!form.displayName.trim() || !form.phone.trim() || !form.city.trim() || !form.address.trim()) {
      setFeedback({
        type: "error",
        title: "Missing details",
        message: "Display name, phone, address, and city are required."
      });
      return;
    }

    setSaving(true);
    try {
      await userService.updateProviderProfile(user.id, form);
      await userService.updateUserDocument(user.id, {
        fullName: form.displayName,
        profilePhoto: form.profilePhotoUrl || ""
      });
      setFeedback({
        type: "success",
        title: "Business profile updated",
        message: "Your provider details were saved successfully."
      });
      setShowSuccessOverlay(true);
      setTimeout(() => setShowSuccessOverlay(false), 1000);
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
      <ImageUploadField label="Profile photo" value={form.profilePhotoUrl} onChange={(value) => setForm((current) => (current ? { ...current, profilePhotoUrl: value } : current))} />
      <FormInput label="Display name" value={form.displayName} onChangeText={(value) => setForm((current) => (current ? { ...current, displayName: value } : current))} />
      <FormInput label="Business name" value={form.businessName} onChangeText={(value) => setForm((current) => (current ? { ...current, businessName: value } : current))} />
      <FormInput label="Phone number" value={form.phone} onChangeText={(value) => setForm((current) => (current ? { ...current, phone: value } : current))} />
      <FormInput label="Address" value={form.address} onChangeText={(value) => setForm((current) => (current ? { ...current, address: value } : current))} />
      <FormInput label="City" value={form.city} onChangeText={(value) => setForm((current) => (current ? { ...current, city: value } : current))} />
      <FormInput
        label="Service areas"
        value={form.serviceAreas.join(", ")}
        onChangeText={(value) => setForm((current) => (current ? { ...current, serviceAreas: value.split(",").map((item) => item.trim()).filter(Boolean) } : current))}
      />
      <FormInput
        label="Service categories"
        value={form.serviceCategories.join(", ")}
        onChangeText={(value) => setForm((current) => (current ? { ...current, serviceCategories: value.split(",").map((item) => item.trim()).filter(Boolean) } : current))}
      />
      <FormInput label="Years of experience" value={String(form.yearsExperience || 0)} keyboardType="numeric" onChangeText={(value) => setForm((current) => (current ? { ...current, yearsExperience: Number(value) || 0 } : current))} />
      <FormInput label="Starting rate" value={String(form.hourlyRate || 0)} keyboardType="numeric" onChangeText={(value) => setForm((current) => (current ? { ...current, hourlyRate: Number(value) || 0 } : current))} />
      <FormInput label="Professional bio" value={form.bio} onChangeText={(value) => setForm((current) => (current ? { ...current, bio: value } : current))} multiline style={{ minHeight: 120, textAlignVertical: "top" }} />
    </FixedScreen>
  );
}
