import type { ProviderFeature } from "~providers/types"

export const pornHubFeatures: ProviderFeature[] = [
  {
    id: "pornhub-open-all",
    matches(url) {
      return url.pathname.includes("/model/") && url.pathname.includes("/videos")
    },
    mount(context) {
      const container = document.querySelector(".mediumPlayAllBtn.float-right")
      const videoSection = document.getElementById("mostRecentVideosSection")
      if (!container || !videoSection) return

      if (container.querySelector("[data-vtp-open-all]")) return

      const button = document.createElement("button")
      button.type = "button"
      button.dataset.vtpOpenAll = "1"
      button.textContent = "Open All"
      button.style.background = "#ff9000"
      button.style.border = "0"
      button.style.borderRadius = "4px"
      button.style.color = "#fff"
      button.style.cursor = "pointer"
      button.style.float = "right"
      button.style.fontWeight = "700"
      button.style.lineHeight = "normal"
      button.style.marginLeft = "10px"
      button.style.padding = "8px 12px"

      button.addEventListener("click", async () => {
        button.textContent = "Open All Clicked"
        button.style.background = "#cc7400"
        const links = Array.from(
          videoSection.querySelectorAll<HTMLAnchorElement>("a.linkVideoThumb")
        ).map((link) => new URL(link.href, location.origin).href)
        await context.openTabs(links)
      })

      container.prepend(button)
    }
  }
]
