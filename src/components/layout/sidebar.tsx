'use client'

import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  FileText,
  MessageSquare,
  Search,
  GitBranch,
  Settings,
  Plug,
  ChevronLeft,
  ChevronRight,
  Brain,
} from 'lucide-react'
import { useUIStore, type ActiveSection } from '@/lib/store'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Separator } from '@/components/ui/separator'

const navItems: { icon: React.ElementType; label: string; section: ActiveSection }[] = [
  { icon: LayoutDashboard, label: 'Dashboard', section: 'dashboard' },
  { icon: FileText, label: 'Notes', section: 'notes' },
  { icon: MessageSquare, label: 'Chat', section: 'chat' },
  { icon: Search, label: 'Search', section: 'search' },
  { icon: GitBranch, label: 'Decisions', section: 'decisions' },
  { icon: Plug, label: 'MCP Server', section: 'mcp' },
  { icon: Settings, label: 'Settings', section: 'settings' },
]

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar, activeSection, setActiveSection } = useUIStore()

  return (
    <motion.aside
      initial={false}
      animate={{ width: sidebarCollapsed ? 68 : 240 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className="relative flex flex-col border-r border-border bg-card h-full overflow-hidden shrink-0"
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 h-16 shrink-0">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary text-primary-foreground shrink-0">
          <Brain className="w-5 h-5" />
        </div>
        <AnimatePresence>
          {!sidebarCollapsed && (
            <motion.span
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.15 }}
              className="font-semibold text-lg tracking-tight whitespace-nowrap"
            >
              Memorix
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <Separator />

      {/* Navigation */}
      <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = activeSection === item.section
          const Icon = item.icon

          const button = (
            <Button
              key={item.section}
              variant={isActive ? 'secondary' : 'ghost'}
              className={cn(
                'w-full justify-start gap-3 h-10 px-3 transition-all duration-150',
                isActive && 'bg-primary/10 text-primary font-medium',
                !isActive && 'text-muted-foreground hover:text-foreground',
                sidebarCollapsed && 'justify-center px-0'
              )}
              onClick={() => setActiveSection(item.section)}
            >
              <Icon className={cn('w-[18px] h-[18px] shrink-0', isActive && 'text-primary')} />
              <AnimatePresence>
                {!sidebarCollapsed && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.15 }}
                    className="whitespace-nowrap overflow-hidden"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </Button>
          )

          if (sidebarCollapsed) {
            return (
              <Tooltip key={item.section} delayDuration={0}>
                <TooltipTrigger asChild>{button}</TooltipTrigger>
                <TooltipContent side="right" className="font-medium">
                  {item.label}
                </TooltipContent>
              </Tooltip>
            )
          }

          return button
        })}
      </nav>

      <Separator />

      {/* Collapse Toggle */}
      <div className="p-2 flex justify-center">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          onClick={toggleSidebar}
        >
          {sidebarCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </Button>
      </div>
    </motion.aside>
  )
}
