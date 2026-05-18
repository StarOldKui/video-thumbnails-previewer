import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

interface PackageJson {
  manifest: {
    permissions?: string[]
    host_permissions?: string[]
  }
}

function readPackage(): PackageJson {
  return JSON.parse(
    readFileSync(resolve(process.cwd(), "package.json"), "utf8")
  ) as PackageJson
}

describe("manifest policy", () => {
  it("keeps extension permissions narrow", () => {
    const permissions = readPackage().manifest.permissions || []

    expect(permissions.sort()).toEqual(["activeTab", "scripting", "storage"])
    expect(permissions).not.toContain("cookies")
    expect(permissions).not.toContain("tabs")
  })

  it("does not request broad host permissions", () => {
    const hostPermissions = readPackage().manifest.host_permissions || []

    expect(hostPermissions).not.toContain("<all_urls>")
    expect(hostPermissions).not.toContain("http://*/*")
    expect(hostPermissions).not.toContain("https://*/*")
  })

  it("does not request removed provider hosts", () => {
    const hostPermissions = readPackage().manifest.host_permissions || []

    expect(hostPermissions).not.toContain("*://*.sexkbj.com/*")
    expect(hostPermissions).not.toContain("https://layback.cc/*")
    expect(hostPermissions).not.toContain("*://*.koreanbj.club/*")
    expect(hostPermissions).not.toContain("https://jilliandescribecompany.com/*")
  })
})
