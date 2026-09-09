export type RootParamList = {
  Login: undefined
  Home: undefined
  Assistant: undefined
  Requests: { code?: string; title?: string } | undefined
  Memory: undefined
}

declare global {
  namespace ReactNavigation {
    interface RootParamList {
      Login: undefined
      Home: undefined
      Assistant: undefined
      Requests: { code?: string; title?: string } | undefined
      Memory: undefined
    }
  }
}
