import { create } from 'zustand'

interface DashboardState {
  activeTab: string
  sidebarCollapsed: boolean
  setActiveTab: (tab: string) => void
  toggleSidebar: () => void
}

export const useDashboardStore = create<DashboardState>((set) => ({
  activeTab: 'overview',
  sidebarCollapsed: false,
  setActiveTab: (tab) => set({ activeTab: tab }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
}))

interface NotificationState {
  unreadAlerts: number
  activeMissions: number
  onlineDevices: number
  systemHealth: 'healthy' | 'degraded' | 'critical' | 'unknown'
  setUnreadAlerts: (count: number) => void
  setActiveMissions: (count: number) => void
  setOnlineDevices: (count: number) => void
  setSystemHealth: (health: 'healthy' | 'degraded' | 'critical' | 'unknown') => void
}

export const useNotificationStore = create<NotificationState>((set) => ({
  unreadAlerts: 0,
  activeMissions: 0,
  onlineDevices: 0,
  systemHealth: 'unknown',
  setUnreadAlerts: (count) => set({ unreadAlerts: count }),
  setActiveMissions: (count) => set({ activeMissions: count }),
  setOnlineDevices: (count) => set({ onlineDevices: count }),
  setSystemHealth: (health) => set({ systemHealth: health }),
}))
