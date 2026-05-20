import { useCallback, useEffect, useState } from "react";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image, Pressable, Text, View } from "react-native";
import { providerPortfolioService, userService, type ProviderPortfolioItem, type ProviderProfile } from "@kabisig/shared";
import {
  BackHeader,
  FeedbackBanner,
  FixedScreen,
  FormInput,
  FullScreenPopup,
  ImageUploadField,
  LoadingState,
  MediaPreviewModal,
  PrimaryButton,
  SurfaceCard,
} from "../src/components";
import { useAuth } from "../src/hooks/AuthProvider";
import { theme } from "../src/theme";
import { readableAppError } from "../src/utils/errors";

const MAX_PORTFOLIO_PHOTO_MB = 20;

export default function ProviderPortfolioScreen() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProviderProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [beforePhoto, setBeforePhoto] = useState("");
  const [afterPhoto, setAfterPhoto] = useState("");
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error" | "info"; title: string; message: string } | null>(null);

  const loadProfile = useCallback(async () => {
    if (!user) return;
    setProfile(await userService.getProviderProfile(user.id));
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  async function handleAddPortfolioItem() {
    if (!user || saving) return;
    if (!title.trim() || !beforePhoto || !afterPhoto) {
      setFeedback({
        type: "error",
        title: "Portfolio details needed",
        message: "Add a title plus one before photo and one after photo."
      });
      return;
    }

    setSaving(true);
    try {
      await providerPortfolioService.addPortfolioItem(user.id, {
        title,
        description,
        beforePhoto,
        afterPhoto,
      });
      setTitle("");
      setDescription("");
      setBeforePhoto("");
      setAfterPhoto("");
      await loadProfile();
      setFeedback({
        type: "success",
        title: "Portfolio added",
        message: "Customers can now see this before and after work on your public profile."
      });
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 1000);
    } catch (error) {
      console.error(error);
      setFeedback({
        type: "error",
        title: "Upload failed",
        message: readableAppError(error, "We could not save this portfolio item right now.")
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item: ProviderPortfolioItem) {
    if (!user || deletingId) return;
    setDeletingId(item.portfolioItemId);
    try {
      await providerPortfolioService.deletePortfolioItem(user.id, item.portfolioItemId);
      await loadProfile();
      setFeedback({
        type: "success",
        title: "Portfolio deleted",
        message: "The portfolio item and its stored photos were removed."
      });
    } catch (error) {
      console.error(error);
      setFeedback({
        type: "error",
        title: "Delete failed",
        message: "We could not delete this portfolio item right now."
      });
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return (
      <FixedScreen header={<BackHeader title="Portfolio" onBack={() => router.back()} />}>
        <LoadingState label="Loading portfolio..." />
      </FixedScreen>
    );
  }

  const portfolio = profile?.portfolio ?? [];

  return (
    <FixedScreen
      header={
        <>
          <BackHeader title="Portfolio" onBack={() => router.back()} />
          {feedback ? <FeedbackBanner type={feedback.type} title={feedback.title} message={feedback.message} /> : null}
          <FullScreenPopup visible={showSuccess} title="Portfolio added" message="Your before and after photos are ready for customers." />
        </>
      }
      footer={
        <PrimaryButton
          label={saving ? "Uploading..." : "Add to portfolio"}
          icon="images-outline"
          onPress={() => void handleAddPortfolioItem()}
          disabled={saving}
        />
      }
    >
      <MediaPreviewModal visible={!!previewUri} uri={previewUri} title="Portfolio Photo" onClose={() => setPreviewUri(null)} />

      <SurfaceCard style={{ backgroundColor: theme.colors.surfaceAlt }}>
        <Text style={{ color: theme.colors.text, fontSize: 18, fontWeight: "900" }}>Before and after work</Text>
        <Text style={{ color: theme.colors.textMuted, lineHeight: 20, marginTop: 6 }}>
          Upload real project photos to help customers trust your repairs, carpentry, tile work, welding, cleaning, or other field work.
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 }}>
          <Ionicons name="cloud-upload-outline" size={18} color={theme.colors.primaryDark} />
          <Text style={{ color: theme.colors.text, fontWeight: "800", flex: 1 }}>
            Each photo must be {MAX_PORTFOLIO_PHOTO_MB} MB or smaller.
          </Text>
        </View>
      </SurfaceCard>

      <SurfaceCard>
        <Text style={{ color: theme.colors.text, fontSize: 18, fontWeight: "900" }}>Add a completed work sample</Text>
        <FormInput label="Project title" value={title} onChangeText={setTitle} placeholder="Example: Aircon cleaning and coil repair" />
        <FormInput
          label="Short description"
          value={description}
          onChangeText={setDescription}
          multiline
          placeholder="What changed after the work?"
          style={{ minHeight: 90, textAlignVertical: "top" }}
        />
        <ImageUploadField
          label="Before photo"
          value={beforePhoto}
          onChange={setBeforePhoto}
          maxSizeMb={MAX_PORTFOLIO_PHOTO_MB}
          onError={(message) => setFeedback({ type: "error", title: "Upload too large", message })}
          helper="Show the issue before work started. Photos only."
        />
        <ImageUploadField
          label="After photo"
          value={afterPhoto}
          onChange={setAfterPhoto}
          maxSizeMb={MAX_PORTFOLIO_PHOTO_MB}
          onError={(message) => setFeedback({ type: "error", title: "Upload too large", message })}
          helper="Show the finished result. Photos only."
        />
      </SurfaceCard>

      <SurfaceCard>
        <Text style={{ color: theme.colors.text, fontSize: 18, fontWeight: "900" }}>Published portfolio</Text>
        <Text style={{ color: theme.colors.textMuted, marginTop: 4 }}>
          {portfolio.length ? `${portfolio.length} portfolio item${portfolio.length === 1 ? "" : "s"} visible to customers.` : "No portfolio items yet."}
        </Text>

        <View style={{ gap: 14, marginTop: 14 }}>
          {portfolio.map((item) => (
            <View key={item.portfolioItemId} style={{ borderRadius: 18, padding: 12, backgroundColor: theme.colors.surfaceAlt, gap: 10 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.colors.text, fontWeight: "900" }}>{item.title}</Text>
                  {item.description ? <Text style={{ color: theme.colors.textMuted, marginTop: 4, lineHeight: 19 }}>{item.description}</Text> : null}
                </View>
                <Pressable
                  onPress={() => void handleDelete(item)}
                  disabled={deletingId === item.portfolioItemId}
                  style={{ borderRadius: 14, padding: 10, backgroundColor: theme.colors.dangerSoft }}
                >
                  <Ionicons name="trash-outline" size={18} color={theme.colors.danger} />
                </Pressable>
              </View>
              <View style={{ flexDirection: "row", gap: 10 }}>
                {[
                  { label: "Before", uri: item.beforePhoto.url },
                  { label: "After", uri: item.afterPhoto.url },
                ].map((photo) => (
                  <Pressable key={`${item.portfolioItemId}-${photo.label}`} onPress={() => setPreviewUri(photo.uri)} style={{ flex: 1, gap: 6 }}>
                    <Image source={{ uri: photo.uri }} style={{ width: "100%", aspectRatio: 1, borderRadius: 16, backgroundColor: theme.colors.card }} resizeMode="cover" />
                    <Text style={{ color: theme.colors.textMuted, fontSize: 12, fontWeight: "800", textAlign: "center" }}>{photo.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
        </View>
      </SurfaceCard>
    </FixedScreen>
  );
}
