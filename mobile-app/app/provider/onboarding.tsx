import { router } from "expo-router";
import { type ChangeEvent, type CSSProperties, useEffect, useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Image, Linking, Modal, Platform, Pressable, ScrollView, Text, TextInput, type TextInputProps, View } from "react-native";
import { categoryService, coverageAreaService, kabisigWorkerAgreementSections, mediaService, providerService, userService, workerPaymentService, type AvailabilitySchedule, type CoverageArea, type ProviderApprovalStatus, type ProviderProfile, type ServiceCategory, type WorkerPaymentSettings } from "@kabisig/shared";
import {
  FeedbackBanner,
  DateSelectField,
  FixedScreen,
  FullScreenPopup,
  ImageUploadField,
  LoadingState,
  MultiMediaPickerField,
  PrimaryButton,
  AppHeader,
  SurfaceCard
} from "../../src/components";
import { useAuth } from "../../src/hooks/AuthProvider";
import { theme } from "../../src/theme";

function formatAgeFromBirthday(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const today = new Date();
  let age = today.getFullYear() - parsed.getFullYear();
  const monthDiff = today.getMonth() - parsed.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < parsed.getDate())) age -= 1;
  return age > 0 ? String(age) : "";
}

const defaultAvailability: AvailabilitySchedule[] = [
  { day: "Mon", start: "07:00", end: "19:00", available: false },
  { day: "Tue", start: "07:00", end: "19:00", available: false },
  { day: "Wed", start: "07:00", end: "19:00", available: false },
  { day: "Thu", start: "07:00", end: "19:00", available: false },
  { day: "Fri", start: "07:00", end: "19:00", available: false },
  { day: "Sat", start: "07:00", end: "19:00", available: false },
  { day: "Sun", start: "07:00", end: "19:00", available: false }
];

const startSlots = ["07:00", "08:00", "09:00", "10:00", "11:00", "12:00"];
const endSlots = ["13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00"];
const experienceOptions = Array.from({ length: 41 }, (_, index) => String(index));
const monthOptions = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function cleanPrefill(value?: string | null) {
  return typeof value === "string" ? value.trim() : "";
}

function shortCategoryDescription(value?: string) {
  const text = cleanPrefill(value);
  if (!text) return "Tap to select this service.";
  return text.length > 46 ? `${text.slice(0, 43).trim()}...` : text;
}

function formatTimeLabel(value: string) {
  const [rawHour, rawMinute] = value.split(":").map(Number);
  const suffix = rawHour >= 12 ? "pm" : "am";
  const hour = ((rawHour + 11) % 12) + 1;
  return `${hour}:${(rawMinute || 0).toString().padStart(2, "0")}${suffix}`;
}

function SectionHeader({ icon, title, subtitle }: { icon: keyof typeof Ionicons.glyphMap; title: string; subtitle: string }) {
  return (
    <View style={{ flexDirection: "row", gap: 8, alignItems: "center", marginBottom: 4 }}>
      <View style={{ width: 30, height: 30, borderRadius: 12, backgroundColor: theme.colors.primarySoft, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={icon} size={16} color={theme.colors.primaryDark} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: theme.colors.text, fontSize: 15, lineHeight: 18, fontWeight: "900" }}>{title}</Text>
        <Text style={{ color: theme.colors.textMuted, lineHeight: 15, fontSize: 11 }}>{subtitle}</Text>
      </View>
    </View>
  );
}

const sectionCardStyle = { gap: 6, padding: 10 };
const fieldStackStyle = { gap: 6 };
const onboardingStepKeys = ["identity", "services", "verification", "payment", "schedule"] as const;
function OnboardingField({
  label,
  required,
  error,
  style,
  autoCorrect,
  multiline,
  onChangeText,
  value,
  editable,
  placeholder,
  keyboardType,
  ...inputProps
}: TextInputProps & { label: string; required?: boolean; error?: boolean }) {
  const inputHeight = multiline ? 62 : 40;
  const labelNode = (
    <Text style={{ color: theme.colors.text, fontSize: 11, lineHeight: 13, fontWeight: "800" }}>
      {label}
      {required ? <Text style={{ color: theme.colors.danger }}> *</Text> : null}
    </Text>
  );

  if (Platform.OS === "web") {
    const webLabelStyle: CSSProperties = {
      color: theme.colors.text,
      display: "block",
      fontFamily: theme.typography.fontFamily,
      fontSize: 11,
      fontWeight: 800,
      lineHeight: "13px",
      margin: 0
    };
    const webInputStyle: CSSProperties = {
      width: "100%",
      height: inputHeight,
      minHeight: inputHeight,
      maxHeight: inputHeight,
      borderRadius: 12,
      borderWidth: 1,
      borderStyle: "solid",
      borderColor: error ? theme.colors.danger : theme.colors.border,
      backgroundColor: theme.colors.card,
      color: theme.colors.text,
      padding: multiline ? "8px 12px" : "7px 12px",
      fontFamily: theme.typography.fontFamily,
      fontSize: 13,
      lineHeight: "16px",
      boxSizing: "border-box",
      outline: "none",
      resize: "none",
      display: "block"
    };
    const webValue = typeof value === "string" ? value : value == null ? "" : String(value);
    const webDisabled = editable === false;
    const webType = keyboardType === "email-address" ? "email" : keyboardType === "phone-pad" ? "tel" : keyboardType === "numeric" ? "number" : "text";

    return (
      <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 4, flex: "0 0 auto" }}>
        <label style={webLabelStyle}>
          {label}
          {required ? <span style={{ color: theme.colors.danger }}> *</span> : null}
        </label>
        {multiline ? (
          <textarea
            value={webValue}
            disabled={webDisabled}
            placeholder={placeholder}
            autoCorrect={autoCorrect === false ? "off" : undefined}
            style={webInputStyle}
            onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onChangeText?.(event.currentTarget.value)}
          />
        ) : (
          <input
            value={webValue}
            disabled={webDisabled}
            placeholder={placeholder}
            type={webType}
            autoCorrect={autoCorrect === false ? "off" : undefined}
            style={webInputStyle}
            onChange={(event: ChangeEvent<HTMLInputElement>) => onChangeText?.(event.currentTarget.value)}
          />
        )}
      </div>
    );
  }

  return (
    <View style={{ width: "100%", gap: 4, flexGrow: 0, flexShrink: 0 }}>
      {labelNode}
      <TextInput
        {...inputProps}
        value={value}
        editable={editable}
        placeholder={placeholder}
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        multiline={multiline}
        autoCorrect={autoCorrect ?? false}
        placeholderTextColor={theme.colors.textLight}
        style={[
          {
            height: inputHeight,
            minHeight: inputHeight,
            maxHeight: inputHeight,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: error ? theme.colors.danger : theme.colors.border,
            backgroundColor: theme.colors.card,
            color: theme.colors.text,
            paddingHorizontal: 12,
            paddingVertical: multiline ? 8 : 7,
            fontSize: 13,
            lineHeight: 16,
            flexGrow: 0,
            flexShrink: 0,
            ...(Platform.OS === "web" ? ({ boxSizing: "border-box", outlineStyle: "none", resize: "none" } as object) : null)
          },
          style
        ]}
      />
    </View>
  );
}

function BirthdayField({
  value,
  required,
  error,
  onChange,
  onOpenNativePicker
}: {
  value: string;
  required?: boolean;
  error?: boolean;
  onChange: (value: string) => void;
  onOpenNativePicker: () => void;
}) {
  if (Platform.OS === "web") {
    return (
      <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 4, flex: "0 0 auto" }}>
        <label style={{ color: theme.colors.text, display: "block", fontFamily: theme.typography.fontFamily, fontSize: 11, fontWeight: 800, lineHeight: "13px", margin: 0 }}>
          Birthday
          {required ? <span style={{ color: theme.colors.danger }}> *</span> : null}
        </label>
        <button
          type="button"
          onClick={onOpenNativePicker}
          style={{
            width: "100%",
            height: 40,
            borderRadius: 12,
            borderWidth: 1,
            borderStyle: "solid",
            borderColor: error ? theme.colors.danger : theme.colors.border,
            backgroundColor: theme.colors.card,
            color: value ? theme.colors.text : theme.colors.textLight,
            cursor: "pointer",
            fontFamily: theme.typography.fontFamily,
            fontSize: 13,
            fontWeight: 700,
            lineHeight: "16px",
            padding: "7px 12px",
            boxSizing: "border-box",
            outline: "none",
            display: "block",
            textAlign: "left"
          }}
        >
          {value || "Select your birthday"}
        </button>
      </div>
    );
  }

  return (
    <View style={{ flex: 1, gap: 4 }}>
      <Text style={{ color: theme.colors.text, fontSize: 11, lineHeight: 13, fontWeight: "800" }}>
        Birthday
        {required ? <Text style={{ color: theme.colors.danger }}> *</Text> : null}
      </Text>
      <Pressable
        onPress={onOpenNativePicker}
        style={{
          minHeight: 40,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: error ? theme.colors.danger : theme.colors.border,
          paddingHorizontal: 12,
          paddingVertical: 8,
          backgroundColor: theme.colors.card,
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center"
        }}
      >
        <Text style={{ color: value ? theme.colors.text : theme.colors.textMuted }}>{value || "Select your birthday"}</Text>
        <Ionicons name="calendar-outline" size={18} color={theme.colors.primaryDark} />
      </Pressable>
    </View>
  );
}

function OnboardingImageUploadField({
  label,
  value,
  onChange,
  helper,
  required,
  error,
  maxSizeMb,
  onError,
  uploading
}: {
  label: string;
  value?: string;
  onChange: (value: string) => void;
  helper?: string;
  required?: boolean;
  error?: boolean;
  maxSizeMb?: number;
  onError?: (message: string) => void;
  uploading?: boolean;
}) {
  if (Platform.OS !== "web") {
    return <ImageUploadField label={label} value={value} onChange={onChange} helper={helper} required={required} error={error} maxSizeMb={maxSizeMb} onError={onError} compact />;
  }

  const maxBytes = (maxSizeMb || 5) * 1024 * 1024;
  const openPicker = () => {
    if (typeof document === "undefined") return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/jpeg,image/jpg,image/png,image/webp,image/*";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      if (file.size > maxBytes) {
        onError?.(`Please upload a file smaller than ${maxSizeMb || 5} MB.`);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") onChange(reader.result);
      };
      reader.onerror = () => onError?.("This file could not be prepared. Please choose another image.");
      reader.readAsDataURL(file);
    };
    input.click();
  };

  return (
    <div style={{ border: `1px solid ${error ? theme.colors.danger : theme.colors.border}`, borderRadius: 14, padding: 12, background: theme.colors.card, display: "flex", flexDirection: "column", gap: 9 }}>
      <label style={{ color: theme.colors.text, fontFamily: theme.typography.fontFamily, fontSize: 12, fontWeight: 800, lineHeight: "16px" }}>
        {label}
        {required ? <span style={{ color: theme.colors.danger }}> *</span> : null}
      </label>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <div style={{ width: 46, height: 46, borderRadius: 13, background: theme.colors.primarySoft, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto", position: "relative" }}>
          {value ? <img src={value} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Ionicons name="camera-outline" size={19} color={theme.colors.primaryDark} />}
          {uploading ? (
            <div style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,0.78)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: 22, height: 22, borderRadius: 999, border: `3px solid ${theme.colors.primarySoft}`, borderTopColor: theme.colors.primary }} />
            </div>
          ) : null}
        </div>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          <p style={{ margin: 0, color: theme.colors.textMuted, fontFamily: theme.typography.fontFamily, fontSize: 12, lineHeight: "16px" }}>
            {helper || "Upload a clear image from this device."}
          </p>
          {uploading ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 16, height: 16, borderRadius: 999, border: `2px solid ${theme.colors.primarySoft}`, borderTopColor: theme.colors.primary }} />
              <span style={{ color: theme.colors.primaryDark, fontFamily: theme.typography.fontFamily, fontSize: 12, fontWeight: 800 }}>Uploading...</span>
            </div>
          ) : null}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" disabled={uploading} onClick={openPicker} style={{ border: 0, borderRadius: 12, background: theme.colors.primary, color: theme.colors.textOnPrimary, cursor: uploading ? "not-allowed" : "pointer", fontFamily: theme.typography.fontFamily, fontSize: 12, fontWeight: 800, opacity: uploading ? 0.58 : 1, padding: "9px 12px" }}>
              {uploading ? "Uploading..." : value ? "Change photo" : "Upload photo"}
            </button>
            {value ? (
              <button type="button" disabled={uploading} onClick={() => onChange("")} style={{ border: `1px solid ${theme.colors.danger}`, borderRadius: 12, background: theme.colors.dangerSoft, color: theme.colors.danger, cursor: uploading ? "not-allowed" : "pointer", fontFamily: theme.typography.fontFamily, fontSize: 12, fontWeight: 800, opacity: uploading ? 0.58 : 1, padding: "8px 11px" }}>
                Remove
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function OnboardingMediaUploadField({
  label,
  values,
  onChange,
  helper,
  required,
  error,
  maxSizeMb,
  onError,
  uploading
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  helper?: string;
  required?: boolean;
  error?: boolean;
  maxSizeMb?: number;
  onError?: (message: string) => void;
  uploading?: boolean;
}) {
  if (Platform.OS !== "web") {
    return <MultiMediaPickerField label={label} values={values} onChange={onChange} helper={helper} required={required} error={error} maxSizeMb={maxSizeMb} onError={onError} />;
  }

  const maxBytes = (maxSizeMb || 8) * 1024 * 1024;
  const openPicker = () => {
    if (typeof document === "undefined") return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*,video/*";
    input.multiple = true;
    input.onchange = () => {
      const files = Array.from(input.files || []);
      if (!files.length) return;
      if (files.some((file) => file.size > maxBytes)) {
        onError?.(`One or more files are larger than ${maxSizeMb || 8} MB.`);
        return;
      }
      Promise.all(
        files.map(
          (file) =>
            new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
              reader.onerror = () => resolve("");
              reader.readAsDataURL(file);
            })
        )
      ).then((nextValues) => onChange([...values, ...nextValues.filter(Boolean)]));
    };
    input.click();
  };

  return (
    <div style={{ border: `1px solid ${error ? theme.colors.danger : theme.colors.border}`, borderRadius: 14, padding: 12, background: theme.colors.card, display: "flex", flexDirection: "column", gap: 8 }}>
      <label style={{ color: theme.colors.text, fontFamily: theme.typography.fontFamily, fontSize: 12, fontWeight: 800, lineHeight: "16px" }}>
        {label}
        {required ? <span style={{ color: theme.colors.danger }}> *</span> : null}
      </label>
      <p style={{ margin: 0, color: theme.colors.textMuted, fontFamily: theme.typography.fontFamily, fontSize: 12, lineHeight: "16px" }}>
        {helper || "Upload one or more photos or videos from this device."}
      </p>
      {values.length ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {values.map((uri, index) => (
            <div key={`${uri}-${index}`} style={{ width: 56, display: "flex", flexDirection: "column", gap: 4 }}>
              <img src={uri} alt="" style={{ width: 56, height: 56, borderRadius: 12, objectFit: "cover", background: theme.colors.surfaceAlt }} />
              <button type="button" onClick={() => onChange(values.filter((_, itemIndex) => itemIndex !== index))} style={{ border: 0, background: "transparent", color: theme.colors.danger, cursor: "pointer", fontSize: 11, fontWeight: 800, padding: 0 }}>
                Remove
              </button>
            </div>
          ))}
        </div>
      ) : null}
      {uploading ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 16, height: 16, borderRadius: 999, border: `2px solid ${theme.colors.primarySoft}`, borderTopColor: theme.colors.primary }} />
          <span style={{ color: theme.colors.primaryDark, fontFamily: theme.typography.fontFamily, fontSize: 12, fontWeight: 800 }}>Uploading...</span>
        </div>
      ) : null}
      <button type="button" disabled={uploading} onClick={openPicker} style={{ alignSelf: "flex-start", border: 0, borderRadius: 12, background: theme.colors.primary, color: theme.colors.textOnPrimary, cursor: uploading ? "not-allowed" : "pointer", fontFamily: theme.typography.fontFamily, fontSize: 12, fontWeight: 800, opacity: uploading ? 0.58 : 1, padding: "9px 12px" }}>
        {uploading ? "Uploading..." : values.length ? "Add more" : "Upload files"}
      </button>
    </div>
  );
}

function parseBirthdayDate(value: string) {
  if (!value) return null;
  const parts = value.split("-").map(Number);
  if (parts.length !== 3 || parts.some((item) => Number.isNaN(item))) return null;
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function toBirthdayValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function monthDays(cursor: Date) {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const leading = (firstDay + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];

  for (let i = 0; i < leading; i += 1) {
    cells.push(null);
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(year, month, day));
  }
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }
  return cells;
}

export default function ProviderOnboardingScreen() {
  const { signOut, submitProviderOnboarding, user } = useAuth();
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [coverageAreas, setCoverageAreas] = useState<CoverageArea[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<Record<string, boolean>>({});
  const [fullName, setFullName] = useState(user?.fullName || "");
  const [businessName, setBusinessName] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [birthday, setBirthday] = useState("");
  const [age, setAge] = useState("");
  const [address, setAddress] = useState("");
  const [coverage, setCoverage] = useState("");
  const [selectedCoverageAreas, setSelectedCoverageAreas] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [experience, setExperience] = useState("");
  const [bio, setBio] = useState("");
  const [qualifications, setQualifications] = useState("");
  const [additionalDetails, setAdditionalDetails] = useState("");
  const [contact, setContact] = useState("");
  const [profilePhoto, setProfilePhoto] = useState("");
  const [validId, setValidId] = useState("");
  const [permitCertificate, setPermitCertificate] = useState("");
  const [sampleWorks, setSampleWorks] = useState<string[]>([]);
  const [paymentSettings, setPaymentSettings] = useState<WorkerPaymentSettings | null>(null);
  const [registrationProof, setRegistrationProof] = useState("");
  const [registrationReference, setRegistrationReference] = useState("");
  const [registrationPaymentDate, setRegistrationPaymentDate] = useState("");
  const [registrationMethod, setRegistrationMethod] = useState("");
  const [feedback, setFeedback] = useState<{ type: "success" | "error" | "info"; title: string; message: string } | null>(null);
  const [popup, setPopup] = useState<{ tone: "success" | "error" | "info"; title: string; message: string } | null>(null);
  const [showTerms, setShowTerms] = useState(true);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [hydrating, setHydrating] = useState(true);
  const [availability, setAvailability] = useState<AvailabilitySchedule[]>(defaultAvailability);
  const [selectedDay, setSelectedDay] = useState("Mon");
  const [applicationStatus, setApplicationStatus] = useState<ProviderApprovalStatus>("Draft");
  const [reviewNotes, setReviewNotes] = useState("");
  const [showBirthdayModal, setShowBirthdayModal] = useState(false);
  const [showCancelRegistration, setShowCancelRegistration] = useState(false);
  const [onboardingStepIndex, setOnboardingStepIndex] = useState(0);
  const [birthdayCursor, setBirthdayCursor] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear() - 25, today.getMonth(), 1);
  });

  useEffect(() => {
    async function loadCategories() {
      if (!user) {
        setHydrating(false);
        setLoadingCategories(false);
        return;
      }

      try {
        const [itemsResult, coverageAreasResult, profileResult, latestApplicationResult, paymentSettingsResult] = await Promise.allSettled([
          categoryService.getAllCategories(),
          coverageAreaService.getAllCoverageAreas(),
          userService.getProviderProfile(user.id),
          providerService.getLatestApplicationByUser(user.id),
          workerPaymentService.getSettings()
        ]);
        const items = itemsResult.status === "fulfilled" ? itemsResult.value : [];
        const nextCoverageAreas = coverageAreasResult.status === "fulfilled" ? coverageAreasResult.value : [];
        const profile = profileResult.status === "fulfilled" ? profileResult.value : null;
        const latestApplication = latestApplicationResult.status === "fulfilled" ? latestApplicationResult.value : null;
        const settings = paymentSettingsResult.status === "fulfilled" ? paymentSettingsResult.value : null;

        setCategories(items);
        setCoverageAreas(nextCoverageAreas);
        setPaymentSettings(settings);
        setRegistrationMethod(settings?.paymentMethodName || "GCash QR");

        if (itemsResult.status === "rejected") {
          setPopup({
            tone: "error",
            title: "Service categories unavailable",
            message: "The service categories could not be loaded right now. Please refresh the screen and try again."
          });
        }

        if ((profile as (ProviderProfile & { termsAcceptedAt?: string }) | null)?.termsAcceptedAt) {
          setTermsAccepted(true);
          setShowTerms(false);
        }
        if (profile) {
          const nextStatus = (profile.approvalStatus || "Draft") as ProviderApprovalStatus;
          setApplicationStatus(nextStatus);
          if (nextStatus === "Approved") {
            router.replace("/(tabs)/home");
            return;
          }
          if (nextStatus === "Pending Approval" || nextStatus === "Rejected") {
            router.replace("/provider/pending");
            return;
          }

          const registeredName = cleanPrefill(user.fullName);
          const profileName = cleanPrefill(profile.displayName);
          const nextName = profileName || registeredName;
          setFullName(nextName);
          setBusinessName(cleanPrefill(profile.businessName) || nextName);
          setMobileNumber(cleanPrefill(profile.phone) || cleanPrefill(user.phone));
          setBirthday(profile.birthday || "");
          if (profile.birthday) {
            const nextBirthday = parseBirthdayDate(profile.birthday);
            if (nextBirthday) {
              setBirthdayCursor(new Date(nextBirthday.getFullYear(), nextBirthday.getMonth(), 1));
            }
          }
          setAge(profile.age ? String(profile.age) : "");
          setAddress(profile.address || "");
          const nextCoverageAreas = profile.serviceAreas?.length
            ? profile.serviceAreas
            : profile.city
              ? profile.city.split(",").map((item) => item.trim()).filter(Boolean)
              : [];
          setSelectedCoverageAreas(nextCoverageAreas);
          setCoverage(nextCoverageAreas.join(", "));
          setSelectedCategories(profile.serviceCategories || []);
          setExperience(profile.yearsExperience ? String(profile.yearsExperience) : "");
          setBio(profile.bio || "");
          setQualifications(profile.qualifications || "");
          setAdditionalDetails(profile.additionalDetails || "");
          setContact(profile.emergencyContact || "");
          setProfilePhoto(profile.profilePhotoUrl || "");
          setValidId(profile.validIdUrl || "");
          setPermitCertificate(profile.permitCertificateUrl || "");
          setSampleWorks(profile.sampleWorks?.map((item) => item.url) || profile.sampleWorkUrls || []);
          setAvailability(profile.availability?.length ? profile.availability : defaultAvailability);
          if (profile.availability?.[0]?.day) {
            setSelectedDay(profile.availability[0].day);
          }
        }
        if (latestApplication?.reviewNotes) {
          setReviewNotes(latestApplication.reviewNotes);
        }
      } finally {
        setLoadingCategories(false);
        setHydrating(false);
      }
    }

    void loadCategories();
  }, [user]);

  useEffect(() => {
    if (!user?.id || hydrating) {
      return;
    }
    if (applicationStatus !== "Draft" && applicationStatus !== "Revision Requested") {
      return;
    }

    const timeoutId = setTimeout(() => {
      void userService.updateProviderProfile(user.id, {
        displayName: fullName,
        businessName,
        phone: mobileNumber,
        birthday,
        age: Number(age) || 0,
        address,
        city: coverage,
        serviceAreas: selectedCoverageAreas,
        serviceCategories: selectedCategories,
        yearsExperience: Number(experience) || 0,
        bio,
        qualifications,
        additionalDetails,
        emergencyContact: contact,
        availability
      }).catch(() => undefined);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [
    address,
    age,
    applicationStatus,
    availability,
    bio,
    birthday,
    businessName,
    contact,
    coverage,
    experience,
    fullName,
    hydrating,
    mobileNumber,
    qualifications,
    selectedCategories,
    selectedCoverageAreas,
    user?.id,
    additionalDetails
  ]);

  const registrationPromoFree = Boolean(
    paymentSettings?.freeRegistrationPromoEnabled === true &&
    paymentSettings.approvedFreeRegistrationCount < paymentSettings.freeRegistrationApprovedWorkerLimit
  );
  const registrationPaymentRequired = paymentSettings ? Boolean(paymentSettings.registrationFeeEnabled === true && !registrationPromoFree) : true;
  const registrationFeeAmount = registrationPaymentRequired
    ? (Number(paymentSettings?.registrationFeeAmount) > 0 ? Number(paymentSettings?.registrationFeeAmount) : 500)
    : 0;
  const onboardingSteps = useMemo(
    () => [
      { key: "identity", title: "Identity", subtitle: "Public profile details" },
      { key: "services", title: "Services", subtitle: "Categories and qualifications" },
      { key: "verification", title: "Verification", subtitle: "Documents and emergency contact" },
      { key: "payment", title: registrationPaymentRequired ? "Payment" : "Registration free", subtitle: registrationPaymentRequired ? "QR and proof upload" : "No fee required" },
      { key: "schedule", title: "Schedule", subtitle: "Working days and time" }
    ],
    [registrationPaymentRequired]
  );
  const activeStep = onboardingSteps[onboardingStepIndex] || onboardingSteps[0];
  const activeStepKey = onboardingStepKeys[onboardingStepIndex] || "identity";
  const isLastOnboardingStep = onboardingStepIndex === onboardingSteps.length - 1;

  const requiredFields = useMemo(
    () => ({
      fullName: !fullName.trim(),
      businessName: !businessName.trim(),
      mobileNumber: !mobileNumber.trim(),
      birthday: !birthday.trim(),
      age: !age.trim(),
      address: !address.trim(),
      coverage: !selectedCoverageAreas.length,
      selectedCategories: !selectedCategories.length,
      experience: !experience.trim(),
      qualifications: !qualifications.trim(),
      additionalDetails: !additionalDetails.trim(),
      bio: !bio.trim(),
      profilePhoto: !profilePhoto,
      validId: !validId,
      contact: !contact.trim()
      ,
      availability: !availability.some((slot) => slot.available),
      registrationProof: registrationPaymentRequired && !registrationProof,
      registrationReference: registrationPaymentRequired && !registrationReference.trim(),
      registrationPaymentDate: registrationPaymentRequired && !registrationPaymentDate.trim()
    }),
    [additionalDetails, address, age, availability, bio, birthday, businessName, contact, experience, fullName, mobileNumber, profilePhoto, qualifications, registrationPaymentDate, registrationPaymentRequired, registrationProof, registrationReference, selectedCategories, selectedCoverageAreas, validId]
  );

  const hasMissingRequirements = Object.values(requiredFields).some(Boolean);
  const hasUploadsInProgress = Object.values(uploadingFiles).some(Boolean);

  function setUploading(key: string, uploading: boolean) {
    setUploadingFiles((current) => ({ ...current, [key]: uploading }));
  }

  async function preUploadSingle(key: string, value: string, path: string, fileName: string, setter: (value: string) => void) {
    setter(value);
    if (!user?.id || !value || !value.startsWith("data:")) return;

    setUploading(key, true);
    try {
      const uploaded = await mediaService.uploadMedia(value, path, fileName, user.id);
      setter(uploaded.url);
    } catch (error) {
      console.warn(`Pre-upload failed for ${key}:`, error);
      setPopup({
        tone: "error",
        title: "Upload failed",
        message: error instanceof Error ? error.message : "This file could not be uploaded. Please choose it again."
      });
      setter("");
    } finally {
      setUploading(key, false);
    }
  }

  async function preUploadPaymentProof(value: string) {
    setRegistrationProof(value);
    if (!user?.id || !value || !value.startsWith("data:")) return;

    setUploading("registrationProof", true);
    try {
      const uploaded = await workerPaymentService.uploadPaymentProof(value, `workerPayments/registration/${user.id}/draft`, user.id);
      setRegistrationProof(uploaded.url);
    } catch (error) {
      console.warn("Payment proof upload failed:", error);
      setPopup({
        tone: "error",
        title: "Payment proof upload failed",
        message: error instanceof Error ? error.message : "The payment proof could not be uploaded. Please choose the image again."
      });
      setRegistrationProof("");
    } finally {
      setUploading("registrationProof", false);
    }
  }

  async function preUploadSampleWorks(values: string[]) {
    setSampleWorks(values);
    if (!user?.id) return;

    const newItems = values.filter((item) => item.startsWith("data:"));
    if (!newItems.length) return;

    setUploading("sampleWorks", true);
    try {
      const existingItems = values.filter((item) => !item.startsWith("data:"));
      const uploadedItems = await mediaService.uploadMany(newItems, `providerDocuments/${user.id}/sample-works`, user.id);
      setSampleWorks([...existingItems, ...uploadedItems.map((item) => item.url)]);
    } catch (error) {
      console.warn("Pre-upload failed for sample works:", error);
      setPopup({
        tone: "error",
        title: "Sample upload failed",
        message: error instanceof Error ? error.message : "One or more sample files could not be uploaded. Please choose them again."
      });
      setSampleWorks(values.filter((item) => !item.startsWith("data:")));
    } finally {
      setUploading("sampleWorks", false);
    }
  }

  function toggleCategory(name: string) {
    setSelectedCategories((current) => (current.includes(name) ? current.filter((item) => item !== name) : [...current, name]));
  }

  function toggleCoverageArea(name: string) {
    setSelectedCoverageAreas((current) => {
      const next = current.includes(name) ? current.filter((item) => item !== name) : [...current, name];
      setCoverage(next.join(", "));
      return next;
    });
  }

  function openBirthdayPicker() {
    const currentBirthday = parseBirthdayDate(birthday);
    setBirthdayCursor(currentBirthday ? new Date(currentBirthday.getFullYear(), currentBirthday.getMonth(), 1) : new Date(new Date().getFullYear() - 25, 0, 1));
    setShowBirthdayModal(true);
  }

  function handleBirthdayChange(nextValue: string) {
    setBirthday(nextValue);
    setAge(formatAgeFromBirthday(nextValue));
  }

  async function handleSubmit() {
    if (applicationStatus === "Pending Approval" || applicationStatus === "Rejected") {
      router.replace("/provider/pending");
      return;
    }
    if (applicationStatus === "Approved") {
      router.replace("/(tabs)/home");
      return;
    }

    if (!termsAccepted) {
      setPopup({
        tone: "error",
        title: "Terms not accepted",
        message: "Please read the worker terms and tick the agreement checkbox before continuing."
      });
      setShowTerms(true);
      return;
    }

    if (!user?.email) {
      setPopup({ tone: "error", title: "Missing account email", message: "Please sign in again before continuing with onboarding." });
      return;
    }

    if (registrationPaymentRequired) {
      const missingPaymentProof = !registrationProof.trim();
      const missingReference = !registrationReference.trim();
      const missingPaymentDate = !registrationPaymentDate.trim();
      if (missingPaymentProof || missingReference || missingPaymentDate) {
        setOnboardingStepIndex(Math.max(0, onboardingStepKeys.indexOf("payment")));
        setFeedback({
          type: "error",
          title: "Payment details required",
          message: "Upload your payment proof, enter the reference number, and select the payment date before submitting."
        });
        setPopup({
          tone: "error",
          title: "Payment details required",
          message: "Please complete the registration payment section before submitting your worker application."
        });
        return;
      }
    }

    if (hasMissingRequirements) {
      setFeedback({
        type: "error",
        title: "Incomplete application",
        message: "Please complete every field marked with a red asterisk before submitting your worker application."
      });
      setPopup({
        tone: "error",
        title: "Incomplete application",
        message: "Some required fields are still missing. Stay on this screen, complete the highlighted fields, then try again."
      });
      return;
    }

    if (hasUploadsInProgress) {
      setPopup({
        tone: "info",
        title: "Uploads still running",
        message: "Please wait for the selected pictures and documents to finish uploading before submitting."
      });
      return;
    }

    try {
      setSubmitting(true);
      await submitProviderOnboarding({
        fullName,
        businessName,
        email: user.email,
        mobileNumber,
        birthday,
        age,
        address,
        cityCoverageArea: coverage,
        serviceCategoriesOffered: selectedCategories,
        yearsOfExperience: experience,
        shortBio: bio,
        qualifications,
        additionalDetails,
        profilePhotoDriveLink: profilePhoto,
        validIdDriveLink: validId,
        permitCertificateDriveLink: permitCertificate,
        sampleWorkUrls: sampleWorks,
        registrationPaymentProofUrl: registrationPaymentRequired ? registrationProof : "",
        registrationPaymentReference: registrationPaymentRequired ? registrationReference : "",
        registrationPaymentDate: registrationPaymentRequired ? registrationPaymentDate : "",
        registrationPaymentMethod: registrationMethod || paymentSettings?.paymentMethodName || "",
        emergencyContact: contact,
        agreementAccepted: true,
        availability
      });
      setPopup({
        tone: "success",
        title: "Application submitted",
        message: "Your worker application has been sent successfully. We’ll move you to the application status page next."
      });
      setTimeout(() => router.replace("/provider/pending"), 900);
    } catch (error) {
      setPopup({
        tone: "error",
        title: "Submission failed",
        message: error instanceof Error ? error.message : "We could not submit your application right now."
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAgreeTerms() {
    if (!termsAccepted) return;
    if (user?.id) {
      await userService.updateProviderProfile(user.id, {
        termsAcceptedAt: new Date().toISOString()
      } as Partial<ProviderProfile> & { termsAcceptedAt?: string });
    }
    setShowTerms(false);
  }

  function handleCancelRegistration() {
    setShowCancelRegistration(false);
    void signOut().finally(() => router.replace("/(auth)/role-selection"));
  }

  function handleQrCodeDownload() {
    const qrCodeUrl = paymentSettings?.activeQrCodeUrl;
    if (!qrCodeUrl) {
      setPopup({
        tone: "error",
        title: "No QR code available",
        message: "The admin has not uploaded a payment QR code yet."
      });
      return;
    }

    if (Platform.OS === "web" && typeof document !== "undefined") {
      const anchor = document.createElement("a");
      anchor.href = qrCodeUrl;
      anchor.download = "kabisig-worker-payment-qr.png";
      anchor.rel = "noopener";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setPopup({
        tone: "success",
        title: "QR code downloaded",
        message: "Open your mobile banking app, complete the payment, then return here to upload your proof."
      });
      return;
    }

    void Linking.openURL(qrCodeUrl).catch(() => {
      setPopup({
        tone: "error",
        title: "Could not open QR code",
        message: "Please try again or contact support if the QR code does not open."
      });
    });
  }

  function handlePrimaryFooterAction() {
    if (!isLastOnboardingStep) {
      setOnboardingStepIndex((current) => Math.min(current + 1, onboardingSteps.length - 1));
      return;
    }
    void handleSubmit();
  }

  return (
    <FixedScreen
      style={{ backgroundColor: theme.colors.background }}
      header={<AppHeader title="Worker Onboarding" />}
      footer={
        <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
          <Pressable
            onPress={() => setShowCancelRegistration(true)}
            disabled={submitting}
            style={{
              borderRadius: 18,
              borderWidth: 1,
              borderColor: theme.colors.primary,
              backgroundColor: theme.colors.card,
              alignItems: "center",
              justifyContent: "center",
              paddingHorizontal: 18,
              paddingVertical: 15,
              opacity: submitting ? 0.55 : 1,
              flex: 1
            }}
          >
            <Text style={{ color: theme.colors.primaryDark, fontSize: 14, fontWeight: "800" }}>Cancel</Text>
          </Pressable>
          <PrimaryButton
            label={
              isLastOnboardingStep
                ? submitting ? "Submitting..." : hasUploadsInProgress ? "Uploading files..." : "Submit application"
                : "Next"
            }
            onPress={handlePrimaryFooterAction}
            disabled={submitting || hasUploadsInProgress}
            style={{ flex: 1 }}
          />
        </View>
      }
    >
      {feedback ? <FeedbackBanner type={feedback.type} title={feedback.title} message={feedback.message} /> : null}
      <FullScreenPopup
        visible={!!popup}
        tone={popup?.tone || "info"}
        title={popup?.title || ""}
        message={popup?.message || ""}
        icon={popup?.tone === "error" ? "alert-circle" : popup?.tone === "success" ? "checkmark-done-circle" : "information-circle"}
        dismissLabel="Close"
        onDismiss={() => setPopup(null)}
      />
      <Modal visible={submitting} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: "rgba(8,17,32,0.52)", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <SurfaceCard style={{ width: "100%", maxWidth: 360, gap: 16, alignItems: "center" }}>
            <Ionicons name="cloud-upload-outline" size={34} color={theme.colors.primary} />
            <Text style={{ color: theme.colors.text, fontSize: 20, fontWeight: "900", textAlign: "center" }}>Uploading your application</Text>
            <Text style={{ color: theme.colors.textMuted, textAlign: "center", lineHeight: 20 }}>
              Please wait while Kabisig uploads your documents and prepares your provider profile.
            </Text>
            <View style={{ width: "100%", height: 10, borderRadius: 999, overflow: "hidden", backgroundColor: theme.colors.surfaceAlt }}>
              <View style={{ width: "72%", height: "100%", borderRadius: 999, backgroundColor: theme.colors.primary }} />
            </View>
          </SurfaceCard>
        </View>
      </Modal>
      <Modal visible={showCancelRegistration} transparent animationType="fade" onRequestClose={() => setShowCancelRegistration(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(8,17,32,0.62)", justifyContent: "center", padding: 18 }}>
          <SurfaceCard style={{ width: "100%", maxWidth: 420, alignSelf: "center", gap: 14 }}>
            <View style={{ width: 42, height: 42, borderRadius: 16, backgroundColor: theme.colors.dangerSoft, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="close-circle-outline" size={24} color={theme.colors.danger} />
            </View>
            <View style={{ gap: 6 }}>
              <Text style={{ color: theme.colors.text, fontSize: 20, lineHeight: 25, fontWeight: "900" }}>Cancel worker registration?</Text>
              <Text style={{ color: theme.colors.textMuted, fontSize: 13, lineHeight: 19 }}>
                This will leave worker onboarding and return you to role selection. Your application will not be submitted for admin review.
              </Text>
            </View>
            <View style={{ gap: 8 }}>
              <PrimaryButton label="Keep editing" onPress={() => setShowCancelRegistration(false)} />
              <Pressable
                onPress={handleCancelRegistration}
                style={{
                  minHeight: 44,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: theme.colors.danger,
                  alignItems: "center",
                  justifyContent: "center",
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  backgroundColor: theme.colors.card
                }}
              >
                <Text style={{ color: theme.colors.danger, fontWeight: "900", fontSize: 14 }}>Cancel registration</Text>
              </Pressable>
            </View>
          </SurfaceCard>
        </View>
      </Modal>
      <Modal visible={showBirthdayModal} transparent animationType="fade" onRequestClose={() => setShowBirthdayModal(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(8,17,32,0.66)", justifyContent: "center", padding: 18 }}>
          <SurfaceCard style={{ gap: 14 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ color: theme.colors.text, fontSize: 20, fontWeight: "900" }}>Select your birthday</Text>
              <Pressable onPress={() => setShowBirthdayModal(false)}>
                <Ionicons name="close" size={22} color={theme.colors.textMuted} />
              </Pressable>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Pressable
                onPress={() => setBirthdayCursor((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
                style={{ padding: 8 }}
              >
                <Ionicons name="chevron-back" size={20} color={theme.colors.primaryDark} />
              </Pressable>
              <Text style={{ color: theme.colors.text, fontWeight: "800", fontSize: 16 }}>
                {birthdayCursor.toLocaleString("en-US", { month: "long", year: "numeric" })}
              </Text>
              <Pressable
                onPress={() => setBirthdayCursor((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
                style={{ padding: 8 }}
              >
                <Ionicons name="chevron-forward" size={20} color={theme.colors.primaryDark} />
              </Pressable>
            </View>
            <View style={{ gap: 8 }}>
              <Text style={{ color: theme.colors.textLight, fontWeight: "700" }}>Jump to month</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {monthOptions.map((label, index) => {
                  const active = birthdayCursor.getMonth() === index;
                  return (
                    <Pressable
                      key={label}
                      onPress={() => setBirthdayCursor((current) => new Date(current.getFullYear(), index, 1))}
                      style={{
                        borderRadius: 999,
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        backgroundColor: active ? theme.colors.primary : theme.colors.surfaceAlt,
                        borderWidth: 1,
                        borderColor: active ? theme.colors.primary : theme.colors.border
                      }}
                    >
                      <Text style={{ color: active ? "#fff" : theme.colors.text, fontWeight: "700" }}>{label}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
            <View style={{ gap: 8 }}>
              <Text style={{ color: theme.colors.textLight, fontWeight: "700" }}>Jump to year</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {Array.from({ length: 70 }, (_, offset) => new Date().getFullYear() - offset).map((yearValue) => {
                  const active = birthdayCursor.getFullYear() === yearValue;
                  return (
                    <Pressable
                      key={`year-${yearValue}`}
                      onPress={() => setBirthdayCursor((current) => new Date(yearValue, current.getMonth(), 1))}
                      style={{
                        borderRadius: 999,
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        backgroundColor: active ? theme.colors.primary : theme.colors.surfaceAlt,
                        borderWidth: 1,
                        borderColor: active ? theme.colors.primary : theme.colors.border
                      }}
                    >
                      <Text style={{ color: active ? "#fff" : theme.colors.text, fontWeight: "700" }}>{yearValue}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label) => (
                <View key={label} style={{ width: "14.28%", paddingVertical: 6 }}>
                  <Text style={{ color: theme.colors.textLight, textAlign: "center", fontWeight: "700", fontSize: 12 }}>{label}</Text>
                </View>
              ))}
              {monthDays(birthdayCursor).map((item, index) => {
                const selectedValue = parseBirthdayDate(birthday);
                const active =
                  item &&
                  selectedValue &&
                  item.getFullYear() === selectedValue.getFullYear() &&
                  item.getMonth() === selectedValue.getMonth() &&
                  item.getDate() === selectedValue.getDate();
                const disabled = item ? item.getTime() > Date.now() : true;
                return (
                  <Pressable
                    key={`${item ? item.toISOString() : "empty"}-${index}`}
                    onPress={() => {
                      if (!item || disabled) return;
                      const nextValue = toBirthdayValue(item);
                      setBirthday(nextValue);
                      setAge(formatAgeFromBirthday(nextValue));
                      setShowBirthdayModal(false);
                    }}
                    disabled={!item || disabled}
                    style={{
                      width: "14.28%",
                      aspectRatio: 1,
                      alignItems: "center",
                      justifyContent: "center",
                      opacity: !item || disabled ? 0.35 : 1
                    }}
                  >
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: active ? theme.colors.primary : "transparent"
                      }}
                    >
                      <Text style={{ color: active ? "#fff" : theme.colors.text, fontWeight: active ? "900" : "700" }}>
                        {item ? item.getDate() : ""}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
            <Text style={{ color: theme.colors.textMuted, lineHeight: 20 }}>
              Pick your exact birthday from the calendar. Future dates are disabled.
            </Text>
          </SurfaceCard>
        </View>
      </Modal>

      {!hydrating && showTerms ? (
        <Modal visible transparent animationType="fade">
          <View style={{ flex: 1, backgroundColor: "rgba(8,17,32,0.66)", justifyContent: "center", padding: 18 }}>
            <SurfaceCard style={{ maxHeight: "88%", gap: 14 }}>
            <Text style={{ color: theme.colors.text, fontSize: 22, fontWeight: "900" }}>Worker terms and agreement</Text>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 4 }}>
              <Text style={{ color: theme.colors.textMuted, lineHeight: 21 }}>
                By continuing with worker onboarding, you confirm that every profile detail, business representation, qualification statement, work sample, verification file, and communication submitted to Kabisig is accurate, current, and lawfully yours to provide for marketplace review.
              </Text>
              {kabisigWorkerAgreementSections.map((section) => (
                <View key={section.title} style={{ flexDirection: "row", gap: 10 }}>
                  <Ionicons name="document-text-outline" size={18} color={theme.colors.primary} style={{ marginTop: 2 }} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ color: theme.colors.text, fontWeight: "900", lineHeight: 19 }}>{section.title}</Text>
                    <Text style={{ color: theme.colors.textMuted, lineHeight: 20 }}>{section.body}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
            <Pressable
              onPress={() => setTermsAccepted((current) => !current)}
              style={{ flexDirection: "row", gap: 12, alignItems: "flex-start", paddingTop: 8 }}
            >
              <Ionicons name={termsAccepted ? "checkbox" : "square-outline"} size={22} color={termsAccepted ? theme.colors.primary : theme.colors.textMuted} />
              <Text style={{ color: theme.colors.text, flex: 1, lineHeight: 20 }}>
                I have read and agree to the worker terms and agreement for Kabisig.
              </Text>
            </Pressable>
            <PrimaryButton label="Agree and continue" onPress={() => void handleAgreeTerms()} disabled={!termsAccepted} />
            </SurfaceCard>
          </View>
        </Modal>
      ) : null}

      <SurfaceCard style={{ backgroundColor: theme.colors.primarySoft, gap: 5, padding: 10 }}>
        <Text style={{ color: theme.colors.primaryDark, fontSize: 16, lineHeight: 19, fontWeight: "900" }}>{activeStep.title}</Text>
        <Text style={{ color: theme.colors.textMuted, lineHeight: 15, fontSize: 11 }}>
          Step {onboardingStepIndex + 1} of {onboardingSteps.length}: {activeStep.subtitle}
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 5 }}>
          {onboardingSteps.map((step, index) => {
            const active = index === onboardingStepIndex;
            const done = index < onboardingStepIndex;
            return (
              <Pressable
                key={step.key}
                onPress={() => setOnboardingStepIndex(index)}
                style={{
                  borderRadius: 999,
                  paddingHorizontal: 9,
                  paddingVertical: 5,
                  backgroundColor: active ? theme.colors.primary : done ? theme.colors.card : theme.colors.surfaceAlt,
                  borderWidth: 1,
                  borderColor: active ? theme.colors.primary : theme.colors.border
                }}
              >
                <Text style={{ color: active ? "#fff" : theme.colors.text, fontSize: 11, lineHeight: 14, fontWeight: "800" }}>
                  {index + 1}. {step.title}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {onboardingStepIndex > 0 ? (
          <Pressable onPress={() => setOnboardingStepIndex((current) => Math.max(0, current - 1))} style={{ alignSelf: "flex-start", paddingTop: 2 }}>
            <Text style={{ color: theme.colors.primaryDark, fontSize: 12, fontWeight: "900" }}>Back to previous section</Text>
          </Pressable>
        ) : null}
      </SurfaceCard>

      {applicationStatus === "Revision Requested" ? (
        <FeedbackBanner
          type="info"
          title="Revision requested"
          message={reviewNotes || "The admin team requested updates to your application. Review your details, update the required fields, then resubmit."}
        />
      ) : null}

      {activeStepKey === "identity" ? (
      <SurfaceCard style={sectionCardStyle}>
        <SectionHeader icon="person-circle-outline" title="Identity and public profile" subtitle="These details help customers understand who you are before they book." />
        <View style={fieldStackStyle}>
          <OnboardingField label="Full name" value={fullName} onChangeText={setFullName} required error={requiredFields.fullName} />
          <OnboardingField label="Business or display name" value={businessName} onChangeText={setBusinessName} required error={requiredFields.businessName} />
          <OnboardingField label="Email" value={user?.email || ""} editable={false} required />
          <OnboardingField label="Mobile number" value={mobileNumber} onChangeText={setMobileNumber} keyboardType="phone-pad" required error={requiredFields.mobileNumber} />
          <View style={{ flexDirection: "row", gap: 6, alignItems: "flex-start", width: "100%" }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <BirthdayField value={birthday} onChange={handleBirthdayChange} onOpenNativePicker={openBirthdayPicker} required error={requiredFields.birthday} />
            </View>
            <View style={{ width: 86, flexShrink: 0 }}>
              <OnboardingField label="Age" value={age} onChangeText={setAge} keyboardType="numeric" required error={requiredFields.age} />
            </View>
          </View>
          <OnboardingField label="Complete address" value={address} onChangeText={setAddress} multiline style={{ textAlignVertical: "top" }} required error={requiredFields.address} />
          <View style={{ gap: 4 }}>
            <Text style={{ color: theme.colors.text, fontSize: 11, lineHeight: 13, fontWeight: "800" }}>
              City / coverage area<Text style={{ color: theme.colors.danger }}> *</Text>
            </Text>
            <Text style={{ color: theme.colors.textMuted, lineHeight: 15, fontSize: 11 }}>
              Select one or more service areas where you accept bookings.
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {coverageAreas.map((coverageArea) => {
                const active = selectedCoverageAreas.includes(coverageArea.name);
                return (
                  <Pressable
                    key={coverageArea.id}
                    onPress={() => toggleCoverageArea(coverageArea.name)}
                    style={{
                      minWidth: "46%",
                      flexGrow: 1,
                      borderRadius: 12,
                      paddingHorizontal: 10,
                      paddingVertical: 7,
                      borderWidth: 1,
                      borderColor: requiredFields.coverage ? theme.colors.danger : active ? theme.colors.primary : theme.colors.border,
                      backgroundColor: active ? theme.colors.primarySoft : theme.colors.card,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10
                    }}
                  >
                    <Text style={{ color: theme.colors.text, fontWeight: "800", flex: 1 }}>{coverageArea.name}</Text>
                    <Ionicons name={active ? "checkmark-circle" : "ellipse-outline"} size={20} color={active ? theme.colors.primary : theme.colors.textMuted} />
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </SurfaceCard>
      ) : null}

      {activeStepKey === "services" ? (
      <SurfaceCard style={sectionCardStyle}>
        <SectionHeader icon="briefcase-outline" title="Services and qualifications" subtitle="Select every service you are qualified to offer. Customers will see these categories on your profile." />
        {loadingCategories ? (
          <LoadingState label="Loading service categories..." />
        ) : (
          <View style={fieldStackStyle}>
            <Text style={{ color: theme.colors.text, fontSize: 11, lineHeight: 13, fontWeight: "800" }}>
              Service categories offered<Text style={{ color: theme.colors.danger }}> *</Text>
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {categories.map((category) => {
                const active = selectedCategories.includes(category.name);
                return (
                  <Pressable
                    key={category.id}
                    onPress={() => toggleCategory(category.name)}
                    style={{
                      minWidth: "46%",
                      flexGrow: 1,
                      borderRadius: 12,
                      paddingHorizontal: 10,
                      paddingVertical: 7,
                      borderWidth: 1,
                      borderColor: requiredFields.selectedCategories ? theme.colors.danger : active ? theme.colors.primary : theme.colors.border,
                      backgroundColor: active ? theme.colors.primarySoft : theme.colors.card,
                      gap: 6
                    }}
                  >
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                      <Text style={{ color: theme.colors.text, fontSize: 12, lineHeight: 16, fontWeight: "800", flex: 1 }} numberOfLines={2}>
                        {category.name}
                      </Text>
                      <Ionicons name={active ? "checkmark-circle" : "add-circle-outline"} size={20} color={active ? theme.colors.primary : theme.colors.textMuted} />
                    </View>
                    <Text style={{ color: theme.colors.textMuted, fontSize: 11, lineHeight: 14 }} numberOfLines={2} ellipsizeMode="tail">
                      {shortCategoryDescription(category.description)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <OnboardingField label="Service qualification, license, or training" value={qualifications} onChangeText={setQualifications} multiline style={{ textAlignVertical: "top" }} required error={requiredFields.qualifications} />
            <OnboardingMediaUploadField
              label="Sample works"
              values={sampleWorks}
              onChange={(values) => void preUploadSampleWorks(values)}
              maxSizeMb={8}
              onError={(message) => setPopup({ tone: "error", title: "Upload too large", message })}
              helper={uploadingFiles.sampleWorks ? "Uploading sample works now. You can keep filling out the form." : "If you do not have formal documents for qualifications, upload sample photos or videos of your previous work here."}
              uploading={uploadingFiles.sampleWorks}
            />
            <View style={{ gap: 4 }}>
              <Text style={{ color: theme.colors.text, fontSize: 11, lineHeight: 13, fontWeight: "800" }}>
                Years of experience<Text style={{ color: theme.colors.danger }}> *</Text>
              </Text>
              <Text style={{ color: theme.colors.textMuted, lineHeight: 15, fontSize: 11 }}>
                Scroll and tap the number that matches your experience.
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingRight: 4 }}>
                {experienceOptions.map((value) => {
                  const active = experience === value;
                  return (
                    <Pressable
                      key={`experience-${value}`}
                      onPress={() => setExperience(value)}
                      style={{
                        minWidth: 54,
                        borderRadius: 13,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        backgroundColor: active ? theme.colors.primary : theme.colors.surfaceAlt,
                        borderWidth: 1,
                        borderColor: requiredFields.experience ? theme.colors.danger : active ? theme.colors.primary : theme.colors.border,
                        alignItems: "center"
                      }}
                    >
                      <Text style={{ color: active ? "#fff" : theme.colors.text, fontWeight: "800" }}>{value}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
            <OnboardingField label="Important details customers should know" value={additionalDetails} onChangeText={setAdditionalDetails} multiline style={{ textAlignVertical: "top" }} required error={requiredFields.additionalDetails} />
            <OnboardingField label="Short professional bio" value={bio} onChangeText={setBio} multiline style={{ textAlignVertical: "top" }} required error={requiredFields.bio} />
          </View>
        )}
      </SurfaceCard>
      ) : null}

      {activeStepKey === "verification" ? (
      <SurfaceCard style={sectionCardStyle}>
        <SectionHeader icon="documents-outline" title="Verification requirements" subtitle="Upload the required files directly from your device before submitting your application." />
        <View style={fieldStackStyle}>
          <OnboardingImageUploadField
            label="Profile photo"
            value={profilePhoto}
            onChange={(value) => void preUploadSingle("profilePhoto", value, `providerDocuments/${user?.id}/profile`, "profile-photo", setProfilePhoto)}
            required
            error={requiredFields.profilePhoto}
            maxSizeMb={5}
            onError={(message) => setPopup({ tone: "error", title: "Upload too large", message })}
            helper={uploadingFiles.profilePhoto ? "Uploading profile photo now. You can keep filling out the form." : "Use a formal photo with a plain white background. This is required and will be reviewed by the admin team."}
            uploading={uploadingFiles.profilePhoto}
          />
          <OnboardingImageUploadField
            label="Valid ID"
            value={validId}
            onChange={(value) => void preUploadSingle("validId", value, `providerDocuments/${user?.id}/valid-id`, "valid-id", setValidId)}
            required
            error={requiredFields.validId}
            maxSizeMb={6}
            onError={(message) => setPopup({ tone: "error", title: "Upload too large", message })}
            helper={uploadingFiles.validId ? "Uploading valid ID now. You can keep filling out the form." : "Upload a clear photo of your valid government ID."}
            uploading={uploadingFiles.validId}
          />
          <OnboardingImageUploadField
            label="Permit or certificate"
            value={permitCertificate}
            onChange={(value) => void preUploadSingle("permitCertificate", value, `providerDocuments/${user?.id}/permit`, "permit-certificate", setPermitCertificate)}
            maxSizeMb={6}
            onError={(message) => setPopup({ tone: "error", title: "Upload too large", message })}
            helper={uploadingFiles.permitCertificate ? "Uploading permit or certificate now. You can keep filling out the form." : "Upload your permit or certificate if available."}
            uploading={uploadingFiles.permitCertificate}
          />
          <OnboardingField label="Emergency contact" value={contact} onChangeText={setContact} required error={requiredFields.contact} />
        </View>
      </SurfaceCard>
      ) : null}

      {activeStepKey === "payment" ? (
      <SurfaceCard style={sectionCardStyle}>
        <View style={{ gap: 3 }}>
          <Text style={{ color: theme.colors.text, fontSize: 15, lineHeight: 18, fontWeight: "900" }}>Registration Payment</Text>
          <Text style={{ color: theme.colors.textMuted, fontSize: 11, lineHeight: 15 }}>Admin reviews this payment before approval.</Text>
        </View>
        {registrationPaymentRequired ? (
          <View style={fieldStackStyle}>
            <View style={{ borderRadius: 12, padding: 10, backgroundColor: theme.colors.primaryLight, gap: 6, borderWidth: 1, borderColor: "rgba(37, 99, 235, 0.16)" }}>
              <Text style={{ color: theme.colors.primaryDark, fontSize: 15, fontWeight: "900" }}>
                Registration Fee: PHP {registrationFeeAmount.toLocaleString()}
              </Text>
              <Text style={{ color: theme.colors.textMuted, lineHeight: 15, fontSize: 11 }}>
                Pay using {paymentSettings?.paymentMethodName || "the active QR code"}, then upload a clear screenshot with the reference number.
              </Text>
              {paymentSettings?.activeQrCodeUrl ? (
                <View style={{ gap: 10, alignItems: "center" }}>
                  <Image
                    source={{ uri: paymentSettings.activeQrCodeUrl }}
                    style={{ width: 220, height: 220, maxWidth: "100%", borderRadius: 16, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border }}
                    resizeMode="contain"
                  />
                  <Text style={{ color: theme.colors.textMuted, flex: 1, lineHeight: 15, fontSize: 11 }}>
                    {paymentSettings.paymentInstructions || "Scan this QR code and pay the exact registration fee."}
                  </Text>
                  <Pressable
                    onPress={handleQrCodeDownload}
                    style={{
                      minHeight: 42,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: theme.colors.primary,
                      backgroundColor: theme.colors.card,
                      alignItems: "center",
                      justifyContent: "center",
                      paddingHorizontal: 14,
                      paddingVertical: 9,
                      width: "100%"
                    }}
                  >
                    <Text style={{ color: theme.colors.primaryDark, fontSize: 13, fontWeight: "900" }}>Download QR Code</Text>
                  </Pressable>
                  <Text style={{ color: theme.colors.textMuted, fontSize: 11, lineHeight: 15, textAlign: "center" }}>
                    Download it, open your mobile banking app to pay, then return to Kabisig to upload your proof.
                  </Text>
                </View>
              ) : (
                <Text style={{ color: theme.colors.warning, fontWeight: "800", fontSize: 11, lineHeight: 16 }}>
                  The admin has not uploaded a QR code yet. Contact support if you cannot proceed.
                </Text>
              )}
            </View>
            <OnboardingImageUploadField
              label="Proof of payment screenshot"
              value={registrationProof}
              onChange={(value) => void preUploadPaymentProof(value)}
              required
              error={requiredFields.registrationProof}
              maxSizeMb={5}
              onError={(message) => setPopup({ tone: "error", title: "Invalid payment proof", message })}
              helper={uploadingFiles.registrationProof ? "Uploading payment proof now. Please wait before submitting." : "JPG, JPEG, PNG, or WEBP only. Maximum file size is 5 MB."}
              uploading={uploadingFiles.registrationProof}
            />
            <View style={{ flexDirection: "row", gap: 6 }}>
              <View style={{ flex: 1 }}>
                <OnboardingField label="Reference number" value={registrationReference} onChangeText={setRegistrationReference} required error={requiredFields.registrationReference} />
              </View>
              <View style={{ flex: 1 }}>
                <DateSelectField
                  label="Payment Date"
                  value={registrationPaymentDate}
                  onChange={setRegistrationPaymentDate}
                  placeholder="Select payment date"
                  required
                  error={requiredFields.registrationPaymentDate}
                  maxDate={new Date()}
                />
              </View>
            </View>
            <OnboardingField label="Payment method" value={registrationMethod} onChangeText={setRegistrationMethod} placeholder="GCash, Maya, or Bank QR" />
          </View>
        ) : (
          <View style={{ borderRadius: 12, padding: 10, backgroundColor: theme.colors.successSoft, gap: 6, borderWidth: 1, borderColor: theme.colors.success }}>
            <Text style={{ color: theme.colors.success, fontSize: 15, fontWeight: "900" }}>Registration Fee: Free</Text>
            <Text style={{ color: theme.colors.textMuted, lineHeight: 15, fontSize: 11 }}>
              No payment upload is required. Your application can proceed directly to admin review.
            </Text>
          </View>
        )}
      </SurfaceCard>
      ) : null}

      {activeStepKey === "schedule" ? (
      <SurfaceCard style={sectionCardStyle}>
        <SectionHeader icon="calendar-outline" title="Working days and schedule" subtitle="Turn on the days you accept bookings, then choose your available time window in AM or PM." />
        <View style={fieldStackStyle}>
          <Text style={{ color: theme.colors.text, fontSize: 11, lineHeight: 13, fontWeight: "800" }}>
            Availability schedule<Text style={{ color: theme.colors.danger }}> *</Text>
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {availability.map((slot) => {
              const active = selectedDay === slot.day;
              return (
                <Pressable
                  key={`onboard-day-${slot.day}`}
                  onPress={() => setSelectedDay(slot.day)}
                  style={{
                    borderRadius: 13,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    backgroundColor: active ? theme.colors.primary : theme.colors.surfaceAlt,
                    borderWidth: 1,
                    borderColor: requiredFields.availability ? theme.colors.danger : active ? theme.colors.primary : theme.colors.border
                  }}
                >
                  <Text style={{ color: active ? "#fff" : theme.colors.text, fontWeight: "800" }}>{slot.day}</Text>
                </Pressable>
              );
            })}
          </View>

          {availability.filter((slot) => slot.day === selectedDay).map((slot) => (
            <View key={`onboard-slot-${slot.day}`} style={{ gap: 8, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, padding: 10, backgroundColor: theme.colors.surfaceAlt }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.colors.text, fontSize: 15, fontWeight: "900" }}>{slot.day}</Text>
                  <Text style={{ color: theme.colors.textMuted, marginTop: 1, fontSize: 11 }}>Enable this day if customers can book you here.</Text>
                </View>
                <Pressable
                  onPress={() =>
                    setAvailability((current) =>
                      current.map((item) => (item.day === slot.day ? { ...item, available: !item.available } : item))
                    )
                  }
                  style={{
                    borderRadius: 999,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    backgroundColor: slot.available ? theme.colors.successSoft : theme.colors.surfaceAlt,
                    borderWidth: 1,
                    borderColor: slot.available ? theme.colors.success : theme.colors.border,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8
                  }}
                >
                  <Ionicons name={slot.available ? "checkmark-circle" : "ellipse-outline"} size={18} color={slot.available ? theme.colors.success : theme.colors.textMuted} />
                  <Text style={{ color: slot.available ? theme.colors.success : theme.colors.text, fontWeight: "800" }}>{slot.available ? "Available" : "Unavailable"}</Text>
                </Pressable>
              </View>

              <View style={{ gap: 5 }}>
                <Text style={{ color: theme.colors.textLight, fontWeight: "800", fontSize: 11 }}>Start time</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  {startSlots.map((value) => {
                    const active = slot.start === value;
                    return (
                      <Pressable
                        key={`${slot.day}-start-${value}`}
                        onPress={() =>
                          setAvailability((current) =>
                            current.map((item) => (item.day === slot.day ? { ...item, start: value } : item))
                          )
                        }
                        style={{
                          borderRadius: 999,
                          paddingHorizontal: 9,
                          paddingVertical: 6,
                          backgroundColor: active ? theme.colors.primary : theme.colors.surfaceAlt,
                          borderWidth: 1,
                          borderColor: active ? theme.colors.primary : theme.colors.border,
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 6
                        }}
                      >
                        <Ionicons name="sunny-outline" size={13} color={active ? "#fff" : theme.colors.primary} />
                        <Text style={{ color: active ? "#fff" : theme.colors.text, fontWeight: "700", fontSize: 12 }}>{formatTimeLabel(value)}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={{ gap: 5 }}>
                <Text style={{ color: theme.colors.textLight, fontWeight: "800", fontSize: 11 }}>End time</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  {endSlots.map((value) => {
                    const active = slot.end === value;
                    return (
                      <Pressable
                        key={`${slot.day}-end-${value}`}
                        onPress={() =>
                          setAvailability((current) =>
                            current.map((item) => (item.day === slot.day ? { ...item, end: value } : item))
                          )
                        }
                        style={{
                          borderRadius: 999,
                          paddingHorizontal: 9,
                          paddingVertical: 6,
                          backgroundColor: active ? theme.colors.accent : theme.colors.surfaceAlt,
                          borderWidth: 1,
                          borderColor: active ? theme.colors.accent : theme.colors.border,
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 6
                        }}
                      >
                        <Ionicons name="moon-outline" size={13} color={active ? "#fff" : theme.colors.accent} />
                        <Text style={{ color: active ? "#fff" : theme.colors.text, fontWeight: "700", fontSize: 12 }}>{formatTimeLabel(value)}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>
          ))}
        </View>
      </SurfaceCard>
      ) : null}
    </FixedScreen>
  );
}
