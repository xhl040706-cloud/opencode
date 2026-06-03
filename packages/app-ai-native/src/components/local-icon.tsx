import { splitProps, type ComponentProps } from "solid-js"

const localIcons = {
  home: `<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><polyline points="9 22 9 12 15 12 15 22" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
  bell: `<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
  "bell-filled": `<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M13.73 21a2 2 0 0 1-3.46 0" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
  star: `<path d="M13.7276 3.44418L15.4874 6.99288C15.7274 7.48687 16.3673 7.9607 16.9073 8.05143L20.0969 8.58575C22.1367 8.92853 22.6167 10.4206 21.1468 11.8925L18.6671 14.3927C18.2471 14.8161 18.0172 15.6327 18.1471 16.2175L18.8571 19.3125C19.417 21.7623 18.1271 22.71 15.9774 21.4296L12.9877 19.6452C12.4478 19.3226 11.5579 19.3226 11.0079 19.6452L8.01827 21.4296C5.8785 22.71 4.57865 21.7522 5.13859 19.3125L5.84851 16.2175C5.97849 15.6327 5.74852 14.8161 5.32856 14.3927L2.84884 11.8925C1.389 10.4206 1.85895 8.92853 3.89872 8.58575L7.08837 8.05143C7.61831 7.9607 8.25824 7.48687 8.49821 6.99288L10.258 3.44418C11.2179 1.51861 12.7777 1.51861 13.7276 3.44418Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`,
  "star-filled": `<path d="M13.7276 3.44418L15.4874 6.99288C15.7274 7.48687 16.3673 7.9607 16.9073 8.05143L20.0969 8.58575C22.1367 8.92853 22.6167 10.4206 21.1468 11.8925L18.6671 14.3927C18.2471 14.8161 18.0172 15.6327 18.1471 16.2175L18.8571 19.3125C19.417 21.7623 18.1271 22.71 15.9774 21.4296L12.9877 19.6452C12.4478 19.3226 11.5579 19.3226 11.0079 19.6452L8.01827 21.4296C5.8785 22.71 4.57865 21.7522 5.13859 19.3125L5.84851 16.2175C5.97849 15.6327 5.74852 14.8161 5.32856 14.3927L2.84884 11.8925C1.389 10.4206 1.85895 8.92853 3.89872 8.58575L7.08837 8.05143C7.61831 7.9607 8.25824 7.48687 8.49821 6.99288L10.258 3.44418C11.2179 1.51861 12.7777 1.51861 13.7276 3.44418Z" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`,
  download: `<path d="M2.99969 17.0002C2.99969 17.9302 2.99969 18.3952 3.10192 18.7767C3.37932 19.8119 4.18796 20.6206 5.22324 20.898C5.60474 21.0002 6.06972 21.0002 6.99969 21.0002L16.9997 21.0002C17.9297 21.0002 18.3947 21.0002 18.7762 20.898C19.8114 20.6206 20.6201 19.8119 20.8975 18.7767C20.9997 18.3952 20.9997 17.9302 20.9997 17.0002" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M16.4998 11.5002C16.4998 11.5002 13.1856 16.0002 11.9997 16.0002C10.8139 16.0002 7.49976 11.5002 7.49976 11.5002M11.9997 15.0002V3.00016" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`,
  send: `<path d="M22 2L11 13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
  view: `<path d="M2 8C2 8 6.47715 3 12 3C17.5228 3 22 8 22 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M21.544 13.045C21.848 13.4713 22 13.6845 22 14C22 14.3155 21.848 14.5287 21.544 14.955C20.1779 16.8706 16.6892 21 12 21C7.31078 21 3.8221 16.8706 2.45604 14.955C2.15201 14.5287 2 14.3155 2 14C2 13.6845 2.15201 13.4713 2.45604 13.045C3.8221 11.1294 7.31078 7 12 7C16.6892 7 20.1779 11.1294 21.544 13.045Z" stroke="currentColor" stroke-width="1.5"/><path d="M15 14C15 12.3431 13.6569 11 12 11C10.3431 11 9 12.3431 9 14C9 15.6569 10.3431 17 12 17C13.6569 17 15 15.6569 15 14Z" stroke="currentColor" stroke-width="1.5"/>`,
  repo: `<path d="M6 19.6231C5.31093 19.4279 4.76772 19.1317 4.31802 18.682C3 17.364 3 15.2426 3 11C3 6.75736 3 4.63604 4.31802 3.31802C5.63604 2 7.75736 2 12 2C16.2426 2 18.364 2 19.682 3.31802C21 4.63604 21 6.75736 21 11C21 15.2426 21 17.364 19.682 18.682C19.2323 19.1317 18.6891 19.4279 18 19.6231" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M12 20.1928C11.5858 20.1928 11.2525 20.5121 10.5858 21.1508C9.93941 21.77 9.61623 22.0796 9.34374 21.9824C9.31027 21.9705 9.27805 21.9548 9.24763 21.9355C9 21.7786 9 21.3111 9 20.3762L9 17.2512C9 15.7186 9 14.9523 9.43934 14.4761C9.87868 14 10.5858 14 12 14C13.4142 14 14.1213 14 14.5607 14.4761C15 14.9523 15 15.7186 15 17.2512V20.3762C15 21.3111 15 21.7786 14.7524 21.9355C14.7219 21.9548 14.6897 21.9705 14.6563 21.9824C14.3838 22.0796 14.0606 21.77 13.4142 21.1508C12.7475 20.5121 12.4142 20.1928 12 20.1928Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M8 10H16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M8 6L12 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>`,
  globe: `<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.5"/><path d="M3.6 9h16.8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M3.6 15h16.8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M12 3c2.6 2.4 4 5.6 4 9s-1.4 6.6-4 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 3c-2.6 2.4-4 5.6-4 9s1.4 6.6 4 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`,
  fork: `<circle cx="6" cy="6" r="2.5" stroke="currentColor" stroke-width="1.5"/><circle cx="18" cy="6" r="2.5" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="18" r="2.5" stroke="currentColor" stroke-width="1.5"/><path d="M6 8.5v1.5a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3V8.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 13v2.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>`,
  "chart-bar": `<rect x="6" y="10" width="4" height="6" rx="1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><rect x="14" y="6" width="4" height="10" rx="1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`,
  subscribe: `<path d="M6 3h12a2 2 0 0 1 2 2v15l-7-3-7 3V5a2 2 0 0 1 2-2z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 6v4M13 8h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>`,
  "subscribe-filled": `<path d="M6 3h12a2 2 0 0 1 2 2v15l-7-3-7 3V5a2 2 0 0 1 2-2z" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`,
  "identity-idtrust": `<path d="M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5zm0 10.9a5 5 0 110-10 5 5 0 010 10zm0-8.4a3.4 3.4 0 100 6.8 3.4 3.4 0 000-6.8zm-1 5.2v-1.5h2v1.5h-2zm0-2.3V5.5h2v1.9h-2z" fill="currentColor"/>`,
  "identity-github": `<path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.009-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836a9.59 9.59 0 012.504.337c1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z" fill="currentColor"/>`,
  "identity-phone": `<path d="M17 2H7a2 2 0 00-2 2v16a2 2 0 002 2h10a2 2 0 002-2V4a2 2 0 00-2-2zm-5 18a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm5-4.5a.5.5 0 01-.5.5h-9a.5.5 0 01-.5-.5v-11a.5.5 0 01.5-.5h9a.5.5 0 01.5.5v11z" fill="currentColor"/>`,
  "identity": `<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" fill="currentColor"/>`,
}

export type LocalIconName = keyof typeof localIcons

export interface LocalIconProps extends ComponentProps<"svg"> {
  name: LocalIconName
  size?: "small" | "normal" | "medium" | "large"
}

export function LocalIcon(props: LocalIconProps) {
  const [local, others] = splitProps(props, ["name", "size", "class", "classList"])
  return (
    <div data-component="icon" data-size={local.size || "normal"}>
      <svg
        data-slot="icon-svg"
        classList={{
          ...(local.classList || {}),
          [local.class ?? ""]: !!local.class,
        }}
        fill="none"
        viewBox="0 0 24 24"
        innerHTML={localIcons[local.name]}
        aria-hidden="true"
        {...others}
      />
    </div>
  )
}
