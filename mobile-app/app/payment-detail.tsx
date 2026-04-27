import { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { bookingService, paymentService, userService, type Booking, type Payment, type User } from "@kabisig/shared";
import { Text, View } from "react-native";
import { Avatar, BackHeader, EmptyState, FixedScreen, LoadingState, StatusBadge, SurfaceCard } from "../src/components";
import { theme } from "../src/theme";

export default function PaymentDetailScreen() {
  const params = useLocalSearchParams<{ paymentId?: string; mode?: string }>();
  const [payment, setPayment] = useState<Payment | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [customer, setCustomer] = useState<User | null>(null);
  const [provider, setProvider] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!params.paymentId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      const paymentDoc = await paymentService.getPaymentById(params.paymentId);
      setPayment(paymentDoc);

      if (paymentDoc) {
        const bookingDoc = await bookingService.getBookingById(paymentDoc.bookingId);
        setBooking(bookingDoc);
        const [customerDoc, providerDoc] = await Promise.all([
          userService.getUserDocument(paymentDoc.customerId),
          userService.getUserDocument(paymentDoc.providerId)
        ]);
        setCustomer(customerDoc);
        setProvider(providerDoc);
      }

      setLoading(false);
    }

    void load();
  }, [params.paymentId]);

  if (loading) {
    return (
      <FixedScreen header={<BackHeader title="Payment Details" onBack={() => router.back()} />}>
        <LoadingState label="Loading payment details..." />
      </FixedScreen>
    );
  }

  if (!payment) {
    return (
      <FixedScreen header={<BackHeader title="Payment Details" onBack={() => router.back()} />}>
        <EmptyState title="Payment not found" description="Open a payment record from the payments or earnings tabs." />
      </FixedScreen>
    );
  }

  return (
    <FixedScreen header={<BackHeader title="Payment Details" onBack={() => router.back()} />}>
      <SurfaceCard style={{ padding: 0, overflow: "hidden" }}>
        <View style={{ backgroundColor: theme.colors.primaryDark, padding: 20, gap: 14 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: "rgba(255,255,255,0.72)", fontWeight: "700", fontSize: 12 }}>Transaction</Text>
              <Text style={{ color: "#fff", fontSize: 25, fontWeight: "900", marginTop: 6 }}>
                PHP {payment.amount.toLocaleString()}
              </Text>
              <Text style={{ color: "rgba(255,255,255,0.78)", marginTop: 4 }}>
                #{payment.bookingId.replace(/^booking-/, "")}
              </Text>
            </View>
            <StatusBadge status={payment.status} />
          </View>
        </View>

        <View style={{ padding: 18, gap: 14 }}>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1, gap: 10, borderRadius: 18, padding: 14, backgroundColor: theme.colors.surfaceAlt }}>
              <Text style={{ color: theme.colors.textLight, fontSize: 12, fontWeight: "700" }}>Customer</Text>
              <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
                <Avatar image={customer?.profilePhoto} size={42} />
                <Text style={{ color: theme.colors.text, fontWeight: "800", flex: 1 }}>{customer?.fullName || "Customer"}</Text>
              </View>
            </View>
            <View style={{ flex: 1, gap: 10, borderRadius: 18, padding: 14, backgroundColor: theme.colors.surfaceAlt }}>
              <Text style={{ color: theme.colors.textLight, fontSize: 12, fontWeight: "700" }}>Provider</Text>
              <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
                <Avatar image={provider?.profilePhoto} size={42} icon="briefcase-outline" />
                <Text style={{ color: theme.colors.text, fontWeight: "800", flex: 1 }}>{provider?.fullName || "Provider"}</Text>
              </View>
            </View>
          </View>

          {[
            { icon: "card-outline", label: "Payment method", value: payment.method },
            { icon: "time-outline", label: "Recorded at", value: payment.createdAt },
            { icon: "construct-outline", label: "Service", value: booking?.serviceName || "Service record" },
            { icon: "calendar-outline", label: "Scheduled", value: booking?.scheduledAt || "Not available" },
            { icon: "location-outline", label: "Location", value: booking?.address || booking?.location || "Not available" }
          ].map((item) => (
            <View key={item.label} style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
              <View
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 14,
                  backgroundColor: theme.colors.surfaceAlt,
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <Ionicons name={item.icon as keyof typeof Ionicons.glyphMap} size={18} color={theme.colors.primaryDark} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.colors.textLight, fontSize: 12, fontWeight: "700" }}>{item.label}</Text>
                <Text style={{ color: theme.colors.text, fontWeight: "800", marginTop: 4 }}>{item.value}</Text>
              </View>
            </View>
          ))}
        </View>
      </SurfaceCard>
    </FixedScreen>
  );
}
