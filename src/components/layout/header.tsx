'use client'

import { Brain, Search, Moon, Sun, LogOut, User, Settings } from 'lucide-react'
import { useSession, signOut } from 'next-auth/react'
import { useTheme } from 'next-themes'
import { useUIStore } from '@/lib/store'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function Header() {
  const { theme, setTheme } = useTheme()
  const { setActiveSection } = useUIStore()
  const { data: session } = useSession()

  const userName = session?.user?.name || 'User'
  const userEmail = session?.user?.email || ''
  const userInitial = userName.charAt(0).toUpperCase()

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const q = formData.get('q') as string
    if (q?.trim()) {
      setActiveSection('search')
    }
  }

  const handleLogout = async () => {
    await signOut({ callbackUrl: '/login' })
  }

  return (
    <header className="flex items-center gap-4 h-16 px-4 md:px-6 border-b border-border bg-card/50 backdrop-blur-sm shrink-0">
      {/* Mobile Logo */}
      <div className="flex items-center gap-2 md:hidden">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground">
          <Brain className="w-4 h-4" />
        </div>
        <span className="font-semibold text-base">Mnemosyne</span>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearch} className="flex-1 max-w-md hidden md:block">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            name="q"
            placeholder="Search memories... (⌘K)"
            className="pl-9 bg-muted/50 border-0 focus-visible:ring-1 h-9"
          />
        </div>
      </form>

      {/* Mobile Search Button */}
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden text-muted-foreground"
        onClick={() => setActiveSection('search')}
      >
        <Search className="w-5 h-5" />
      </Button>

      <div className="flex-1 md:flex-none" />

      {/* Theme Toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 text-muted-foreground hover:text-foreground"
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      >
        {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </Button>

      {/* User Avatar Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-9 w-9 rounded-full">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                {userInitial}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <div className="px-2 py-1.5">
            <p className="text-sm font-medium">{userName}</p>
            <p className="text-xs text-muted-foreground">{userEmail}</p>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem>
            <User className="mr-2 h-4 w-4" />
            Profile
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setActiveSection('settings')}>
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
