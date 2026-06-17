import { createEffect, onCleanup, type JSX } from "solid-js"
import { createSignal } from "solid-js"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { getLoginUrl } from "@/pages/store/lib/auth"
import { Modal } from "@/components/modal"
import { useLanguage } from "@/context/language"
import { GUARDED_ROUTES } from "@/routes"

type ShowFn = (el: () => JSX.Element, onClose?: () => void) => void

let show: ShowFn | null = null
let busy = false

export function registerDialog(s: ShowFn) {
  show = s
}

/** Only show session-expired dialog on AuthGuard-protected routes */
function isGuarded() {
  return GUARDED_ROUTES.some((p) => window.location.pathname.startsWith(p))
}

/** Skip auth-me checks so "not logged in" doesn't trigger the dialog */
function skip(path?: string) {
  return path?.includes("/auth/me")
}

export function onUnauthorized(path?: string) {
  if (busy || !show || skip(path) || !isGuarded()) return
  busy = true
  show(() => <SessionExpired />, () => { busy = false })
}

export function SessionExpiredProvider(props: { children: JSX.Element }) {
  const dialog = useDialog()
  registerDialog(dialog.show)
  return props.children
}

function SessionExpired() {
  const dialog = useDialog()
  const language = useLanguage()
  const [count, setCount] = createSignal(30)
  const url = getLoginUrl(window.location.pathname)

  createEffect(() => {
    const t = setInterval(() => {
      setCount((c) => {
        if (c <= 1) {
          clearInterval(t)
          window.location.href = url
          return 0
        }
        return c - 1
      })
    }, 1000)
    onCleanup(() => clearInterval(t))
  })

  const handleLogin = () => {
    dialog.close()
    window.location.href = url
  }

  return (
    <Modal
      title={language.t("auth.session.expired")}
      maxWidth="440px"
      footer={
        <button class="modal-btn modal-btn-primary" type="button" onClick={handleLogin}>
          {language.t("auth.session.expired.loginNow")}
        </button>
      }
    >
      <div class="modal-section">
        <p style={{ margin: 0 }}>{language.t("auth.session.expired.description")}</p>
        <p style={{ margin: "0.75rem 0 0", "font-size": "0.875rem", color: "var(--text-secondary)" }}>
          {language.t("auth.session.expired.countdown", { count: count() })}
        </p>
      </div>
    </Modal>
  )
}
