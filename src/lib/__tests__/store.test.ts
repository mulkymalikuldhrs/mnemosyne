import { describe, it, expect, beforeEach } from 'vitest'
import { useDashboardStore, useNotificationStore } from '../store'

describe('Dashboard Store', () => {
  beforeEach(() => {
    // Reset stores to initial state
    useDashboardStore.setState({
      activeTab: 'overview',
      sidebarCollapsed: false,
    })
  })

  it('should have correct initial state', () => {
    const state = useDashboardStore.getState()
    expect(state.activeTab).toBe('overview')
    expect(state.sidebarCollapsed).toBe(false)
  })

  it('should set active tab', () => {
    useDashboardStore.getState().setActiveTab('hardware')
    expect(useDashboardStore.getState().activeTab).toBe('hardware')
  })

  it('should set active tab to different values', () => {
    const tabs = ['overview', 'hardware', 'telemetry', 'missions', 'agents', 'power']
    for (const tab of tabs) {
      useDashboardStore.getState().setActiveTab(tab)
      expect(useDashboardStore.getState().activeTab).toBe(tab)
    }
  })

  it('should toggle sidebar from false to true', () => {
    expect(useDashboardStore.getState().sidebarCollapsed).toBe(false)
    useDashboardStore.getState().toggleSidebar()
    expect(useDashboardStore.getState().sidebarCollapsed).toBe(true)
  })

  it('should toggle sidebar back from true to false', () => {
    useDashboardStore.getState().toggleSidebar()
    expect(useDashboardStore.getState().sidebarCollapsed).toBe(true)
    useDashboardStore.getState().toggleSidebar()
    expect(useDashboardStore.getState().sidebarCollapsed).toBe(false)
  })

  it('should handle multiple rapid tab changes', () => {
    useDashboardStore.getState().setActiveTab('a')
    useDashboardStore.getState().setActiveTab('b')
    useDashboardStore.getState().setActiveTab('c')
    expect(useDashboardStore.getState().activeTab).toBe('c')
  })

  it('should handle setting same tab value', () => {
    useDashboardStore.getState().setActiveTab('overview')
    useDashboardStore.getState().setActiveTab('overview')
    expect(useDashboardStore.getState().activeTab).toBe('overview')
  })

  it('should maintain independent state for tab and sidebar', () => {
    useDashboardStore.getState().setActiveTab('agents')
    useDashboardStore.getState().toggleSidebar()
    const state = useDashboardStore.getState()
    expect(state.activeTab).toBe('agents')
    expect(state.sidebarCollapsed).toBe(true)
  })
})

describe('Notification Store', () => {
  beforeEach(() => {
    // Reset store to initial state
    useNotificationStore.setState({
      unreadAlerts: 0,
      activeMissions: 0,
      onlineDevices: 0,
      systemHealth: 'unknown',
    })
  })

  it('should have correct initial state', () => {
    const state = useNotificationStore.getState()
    expect(state.unreadAlerts).toBe(0)
    expect(state.activeMissions).toBe(0)
    expect(state.onlineDevices).toBe(0)
    expect(state.systemHealth).toBe('unknown')
  })

  it('should set unread alerts count', () => {
    useNotificationStore.getState().setUnreadAlerts(5)
    expect(useNotificationStore.getState().unreadAlerts).toBe(5)
  })

  it('should set unread alerts to zero', () => {
    useNotificationStore.getState().setUnreadAlerts(10)
    useNotificationStore.getState().setUnreadAlerts(0)
    expect(useNotificationStore.getState().unreadAlerts).toBe(0)
  })

  it('should set active missions count', () => {
    useNotificationStore.getState().setActiveMissions(3)
    expect(useNotificationStore.getState().activeMissions).toBe(3)
  })

  it('should set online devices count', () => {
    useNotificationStore.getState().setOnlineDevices(7)
    expect(useNotificationStore.getState().onlineDevices).toBe(7)
  })

  it('should set system health to healthy', () => {
    useNotificationStore.getState().setSystemHealth('healthy')
    expect(useNotificationStore.getState().systemHealth).toBe('healthy')
  })

  it('should set system health to degraded', () => {
    useNotificationStore.getState().setSystemHealth('degraded')
    expect(useNotificationStore.getState().systemHealth).toBe('degraded')
  })

  it('should set system health to critical', () => {
    useNotificationStore.getState().setSystemHealth('critical')
    expect(useNotificationStore.getState().systemHealth).toBe('critical')
  })

  it('should transition system health through states', () => {
    useNotificationStore.getState().setSystemHealth('healthy')
    expect(useNotificationStore.getState().systemHealth).toBe('healthy')
    useNotificationStore.getState().setSystemHealth('degraded')
    expect(useNotificationStore.getState().systemHealth).toBe('degraded')
    useNotificationStore.getState().setSystemHealth('critical')
    expect(useNotificationStore.getState().systemHealth).toBe('critical')
    useNotificationStore.getState().setSystemHealth('unknown')
    expect(useNotificationStore.getState().systemHealth).toBe('unknown')
  })

  it('should maintain independent state for different properties', () => {
    useNotificationStore.getState().setUnreadAlerts(3)
    useNotificationStore.getState().setActiveMissions(2)
    useNotificationStore.getState().setOnlineDevices(5)
    useNotificationStore.getState().setSystemHealth('healthy')
    const state = useNotificationStore.getState()
    expect(state.unreadAlerts).toBe(3)
    expect(state.activeMissions).toBe(2)
    expect(state.onlineDevices).toBe(5)
    expect(state.systemHealth).toBe('healthy')
  })

  it('should handle large alert counts', () => {
    useNotificationStore.getState().setUnreadAlerts(9999)
    expect(useNotificationStore.getState().unreadAlerts).toBe(9999)
  })
})
