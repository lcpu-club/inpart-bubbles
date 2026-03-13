export interface Member {
  about: {
    name: string
    hobbies: string[]
    skills: string[]
    avatar: string
  }
  social?: {
    github?: string
    website?: string
  }
}

export interface FormPersistedData {
  time: number
  member: Member
}