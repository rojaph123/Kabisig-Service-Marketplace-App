"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, DataTable, EmptyPanel, FilterBar, SearchInput, Select, StatusBadge, Topbar } from "../../../components/ui";
import { subscribeMarketplaceSnapshot, type MarketplaceSnapshot } from "../../../lib/marketplace-data";

export default function UsersPage() {
  const [snapshot, setSnapshot] = useState<MarketplaceSnapshot | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [approvalFilter, setApprovalFilter] = useState("all");

  useEffect(() => {
    return subscribeMarketplaceSnapshot(setSnapshot);
  }, []);

  const approvalByUserId = useMemo(
    () =>
      new Map(
        (snapshot?.providerProfiles ?? []).map((profile) => [profile.userId, profile.approvalStatus])
      ),
    [snapshot]
  );
  const filteredUsers = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    const users = snapshot?.users ?? [];
    return users.filter((user) =>
      (roleFilter === "all" || user.role === roleFilter) &&
      (approvalFilter === "all" ||
        (user.role === "provider" && (approvalByUserId.get(user.id) || "Draft") === approvalFilter) ||
        (user.role !== "provider" && approvalFilter === "Active")) &&
      (
        !normalized ||
        [user.fullName, user.email, user.role, approvalByUserId.get(user.id)]
          .join(" ")
          .toLowerCase()
          .includes(normalized)
      )
    );
  }, [approvalByUserId, approvalFilter, roleFilter, search, snapshot?.users]);

  return (
    <>
      <Topbar title="Users management" />
      <FilterBar>
        <SearchInput placeholder="Search customer or provider..." value={search} onChange={(event) => setSearch(event.target.value)} />
        <Select
          label="Role"
          value={roleFilter}
          onChange={(event) => setRoleFilter(event.target.value)}
          options={[
            { label: "All roles", value: "all" },
            { label: "Customer", value: "customer" },
            { label: "Provider", value: "provider" },
            { label: "Admin", value: "admin" },
          ]}
        />
        <Select
          label="Status"
          value={approvalFilter}
          onChange={(event) => setApprovalFilter(event.target.value)}
          options={[
            { label: "All statuses", value: "all" },
            { label: "Active", value: "Active" },
            { label: "Draft", value: "Draft" },
            { label: "Pending Approval", value: "Pending Approval" },
            { label: "Revision Requested", value: "Revision Requested" },
            { label: "Approved", value: "Approved" },
            { label: "Rejected", value: "Rejected" },
          ]}
        />
      </FilterBar>
      <Card title="Marketplace users">
        {filteredUsers.length ? (
          <DataTable
            columns={["Name", "Email", "Role", "Approval", "Created"]}
            rows={filteredUsers.map((user) => [
              user.fullName,
              user.email,
              user.role,
              user.role === "provider" ? (
                <StatusBadge key={user.id} status={approvalByUserId.get(user.id) || "Draft"} />
              ) : (
                <StatusBadge key={user.id} status="Active" />
              ),
              user.createdAt,
            ])}
          />
        ) : (
          <EmptyPanel title="No users yet" description="Registered customers, providers, and admins will appear here as soon as accounts are created." />
        )}
      </Card>
    </>
  );
}
