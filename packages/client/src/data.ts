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

export interface BubbleControls {
  direction: {
    x: number
    y: number
  }
  coordinates: {
    x: number
    y: number
  }
  speed: number
  paused: boolean
  radius: number
}

export interface Bubble extends Member {
  controls: BubbleControls
}
