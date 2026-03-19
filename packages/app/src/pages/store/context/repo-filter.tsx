import { createContext, useContext, createSignal, type JSX } from "solid-js"
import type { Repository } from "../lib/api"

interface RepoFilterContextValue {
  selectedRepo: () => Repository | null
  setSelectedRepo: (repo: Repository | null) => void
}

const RepoFilterContext = createContext<RepoFilterContextValue>({
  selectedRepo: () => null,
  setSelectedRepo: () => {},
})

export function RepoFilterProvider(props: { children: JSX.Element }) {
  const [repo, setRepo] = createSignal<Repository | null>(null)
  return (
    <RepoFilterContext.Provider value={{ selectedRepo: repo, setSelectedRepo: setRepo }}>
      {props.children}
    </RepoFilterContext.Provider>
  )
}

export function useRepoFilter() {
  return useContext(RepoFilterContext)
}
