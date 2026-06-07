import 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name: string
      plan?: string
    }
  }

  interface User {
    id: string
    email: string
    name: string
    plan?: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    plan?: string
  }
}
