/**
 * Root app component with React Navigation.
 *
 * Two top-level stacks: a stack containing the Login screen, and a stack
 * containing the main tabs. The choice is driven by whether an access
 * token is in storage, so the Login -> Tabs transition is just a state
 * flip (and the reverse on logout).
 */
import { StatusBar } from 'expo-status-bar'
import { NavigationContainer } from '@react-navigation/native'
import { createStackNavigator } from '@react-navigation/stack'
import { useState, useEffect } from 'react'
import { View, ActivityIndicator, StyleSheet } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'

// Screens
import LoginScreen from './src/screens/Login'
import HomeScreen from './src/screens/Home'
import AssistantScreen from './src/screens/Assistant'
import RequestsScreen from './src/screens/Requests'
import MemoryScreen from './src/screens/Memory'

// Navigation setup
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { MaterialCommunityIcons } from '@expo/vector-icons'

// Storage
import { getAccessToken, clearAuth } from './src/lib/storage'
import { AuthContext } from './src/components/AuthContext'

const Tab = createBottomTabNavigator()
const Stack = createStackNavigator()

// Map each tab route to a MaterialCommunityIcons name. Keeps the icon
// registry single-sourced so adding a new tab is a one-line change.
const TAB_ICONS: Record<string, string> = {
  Home: 'home-outline',
  Assistant: 'robot-outline',
  Requests: 'format-list-bulleted',
  Memory: 'star-four-points-outline',
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#4f46e5',
        tabBarInactiveTintColor: '#6b7280',
        tabBarStyle: {
          backgroundColor: '#ffffff',
          height: 64,
          paddingBottom: 8,
          paddingTop: 6,
          borderTopWidth: 1,
          borderTopColor: '#e5e7eb',
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        tabBarIcon: ({ color, size }) => {
          const name = TAB_ICONS[route.name] ?? 'circle-outline'
          return <MaterialCommunityIcons name={name as any} size={size ?? 22} color={color} />
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: 'Home' }} />
      <Tab.Screen
        name="Assistant"
        component={AssistantScreen}
        options={{ tabBarLabel: 'Assistant' }}
      />
      <Tab.Screen
        name="Requests"
        component={RequestsScreen}
        options={{ tabBarLabel: 'Requests' }}
      />
      <Tab.Screen
        name="Memory"
        component={MemoryScreen}
        options={{ tabBarLabel: 'Preferences' }}
      />
    </Tab.Navigator>
  )
}

export default function App() {
  // null = still loading the token; true = logged in; false = not logged in.
  const [hasToken, setHasToken] = useState<boolean | null>(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const token = await getAccessToken()
      if (mounted) setHasToken(!!token)
    })()
    return () => {
      mounted = false
    }
  }, [])

  // Replace the AppRouter + LoginScreen logout-reset dance with a clean
  // auth-state swap. Tabs never know about Login; Login never knows about
  // tabs. Logout just clears the token and flips the state.
  async function handleLogout() {
    await clearAuth()
    setHasToken(false)
  }

  if (hasToken === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    )
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <NavigationContainer>
        <AuthContext.Provider value={{ onLogout: handleLogout }}>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            {hasToken ? (
              <Stack.Screen name="Main">
                {() => <MainTabs />}
              </Stack.Screen>
            ) : (
              <Stack.Screen name="Login">
                {() => <LoginScreen onLoginSuccess={() => setHasToken(true)} />}
              </Stack.Screen>
            )}
          </Stack.Navigator>
        </AuthContext.Provider>
      </NavigationContainer>
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8f9fc',
  },
})
