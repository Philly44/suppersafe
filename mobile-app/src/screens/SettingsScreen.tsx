import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

export default function SettingsScreen() {
  const [notificationsEnabled, setNotificationsEnabled] = React.useState(true);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.content}>
        {/* Notifications Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="notifications" size={24} color="#2D5A3D" />
              <View style={styles.settingText}>
                <Text style={styles.settingLabel}>Push Notifications</Text>
                <Text style={styles.settingDesc}>Get alerts for saved restaurants</Text>
              </View>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: '#E8E4DD', true: '#2D5A3D' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* About Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>

          <TouchableOpacity
            style={styles.linkItem}
            onPress={() => Linking.openURL('https://suppersafe.com/privacy.html')}
          >
            <Ionicons name="shield-checkmark-outline" size={24} color="#6B665C" />
            <Text style={styles.linkText}>Privacy Policy</Text>
            <Ionicons name="chevron-forward" size={20} color="#A09A8F" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkItem}
            onPress={() => Linking.openURL('https://suppersafe.com/terms.html')}
          >
            <Ionicons name="document-text-outline" size={24} color="#6B665C" />
            <Text style={styles.linkText}>Terms of Service</Text>
            <Ionicons name="chevron-forward" size={20} color="#A09A8F" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkItem}
            onPress={() => Linking.openURL('mailto:hello@suppersafe.com')}
          >
            <Ionicons name="mail-outline" size={24} color="#6B665C" />
            <Text style={styles.linkText}>Contact Us</Text>
            <Ionicons name="chevron-forward" size={20} color="#A09A8F" />
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.logoContainer}>
            <View style={styles.logoMark}>
              <View style={styles.logoInner} />
            </View>
            <Text style={styles.logoText}>suppersafe</Text>
          </View>
          <Text style={styles.footerText}>No ads. No data sales. Ever.</Text>
          <Text style={styles.version}>Version 1.0.0</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF9F7',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B665C',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  settingText: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  settingDesc: {
    fontSize: 13,
    color: '#6B665C',
  },
  linkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    gap: 14,
  },
  linkText: {
    flex: 1,
    fontSize: 16,
    color: '#1a1a1a',
  },
  footer: {
    marginTop: 'auto',
    alignItems: 'center',
    paddingTop: 24,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  logoMark: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#6B665C',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2D5A3D',
  },
  logoText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6B665C',
  },
  footerText: {
    fontSize: 13,
    color: '#A09A8F',
    marginBottom: 4,
  },
  version: {
    fontSize: 12,
    color: '#A09A8F',
  },
});
