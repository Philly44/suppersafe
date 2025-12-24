import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export interface PushToken {
  id: string;
  user_id: string;
  token: string;
  platform: 'ios' | 'android';
  created_at: string;
  updated_at: string;
}

// Request notification permissions and get push token
export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    console.log('Push notifications require a physical device');
    return null;
  }

  // Check existing permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // Request permissions if not granted
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Push notification permission denied');
    return null;
  }

  // Get the Expo push token
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({
      projectId,
    });

    // Configure Android channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Restaurant Alerts',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#2D5A3D',
      });
    }

    return token;
  } catch (error) {
    console.error('Error getting push token:', error);
    return null;
  }
}

// Save push token to Supabase
export async function savePushToken(token: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Must be logged in to register for notifications');
  }

  const platform = Platform.OS as 'ios' | 'android';

  // Upsert the token (update if exists, insert if not)
  const { error } = await supabase
    .from('push_tokens')
    .upsert(
      {
        user_id: user.id,
        token,
        platform,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id,platform',
      }
    );

  if (error) throw error;
}

// Remove push token from Supabase
export async function removePushToken(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const platform = Platform.OS;

  const { error } = await supabase
    .from('push_tokens')
    .delete()
    .eq('user_id', user.id)
    .eq('platform', platform);

  if (error) throw error;
}

// Check if notifications are enabled
export async function getNotificationStatus(): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted';
}

// Add notification response listener
export function addNotificationResponseListener(
  callback: (response: Notifications.NotificationResponse) => void
): Notifications.Subscription {
  return Notifications.addNotificationResponseReceivedListener(callback);
}

// Add notification received listener
export function addNotificationReceivedListener(
  callback: (notification: Notifications.Notification) => void
): Notifications.Subscription {
  return Notifications.addNotificationReceivedListener(callback);
}

// Schedule a local notification (for testing)
export async function scheduleLocalNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<string> {
  return await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
    },
    trigger: null, // Send immediately
  });
}
