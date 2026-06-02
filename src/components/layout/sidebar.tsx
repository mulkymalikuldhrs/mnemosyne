'use client'

import { useState, useEffect } from 'react'
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
  Network,
  Calendar,
  LayoutGrid,
  FileCode2,
  Star,
  ChevronDown,
} from 'lucide-react'
import { useUIStore, useNotesStore, useFavoritesStore, type ActiveSection } from '@/lib/store'
import { api } from '@/lib/api'
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
  { icon: Network, label: 'Knowledge Graph', section: 'graph' },
  { icon: Calendar, label: 'Daily Notes', section: 'daily' },
  { icon: LayoutGrid, label: 'Canvas', section: 'canvas' },
  { icon: FileCode2, label: 'Templates', section: 'templates' },
  { icon: GitBranch, label: 'Decisions', section: 'decisions' },
  { icon: Plug, label: 'MCP Server', section: 'mcp' },
  { icon: Settings, label: 'Settings', section: 'settings' },
]

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar, activeSection, setActiveSection } = useUIStore()
  const { notes } = useNotesStore()
  const { favoriteNoteIds, setFavoriteNoteIds } = useFavoritesStore()
  const [favoritesOpen, setFavoritesOpen] = useState(true)

  // Fetch favorites on mount
  useEffect(() => {
    const fetchFavorites = async () => {
      try {
        const res = await api.getFavorites()
        if (res.success && res.data?.favorites) {
          setFavoriteNoteIds(res.data.favorites.map((f: any) => f.noteId))
        }
      } catch (err) {
        console.error('Failed to fetch favorites:', err)
      }
    }
    fetchFavorites()
  }, [setFavoriteNoteIds])

  // Get favorited notes
  const favoriteNotes = notes.filter((n) => favoriteNoteIds.includes(n.id))

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

        {/* Favorites Section */}
        {!sidebarCollapsed && favoriteNotes.length > 0 && (
          <>
            <Separator className="my-2" />
            <div className="px-2">
              <button
                onClick={() => setFavoritesOpen(!favoritesOpen)}
                className="w-full flex items-center gap-2 px-1 py-1.5 text-[10px] text-muted-foreground uppercase tracking-wider font-medium hover:text-foreground transition-colors"
              >
                <Star className="w-3 h-3 text-amber-500 shrink-0" />
                <span className="flex-1 text-left">Favorites</span>
                <ChevronDown
                  className={cn(
                    'w-3 h-3 transition-transform',
                    !favoritesOpen && '-rotate-90'
                  )}
                />
              </button>

              <AnimatePresence>
                {favoritesOpen && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.15 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-0.5 max-h-48 overflow-y-auto">
                      {favoriteNotes.map((note) => (
                        <Button
                          key={note.id}
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start gap-2 h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => setActiveSection('notes')}
                        >
                          <Star className="w-3 h-3 text-amber-500 shrink-0 fill-amber-500" />
                          <span className="truncate">{note.title}</span>
                        </Button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </>
        )}

        {sidebarCollapsed && favoriteNotes.length > 0 && (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-center px-0 h-10 text-muted-foreground hover:text-foreground"
                onClick={() => setActiveSection('notes')}
              >
                <Star className="w-[18px] h-[18px] text-amber-500" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" className="font-medium">
              {favoriteNotes.length} Favorite{favoriteNotes.length !== 1 ? 's' : ''}
            </TooltipContent>
          </Tooltip>
        )}
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
