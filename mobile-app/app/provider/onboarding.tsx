import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Modal, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { categoryService, coverageAreaService, providerService, userService, type AvailabilitySchedule, type CoverageArea, type ProviderApprovalStatus, type ProviderProfile, type ServiceCategory } from "@kabisig/shared";
import {
  BackHeader,
  FeedbackBanner,
  FixedScreen,
  FormInput,
  FullScreenPopup,
  ImageUploadField,
  LoadingState,
  MultiMediaPickerField,
  PrimaryButton,
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
  { day: "Mon", start: "08:00", end: "17:00", available: false },
  { day: "Tue", start: "08:00", end: "17:00", available: false },
  { day: "Wed", start: "08:00", end: "17:00", available: false },
  { day: "Thu", start: "08:00", end: "17:00", available: false },
  { day: "Fri", start: "08:00", end: "17:00", available: false },
  { day: "Sat", start: "08:00", end: "12:00", available: false },
  { day: "Sun", start: "08:00", end: "12:00", available: false }
];

const startSlots = ["06:00", "07:00", "08:00", "09:00", "10:00", "11:00", "12:00"];
const endSlots = ["12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00"];
const experienceOptions = Array.from({ length: 41 }, (_, index) => String(index));
const monthOptions = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function formatTimeLabel(value: string) {
  const [rawHour, rawMinute] = value.split(":").map(Number);
  const suffix = rawHour >= 12 ? "PM" : "AM";
  const hour = ((rawHour + 11) % 12) + 1;
  return `${hour}:${(rawMinute || 0).toString().padStart(2, "0")} ${suffix}`;
}

function SectionHeader({ icon, title, subtitle }: { icon: keyof typeof Ionicons.glyphMap; title: string; subtitle: string }) {
  return (
    <View style={{ flexDirection: "row", gap: 12, alignItems: "center", marginBottom: 12 }}>
      <View style={{ width: 46, height: 46, borderRadius: 16, backgroundColor: theme.colors.primarySoft, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={icon} size={22} color={theme.colors.primaryDark} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: theme.colors.text, fontSize: 18, fontWeight: "900" }}>{title}</Text>
        <Text style={{ color: theme.colors.textMuted, lineHeight: 20 }}>{subtitle}</Text>
      </View>
    </View>
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
  const cells: Array<Date | null> = [];

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
  const { submitProviderOnboarding, user } = useAuth();
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [coverageAreas, setCoverageAreas] = useState<CoverageArea[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [submitting, setSubmitting] = useState(false);
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
        const [itemsResult, coverageAreasResult, profileResult, latestApplicationResult] = await Promise.allSettled([
          categoryService.getAllCategories(),
          coverageAreaService.getAllCoverageAreas(),
          userService.getProviderProfile(user.id),
          providerService.getLatestApplicationByUser(user.id)
        ]);
        const items = itemsResult.status === "fulfilled" ? itemsResult.value : [];
        const nextCoverageAreas = coverageAreasResult.status === "fulfilled" ? coverageAreasResult.value : [];
        const profile = profileResult.status === "fulfilled" ? profileResult.value : null;
        const latestApplication = latestApplicationResult.status === "fulfilled" ? latestApplicationResult.value : null;

        setCategories(items);
        setCoverageAreas(nextCoverageAreas);

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

          setFullName(profile.displayName || user.fullName || "");
          setBusinessName(profile.businessName || "");
          setMobileNumber(profile.phone || "");
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
      availability: !availability.some((slot) => slot.available)
    }),
    [additionalDetails, address, age, availability, bio, birthday, businessName, contact, experience, fullName, mobileNumber, profilePhoto, qualifications, selectedCategories, selectedCoverageAreas, validId]
  );

  const hasMissingRequirements = Object.values(requiredFields).some(Boolean);

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
    if (Platform.OS === "web" && typeof document !== "undefined") {
      const input = document.createElement("input");
      input.type = "date";
      input.value = birthday;
      input.style.position = "fixed";
      input.style.opacity = "0";
      input.style.pointerEvents = "none";
      input.style.left = "-9999px";
      input.onchange = () => {
        const nextValue = input.value;
        setBirthday(nextValue);
        setAge(formatAgeFromBirthday(nextValue));
        input.remove();
      };
      input.onblur = () => input.remove();
      document.body.appendChild(input);
      if (typeof (input as HTMLInputElement & { showPicker?: () => void }).showPicker === "function") {
        (input as HTMLInputElement & { showPicker?: () => void }).showPicker?.();
      } else {
        input.click();
      }
      return;
    }
    const currentBirthday = parseBirthdayDate(birthday);
    setBirthdayCursor(currentBirthday ? new Date(currentBirthday.getFullYear(), currentBirthday.getMonth(), 1) : new Date(new Date().getFullYear() - 25, 0, 1));
    setShowBirthdayModal(true);
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
        message: "Please read the provider terms and tick the agreement checkbox before continuing."
      });
      setShowTerms(true);
      return;
    }

    if (!user?.email) {
      setPopup({ tone: "error", title: "Missing account email", message: "Please sign in again before continuing with onboarding." });
      return;
    }

    if (hasMissingRequirements) {
      setFeedback({
        type: "error",
        title: "Incomplete application",
        message: "Please complete every field marked with a red asterisk before submitting your provider application."
      });
      setPopup({
        tone: "error",
        title: "Incomplete application",
        message: "Some required fields are still missing. Stay on this screen, complete the highlighted fields, then try again."
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
        emergencyContact: contact,
        agreementAccepted: true,
        availability
      });
      setPopup({
        tone: "success",
        title: "Application submitted",
        message: "Your provider application has been sent successfully. We’ll move you to the application status page next."
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

  return (
    <FixedScreen
      style={{ backgroundColor: theme.colors.background }}
      header={<BackHeader title="Provider Onboarding" onBack={() => router.replace("/(auth)/role-selection")} />}
      footer={<PrimaryButton label={submitting ? "Submitting..." : "Submit application"} onPress={() => void handleSubmit()} disabled={submitting} />}
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
            <Text style={{ color: theme.colors.text, fontSize: 22, fontWeight: "900" }}>Provider terms and agreement</Text>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 4 }}>
              <Text style={{ color: theme.colors.textMuted, lineHeight: 21 }}>
                By continuing with provider onboarding, you confirm that every profile detail, business representation, qualification statement, work sample, verification file, and communication submitted to Kabisig is accurate, current, and lawfully yours to provide for marketplace review.
              </Text>
              {[
                "Kabisig may review your profile photo, valid ID, emergency contact, work samples, business name, service categories, and any uploaded requirement before approval.",
                "Provider applications are assessed for identity verification, safety, professionalism, and service relevance. Approval is not automatic and may take one to two business days depending on review volume.",
                "If your application is incomplete or needs clarification, the admin team may request additional requirements or a revision before your provider profile can be published.",
                "Only approved providers become visible to customers. Rejected applications may not edit or resubmit through the same pending screen unless a revision is requested.",
                "Customer reviews, complaint records, communication behavior, response quality, and service completion history may be used by Kabisig to preserve trust, safety, and platform quality.",
                "By proceeding, you allow Kabisig to display your approved public profile details, supported service categories, anonymized review summaries, work samples, and selected professional information to customers.",
                "Kabisig processes provider information for identity verification, fraud prevention, service safety, booking coordination, analytics, and customer support. Sensitive documents are used only for verification and operational review.",
                "You agree not to upload falsified documents, misleading images, offensive content, or materials that violate privacy, intellectual property, or applicable law. Kabisig may suspend or remove accounts that breach these terms.",
                "You remain responsible for the quality of service you accept, the truthfulness of your availability, and the professionalism of your conduct inside chats, bookings, reviews, and complaint handling."
              ].map((item) => (
                <View key={item} style={{ flexDirection: "row", gap: 10 }}>
                  <Ionicons name="document-text-outline" size={18} color={theme.colors.primary} style={{ marginTop: 2 }} />
                  <Text style={{ color: theme.colors.textMuted, flex: 1, lineHeight: 20 }}>{item}</Text>
                </View>
              ))}
            </ScrollView>
            <Pressable
              onPress={() => setTermsAccepted((current) => !current)}
              style={{ flexDirection: "row", gap: 12, alignItems: "flex-start", paddingTop: 8 }}
            >
              <Ionicons name={termsAccepted ? "checkbox" : "square-outline"} size={22} color={termsAccepted ? theme.colors.primary : theme.colors.textMuted} />
              <Text style={{ color: theme.colors.text, flex: 1, lineHeight: 20 }}>
                I have read and agree to the provider terms and agreement for Kabisig.
              </Text>
            </Pressable>
            <PrimaryButton label="Agree and continue" onPress={() => void handleAgreeTerms()} disabled={!termsAccepted} />
            </SurfaceCard>
          </View>
        </Modal>
      ) : null}

      <SurfaceCard style={{ backgroundColor: theme.colors.primarySoft, gap: 10 }}>
        <Text style={{ color: theme.colors.primaryDark, fontSize: 18, fontWeight: "900" }}>Complete your provider application</Text>
        <Text style={{ color: theme.colors.textMuted, lineHeight: 21 }}>
          Fill out the required fields, upload the required documents from your device, and submit your profile for admin verification.
        </Text>
      </SurfaceCard>

      {applicationStatus === "Revision Requested" ? (
        <FeedbackBanner
          type="info"
          title="Revision requested"
          message={reviewNotes || "The admin team requested updates to your application. Review your details, update the required fields, then resubmit."}
        />
      ) : null}

      <SurfaceCard>
        <SectionHeader icon="person-circle-outline" title="Identity and public profile" subtitle="These details help customers understand who you are before they book." />
        <View style={{ gap: 12 }}>
          <FormInput label="Full name" value={fullName} onChangeText={setFullName} required error={requiredFields.fullName} />
          <FormInput label="Business or display name" value={businessName} onChangeText={setBusinessName} required error={requiredFields.businessName} />
          <FormInput label="Email" value={user?.email || ""} editable={false} required />
          <FormInput label="Mobile number" value={mobileNumber} onChangeText={setMobileNumber} keyboardType="phone-pad" required error={requiredFields.mobileNumber} />
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1, gap: 8 }}>
              <Text style={{ color: theme.colors.text, fontSize: 13, fontWeight: "800" }}>Birthday<Text style={{ color: theme.colors.danger }}> *</Text></Text>
              <Pressable
                onPress={openBirthdayPicker}
                style={{
                  borderRadius: 18,
                  borderWidth: 1,
                  borderColor: requiredFields.birthday ? theme.colors.danger : theme.colors.border,
                  paddingHorizontal: 16,
                  paddingVertical: 15,
                  backgroundColor: theme.colors.card,
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center"
                }}
              >
                <Text style={{ color: birthday ? theme.colors.text : theme.colors.textMuted }}>{birthday || "Select your birthday"}</Text>
                <Ionicons name="calendar-outline" size={18} color={theme.colors.primaryDark} />
              </Pressable>
              <Text style={{ color: theme.colors.textLight, fontSize: 12 }}>Tap the field to open the date picker calendar.</Text>
            </View>
            <View style={{ flex: 0.45 }}>
              <FormInput label="Age" value={age} onChangeText={setAge} keyboardType="numeric" required error={requiredFields.age} />
            </View>
          </View>
          <FormInput label="Complete address" value={address} onChangeText={setAddress} multiline style={{ minHeight: 92, textAlignVertical: "top" }} required error={requiredFields.address} />
          <View style={{ gap: 8 }}>
            <Text style={{ color: theme.colors.text, fontSize: 13, fontWeight: "800" }}>
              City / coverage area<Text style={{ color: theme.colors.danger }}> *</Text>
            </Text>
            <Text style={{ color: theme.colors.textMuted, lineHeight: 19 }}>
              Select one or more service areas where you accept bookings.
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              {coverageAreas.map((coverageArea) => {
                const active = selectedCoverageAreas.includes(coverageArea.name);
                return (
                  <Pressable
                    key={coverageArea.id}
                    onPress={() => toggleCoverageArea(coverageArea.name)}
                    style={{
                      minWidth: "46%",
                      flexGrow: 1,
                      borderRadius: 18,
                      paddingHorizontal: 14,
                      paddingVertical: 14,
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

      <SurfaceCard>
        <SectionHeader icon="briefcase-outline" title="Services and qualifications" subtitle="Select every service you are qualified to offer. Customers will see these categories on your profile." />
        {loadingCategories ? (
          <LoadingState label="Loading service categories..." />
        ) : (
          <View style={{ gap: 12 }}>
            <Text style={{ color: theme.colors.text, fontSize: 13, fontWeight: "800" }}>
              Service categories offered<Text style={{ color: theme.colors.danger }}> *</Text>
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              {categories.map((category) => {
                const active = selectedCategories.includes(category.name);
                return (
                  <Pressable
                    key={category.id}
                    onPress={() => toggleCategory(category.name)}
                    style={{
                      minWidth: "46%",
                      flexGrow: 1,
                      borderRadius: 18,
                      paddingHorizontal: 14,
                      paddingVertical: 14,
                      borderWidth: 1,
                      borderColor: requiredFields.selectedCategories ? theme.colors.danger : active ? theme.colors.primary : theme.colors.border,
                      backgroundColor: active ? theme.colors.primarySoft : theme.colors.card,
                      gap: 6
                    }}
                  >
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                      <Text style={{ color: theme.colors.text, fontWeight: "800", flex: 1 }}>{category.name}</Text>
                      <Ionicons name={active ? "checkmark-circle" : "add-circle-outline"} size={20} color={active ? theme.colors.primary : theme.colors.textMuted} />
                    </View>
                    <Text style={{ color: theme.colors.textMuted, fontSize: 12, lineHeight: 18 }}>{category.description}</Text>
                  </Pressable>
                );
              })}
            </View>
            <FormInput label="Service qualification, license, or training" value={qualifications} onChangeText={setQualifications} multiline style={{ minHeight: 94, textAlignVertical: "top" }} required error={requiredFields.qualifications} />
            <MultiMediaPickerField
              label="Sample works"
              values={sampleWorks}
              onChange={setSampleWorks}
              maxSizeMb={8}
              onError={(message) => setPopup({ tone: "error", title: "Upload too large", message })}
              helper="If you do not have formal documents for qualifications, upload sample photos or videos of your previous work here."
            />
            <View style={{ gap: 8 }}>
              <Text style={{ color: theme.colors.text, fontSize: 13, fontWeight: "800" }}>
                Years of experience<Text style={{ color: theme.colors.danger }}> *</Text>
              </Text>
              <Text style={{ color: theme.colors.textMuted, lineHeight: 19 }}>
                Scroll and tap the number that matches your experience.
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {experienceOptions.map((value) => {
                  const active = experience === value;
                  return (
                    <Pressable
                      key={`experience-${value}`}
                      onPress={() => setExperience(value)}
                      style={{
                        minWidth: 54,
                        borderRadius: 16,
                        paddingHorizontal: 14,
                        paddingVertical: 12,
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
            <FormInput label="Important details customers should know" value={additionalDetails} onChangeText={setAdditionalDetails} multiline style={{ minHeight: 94, textAlignVertical: "top" }} required error={requiredFields.additionalDetails} />
            <FormInput label="Short professional bio" value={bio} onChangeText={setBio} multiline style={{ minHeight: 110, textAlignVertical: "top" }} required error={requiredFields.bio} />
          </View>
        )}
      </SurfaceCard>

      <SurfaceCard>
        <SectionHeader icon="documents-outline" title="Verification requirements" subtitle="Upload the required files directly from your device before submitting your application." />
        <View style={{ gap: 12 }}>
          <ImageUploadField
            label="Profile photo"
            value={profilePhoto}
            onChange={setProfilePhoto}
            required
            error={requiredFields.profilePhoto}
            maxSizeMb={5}
            onError={(message) => setPopup({ tone: "error", title: "Upload too large", message })}
            helper="Use a formal photo with a plain white background. This is required and will be reviewed by the admin team."
          />
          <ImageUploadField
            label="Valid ID"
            value={validId}
            onChange={setValidId}
            required
            error={requiredFields.validId}
            maxSizeMb={6}
            onError={(message) => setPopup({ tone: "error", title: "Upload too large", message })}
            helper="Upload a clear photo of your valid government ID."
          />
          <ImageUploadField
            label="Permit or certificate"
            value={permitCertificate}
            onChange={setPermitCertificate}
            maxSizeMb={6}
            onError={(message) => setPopup({ tone: "error", title: "Upload too large", message })}
            helper="Upload your permit or certificate if available."
          />
          <FormInput label="Emergency contact" value={contact} onChangeText={setContact} required error={requiredFields.contact} />
        </View>
      </SurfaceCard>

      <SurfaceCard>
        <SectionHeader icon="calendar-outline" title="Working days and schedule" subtitle="Turn on the days you accept bookings, then choose your available time window in AM or PM." />
        <View style={{ gap: 12 }}>
          <Text style={{ color: theme.colors.text, fontSize: 13, fontWeight: "800" }}>
            Availability schedule<Text style={{ color: theme.colors.danger }}> *</Text>
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {availability.map((slot) => {
              const active = selectedDay === slot.day;
              return (
                <Pressable
                  key={`onboard-day-${slot.day}`}
                  onPress={() => setSelectedDay(slot.day)}
                  style={{
                    borderRadius: 16,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
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
            <View key={`onboard-slot-${slot.day}`} style={{ gap: 12, borderRadius: 18, borderWidth: 1, borderColor: theme.colors.border, padding: 14, backgroundColor: theme.colors.card }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: "900" }}>{slot.day}</Text>
                  <Text style={{ color: theme.colors.textMuted, marginTop: 4 }}>Enable this day if customers can book you here.</Text>
                </View>
                <Pressable
                  onPress={() =>
                    setAvailability((current) =>
                      current.map((item) => (item.day === slot.day ? { ...item, available: !item.available } : item))
                    )
                  }
                  style={{
                    borderRadius: 999,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
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

              <View style={{ gap: 10 }}>
                <Text style={{ color: theme.colors.textLight, fontWeight: "700" }}>Start time</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
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
                          paddingHorizontal: 12,
                          paddingVertical: 9,
                          backgroundColor: active ? theme.colors.primary : theme.colors.surfaceAlt,
                          borderWidth: 1,
                          borderColor: active ? theme.colors.primary : theme.colors.border,
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 6
                        }}
                      >
                        <Ionicons name="sunny-outline" size={14} color={active ? "#fff" : theme.colors.primary} />
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
                          setAvailability((current) =>
                            current.map((item) => (item.day === slot.day ? { ...item, end: value } : item))
                          )
                        }
                        style={{
                          borderRadius: 999,
                          paddingHorizontal: 12,
                          paddingVertical: 9,
                          backgroundColor: active ? theme.colors.accent : theme.colors.surfaceAlt,
                          borderWidth: 1,
                          borderColor: active ? theme.colors.accent : theme.colors.border,
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 6
                        }}
                      >
                        <Ionicons name="moon-outline" size={14} color={active ? "#fff" : theme.colors.accent} />
                        <Text style={{ color: active ? "#fff" : theme.colors.text, fontWeight: "700" }}>{formatTimeLabel(value)}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>
          ))}
        </View>
      </SurfaceCard>
    </FixedScreen>
  );
}
