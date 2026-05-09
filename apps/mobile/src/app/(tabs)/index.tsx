import { View, Text, SectionList, RefreshControl, Pressable } from "react-native";
import { useState, useMemo, useCallback } from "react";
import { useBookings, type BookingWithId } from "@/hooks/useBookings";
import { usePhotographer } from "@/hooks/usePhotographer";
import { BookingCard } from "@/components/BookingCard";
import { SkeletonLoader, Button } from "@/components/ui";
import { darkColors } from "@/theme/colors";
import { Briefcase, ChevronDown, ChevronRight } from "lucide-react-native";
import {
  PHOTOGRAPHER_ACTION_STATUSES,
  WAITING_ON_OTHERS_STATUSES,
  COMPLETED_STATUSES,
} from "@shotready/shared/src/constants/booking-status";
import * as Clipboard from "expo-clipboard";

const ACTION_PRIORITY: Record<string, number> = {
  pending: 0,
  overdue: 1,
  shooting: 2,
  editing: 3,
  delivered: 4,
  confirmed: 5,
};

function sortActionBucket(a: BookingWithId, b: BookingWithId): number {
  const pa = ACTION_PRIORITY[a.status] ?? 99;
  const pb = ACTION_PRIORITY[b.status] ?? 99;
  if (pa !== pb) return pa - pb;
  return a.updatedAt.seconds - b.updatedAt.seconds;
}

function sortWaitingBucket(a: BookingWithId, b: BookingWithId): number {
  return b.updatedAt.seconds - a.updatedAt.seconds;
}

function sortCompletedBucket(a: BookingWithId, b: BookingWithId): number {
  return b.updatedAt.seconds - a.updatedAt.seconds;
}

interface Section {
  title: string;
  count: number;
  data: BookingWithId[];
  collapsed?: boolean;
}

export default function JobsScreen() {
  const { bookings, isLoading } = useBookings();
  const { photographer } = usePhotographer();
  const [refreshing, setRefreshing] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [copied, setCopied] = useState(false);

  const { actionItems, waitingItems, completedItems } = useMemo(() => {
    const action: BookingWithId[] = [];
    const waiting: BookingWithId[] = [];
    const completed: BookingWithId[] = [];

    for (const b of bookings) {
      if ((PHOTOGRAPHER_ACTION_STATUSES as readonly string[]).includes(b.status)) {
        action.push(b);
      } else if ((WAITING_ON_OTHERS_STATUSES as readonly string[]).includes(b.status)) {
        waiting.push(b);
      } else if ((COMPLETED_STATUSES as readonly string[]).includes(b.status)) {
        completed.push(b);
      }
    }

    action.sort(sortActionBucket);
    waiting.sort(sortWaitingBucket);
    completed.sort(sortCompletedBucket);

    return {
      actionItems: action,
      waitingItems: waiting,
      completedItems: completed.slice(0, 30),
    };
  }, [bookings]);

  const sections: Section[] = useMemo(() => {
    const s: Section[] = [
      { title: "Needs Your Action", count: actionItems.length, data: actionItems },
      { title: "Waiting on Others", count: waitingItems.length, data: waitingItems },
    ];
    if (completedItems.length > 0) {
      s.push({
        title: "Completed",
        count: completedItems.length,
        data: showCompleted ? completedItems : [],
        collapsed: !showCompleted,
      });
    }
    return s;
  }, [actionItems, waitingItems, completedItems, showCompleted]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 500);
  }, []);

  async function handleCopyLink() {
    if (!photographer?.bookingSlug) return;
    await Clipboard.setStringAsync(`https://shotready.app/book/${photographer.bookingSlug}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (isLoading) {
    return (
      <View className="flex-1 bg-background px-lg pt-lg">
        <View className="flex-row items-center justify-between mb-lg">
          <Text className="text-h2 text-text-primary">Jobs</Text>
        </View>
        {[1, 2, 3].map((i) => (
          <View key={i} className="mb-md">
            <SkeletonLoader height={80} borderRadius={12} />
          </View>
        ))}
      </View>
    );
  }

  if (bookings.length === 0) {
    return (
      <View className="flex-1 bg-background items-center justify-center px-lg">
        <Briefcase size={64} color={darkColors.textMuted} strokeWidth={1.25} />
        <Text className="text-h2 text-text-primary mt-lg">No bookings yet</Text>
        <Text className="text-body text-text-secondary mt-sm text-center">
          Share your booking link with agents to get started
        </Text>
        <View className="mt-lg w-full">
          <Button
            title={copied ? "Copied!" : "Copy Booking Link"}
            variant={copied ? "secondary" : "primary"}
            onPress={handleCopyLink}
          />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerClassName="px-lg pb-2xl"
        stickySectionHeadersEnabled={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={darkColors.accent}
            colors={[darkColors.accent]}
          />
        }
        ListHeaderComponent={
          <View className="flex-row items-center justify-between pt-lg mb-md">
            <Text className="text-h2 text-text-primary">Jobs</Text>
          </View>
        }
        renderSectionHeader={({ section }) => {
          if (section.title === "Completed") {
            return (
              <Pressable
                className="flex-row items-center mt-lg mb-sm"
                onPress={() => setShowCompleted(!showCompleted)}
              >
                <Text className="text-h3 text-text-secondary">
                  {section.title} ({section.count})
                </Text>
                {showCompleted ? (
                  <ChevronDown size={18} color={darkColors.textSecondary} style={{ marginLeft: 4 }} />
                ) : (
                  <ChevronRight size={18} color={darkColors.textSecondary} style={{ marginLeft: 4 }} />
                )}
              </Pressable>
            );
          }
          return (
            <View className="mt-lg mb-sm">
              <Text className="text-h3 text-text-primary">
                {section.title} ({section.count})
              </Text>
            </View>
          );
        }}
        renderItem={({ item }) => (
          <View className="mb-sm">
            <BookingCard booking={item} />
          </View>
        )}
        renderSectionFooter={({ section }) => {
          if (section.title === "Needs Your Action" && section.data.length === 0) {
            return (
              <Text className="text-body text-text-secondary py-md text-center">
                You're all caught up
              </Text>
            );
          }
          if (section.title === "Waiting on Others" && section.data.length === 0) {
            return (
              <Text className="text-body text-text-muted py-md text-center">
                No jobs waiting
              </Text>
            );
          }
          return null;
        }}
      />
    </View>
  );
}
