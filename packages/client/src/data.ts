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

export interface Bubble extends Member {
  controls: {
    direction: {
      x: number
      y: number
    }
    coordinates: {
      x: number
      y: number
    }
    velocity: number
    radius: number
  }
}
