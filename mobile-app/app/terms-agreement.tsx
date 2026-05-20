import { router } from "expo-router";
import { BackHeader, FixedScreen } from "../src/components";
import { TermsAgreementView } from "../src/components/TermsAgreement";

export default function TermsAgreementScreen() {
  return (
    <FixedScreen header={<BackHeader title="Terms and Agreement" onBack={() => router.back()} />}>
      <TermsAgreementView />
    </FixedScreen>
  );
}
