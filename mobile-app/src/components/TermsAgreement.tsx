import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { KABISIG_TERMS_VERSION, kabisigTermsSections } from "@kabisig/shared";
import { theme } from "../theme";
import { SurfaceCard } from "./index";

function TermsBody() {
  return (
    <View style={{ gap: 16 }}>
      <View style={{ gap: 6 }}>
        <Text style={{ color: theme.colors.textMuted, fontWeight: "800" }}>Kabisig Terms and Agreement</Text>
        <Text style={{ color: theme.colors.textLight }}>Version {KABISIG_TERMS_VERSION}</Text>
      </View>
      {kabisigTermsSections.map((section) => (
        <View key={section.title} style={{ gap: 6 }}>
          <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: "900" }}>{section.title}</Text>
          <Text style={{ color: theme.colors.textMuted, lineHeight: 22 }}>{section.body}</Text>
        </View>
      ))}
    </View>
  );
}

export function TermsAgreementModal({
  visible,
  onAgree,
  onClose,
  title = "Terms and agreement",
  subtitle = "Please read the full agreement, scroll to the bottom, then check the confirmation box to continue.",
  agreeLabel = "Agree and continue",
  closeLabel = "Cancel"
}: {
  visible: boolean;
  onAgree: () => void;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  agreeLabel?: string;
  closeLabel?: string;
}) {
  const [scrolledToEnd, setScrolledToEnd] = useState(false);
  const [checked, setChecked] = useState(false);
  const canAgree = scrolledToEnd && checked;

  function resetAndClose() {
    setChecked(false);
    setScrolledToEnd(false);
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={resetAndClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(15,23,42,0.62)", alignItems: "center", justifyContent: "center", padding: 16 }}>
        <SurfaceCard style={{ width: "100%", maxWidth: 440, maxHeight: "92%", gap: 14 }}>
          <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
            <View style={{ width: 52, height: 52, borderRadius: 18, backgroundColor: theme.colors.primarySoft, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="shield-checkmark-outline" size={24} color={theme.colors.primaryDark} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.colors.text, fontSize: 22, fontWeight: "900" }}>{title}</Text>
              <Text style={{ color: theme.colors.textMuted, marginTop: 4, lineHeight: 20 }}>{subtitle}</Text>
            </View>
          </View>

          <ScrollView
            style={{ maxHeight: 390 }}
            showsVerticalScrollIndicator
            onScroll={({ nativeEvent }) => {
              const paddingToBottom = 24;
              const reachedEnd =
                nativeEvent.layoutMeasurement.height + nativeEvent.contentOffset.y >=
                nativeEvent.contentSize.height - paddingToBottom;
              if (reachedEnd) setScrolledToEnd(true);
            }}
            scrollEventThrottle={16}
            contentContainerStyle={{ paddingRight: 8, paddingBottom: 10 }}
          >
            <TermsBody />
          </ScrollView>

          <Pressable
            disabled={!scrolledToEnd}
            onPress={() => setChecked((current) => !current)}
            style={{
              flexDirection: "row",
              gap: 10,
              alignItems: "flex-start",
              opacity: scrolledToEnd ? 1 : 0.5
            }}
          >
            <Ionicons name={checked ? "checkbox" : "square-outline"} size={24} color={checked ? theme.colors.primary : theme.colors.textMuted} />
            <Text style={{ color: theme.colors.textMuted, flex: 1, lineHeight: 20 }}>
              I have scrolled through, read, understood, and agree to the Kabisig Terms and Agreement, including the collection and use of my account, booking, location, communication, payment, and support data for platform operations.
            </Text>
          </Pressable>

          {!scrolledToEnd ? (
            <Text style={{ color: theme.colors.primary, fontWeight: "800", textAlign: "center" }}>
              Scroll to the bottom to enable the agreement checkbox.
            </Text>
          ) : null}

          <View style={{ flexDirection: "row", gap: 10 }}>
            <Pressable onPress={resetAndClose} style={{ flex: 1, borderRadius: 18, paddingVertical: 14, alignItems: "center", backgroundColor: theme.colors.surfaceAlt }}>
              <Text style={{ color: theme.colors.text, fontWeight: "800" }}>{closeLabel}</Text>
            </Pressable>
            <Pressable
              disabled={!canAgree}
              onPress={() => {
                setChecked(false);
                setScrolledToEnd(false);
                onAgree();
              }}
              style={{ flex: 1, borderRadius: 18, paddingVertical: 14, alignItems: "center", backgroundColor: theme.colors.primary, opacity: canAgree ? 1 : 0.52 }}
            >
              <Text style={{ color: "#fff", fontWeight: "900" }}>{agreeLabel}</Text>
            </Pressable>
          </View>
        </SurfaceCard>
      </View>
    </Modal>
  );
}

export function TermsAgreementView() {
  const sectionCount = useMemo(() => kabisigTermsSections.length, []);

  return (
    <SurfaceCard style={{ gap: 16 }}>
      <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
        <View style={{ width: 52, height: 52, borderRadius: 18, backgroundColor: theme.colors.primarySoft, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="document-text-outline" size={24} color={theme.colors.primaryDark} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.colors.text, fontSize: 22, fontWeight: "900" }}>Terms and agreement</Text>
          <Text style={{ color: theme.colors.textMuted, marginTop: 4 }}>
            Version {KABISIG_TERMS_VERSION} | {sectionCount} sections
          </Text>
        </View>
      </View>
      <TermsBody />
    </SurfaceCard>
  );
}
