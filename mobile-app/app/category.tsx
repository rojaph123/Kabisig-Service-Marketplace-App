import { useEffect, useMemo, useState } from "react";
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { categoryService, type ServiceCategory } from "@kabisig/shared";
import { Ionicons } from "@expo/vector-icons";
import { BackHeader, EmptyState, FixedScreen, SearchBar } from "../src/components";
import { theme } from "../src/theme";
import { getServiceVisual } from "../src/utils/services";

export default function CategoryScreen() {
  const [query, setQuery] = useState("");
  const [categories, setCategories] = useState<ServiceCategory[]>([]);

  useEffect(() => {
    void categoryService.getAllCategories().then(setCategories);
  }, []);

  const filteredCategories = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return categories;

    return categories.filter((category) =>
      [category.name, category.description].join(" ").toLowerCase().includes(normalized)
    );
  }, [categories, query]);

  return (
    <FixedScreen style={{ backgroundColor: theme.colors.background }} header={<BackHeader title="Service Categories" onBack={() => router.back()} />}>
      <SearchBar placeholder="Search category..." value={query} onChangeText={setQuery} />

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
        {filteredCategories.map((category) => {
          const visual = getServiceVisual(category.name, category.icon);
          return (
            <Pressable
              key={category.id}
              onPress={() =>
                router.push({
                  pathname: "/booking-request",
                  params: { categoryId: category.id },
                })
              }
              style={{
                width: "47%",
                borderRadius: 24,
                padding: 18,
                backgroundColor: theme.colors.card,
                borderWidth: 1,
                borderColor: theme.colors.border,
                gap: 12,
                ...theme.shadow,
              }}
            >
              <View
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: 18,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: visual.bg
                }}
              >
                <Ionicons name={visual.icon} size={24} color={visual.tint} />
              </View>
              <Text style={{ color: theme.colors.text, fontWeight: "800", fontSize: 16 }}>
                {category.name}
              </Text>
              <Text style={{ color: theme.colors.textMuted, lineHeight: 20 }}>
                {category.description || "Description coming soon."}
              </Text>
              <Text style={{ color: theme.colors.primary, fontWeight: "700" }}>
                From PHP {category.startingPrice.toLocaleString()}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {!filteredCategories.length ? (
        <EmptyState
          title="No categories found"
          description="Create service categories in the admin panel and they will appear here for mobile users."
        />
      ) : null}
    </FixedScreen>
  );
}
