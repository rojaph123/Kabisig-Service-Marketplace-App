import { useCallback, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image, Text, View } from "react-native";
import { communityPostService, type CommunityPost } from "@kabisig/shared";
import { BackHeader, EmptyState, FixedScreen, LoadingState, SurfaceCard } from "../src/components";
import { useAuth } from "../src/hooks/AuthProvider";
import { theme } from "../src/theme";

function getPostImageUris(post: CommunityPost) {
  return (post.attachmentItems?.length ? post.attachmentItems.map((media) => media.url) : post.attachments) || [];
}

export default function PostHistoryScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<CommunityPost[]>([]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      const unsubscribe = communityPostService.subscribePosts((items) => {
        setPosts(user?.id ? items.filter((post) => post.customerId === user.id) : []);
        setLoading(false);
      });

      return unsubscribe;
    }, [user?.id])
  );

  return (
    <FixedScreen style={{ backgroundColor: theme.colors.background }} header={<BackHeader title="My Request History" onBack={() => router.back()} />}>
      {loading ? (
        <LoadingState label="Loading your posts..." />
      ) : posts.length ? (
        <View style={{ gap: 10 }}>
          {posts.map((post) => {
            const images = getPostImageUris(post);
            return (
              <SurfaceCard key={post.postId} style={{ gap: 9, padding: 12 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.colors.text, fontSize: 14, fontWeight: "900" }} numberOfLines={1}>
                      {post.body.trim().split(/\n+/)[0] || post.serviceName}
                    </Text>
                    <Text style={{ color: theme.colors.textMuted, marginTop: 3, fontSize: 11 }}>
                      {new Date(post.createdAt).toLocaleString()}
                    </Text>
                  </View>
                  <View style={{ borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5, backgroundColor: post.status === "Open" ? theme.colors.successSoft : theme.colors.surfaceAlt }}>
                    <Text style={{ color: post.status === "Open" ? theme.colors.success : theme.colors.textMuted, fontSize: 10, fontWeight: "900" }}>{post.status}</Text>
                  </View>
                </View>

                <Text style={{ color: theme.colors.text, fontSize: 12, lineHeight: 18 }} numberOfLines={3}>
                  {post.body}
                </Text>

                <View style={{ borderRadius: 12, padding: 9, gap: 4, backgroundColor: theme.colors.surfaceAlt }}>
                  <Text style={{ color: theme.colors.primaryDark, fontWeight: "900", fontSize: 12 }}>Job type: {post.serviceName}</Text>
                  <Text style={{ color: theme.colors.textMuted, fontSize: 11 }}>Schedule: {post.preferredSchedule || "Flexible schedule"}</Text>
                  <Text style={{ color: theme.colors.textMuted, fontSize: 11 }} numberOfLines={1}>Location: {post.address}</Text>
                </View>

                {images.length ? (
                  <View style={{ flexDirection: "row", gap: 6 }}>
                    {images.slice(0, 3).map((uri, index) => (
                      <View key={`${post.postId}-${uri}-${index}`} style={{ width: 62, height: 62 }}>
                        <Image source={{ uri }} style={{ width: 62, height: 62, borderRadius: 12, backgroundColor: theme.colors.surfaceAlt }} />
                        {index === 2 && images.length > 3 ? (
                          <View style={{ position: "absolute", inset: 0, borderRadius: 12, backgroundColor: "rgba(15,23,42,0.56)", alignItems: "center", justifyContent: "center" }}>
                            <Text style={{ color: "#fff", fontWeight: "900" }}>+{images.length - 3}</Text>
                          </View>
                        ) : null}
                      </View>
                    ))}
                  </View>
                ) : null}

                <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
                  <View style={{ flexDirection: "row", gap: 5, alignItems: "center" }}>
                    <Ionicons name="thumbs-up-outline" size={14} color={theme.colors.textMuted} />
                    <Text style={{ color: theme.colors.textMuted, fontSize: 11, fontWeight: "800" }}>{post.likes.length} likes</Text>
                  </View>
                  <View style={{ flexDirection: "row", gap: 5, alignItems: "center" }}>
                    <Ionicons name="chatbubble-outline" size={14} color={theme.colors.textMuted} />
                    <Text style={{ color: theme.colors.textMuted, fontSize: 11, fontWeight: "800" }}>{post.comments.length} comments</Text>
                  </View>
                </View>
              </SurfaceCard>
            );
          })}
        </View>
      ) : (
        <EmptyState title="No request history yet" description="Your own service requests will appear here, separate from the public news feed." icon="newspaper-outline" />
      )}
    </FixedScreen>
  );
}
