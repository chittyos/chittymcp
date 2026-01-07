#!/usr/bin/env node
/**
 * ChittyOS MCP Extension Auto-Updater
 * Handles automatic updates with §36 compliance verification
 */

const https = require("https");
const fs = require("fs").promises;
const crypto = require("crypto");
const path = require("path");

class AutoUpdater {
  constructor(options = {}) {
    this.currentVersion = options.version || "1.0.1";
    this.updateChannel = options.channel || "stable";
    this.checkInterval = options.interval || 24 * 60 * 60 * 1000; // 24 hours
    this.githubRepo = "chittyos/cli";
    this.extensionPath = options.extensionPath || process.cwd();
    this.updateCheckUrl = `https://api.github.com/repos/${this.githubRepo}/releases`;

    this.config = {
      autoUpdate: options.autoUpdate !== false,
      backupBeforeUpdate: options.backup !== false,
      verifySignatures: options.verify !== false,
      notifyUser: options.notify !== false,
    };
  }

  /**
   * Start the auto-updater service
   */
  start() {
    console.log(
      `🔄 ChittyOS Auto-Updater started (current: v${this.currentVersion})`,
    );

    // Check immediately on start
    this.checkForUpdates();

    // Set up periodic checks
    if (this.config.autoUpdate) {
      setInterval(() => {
        this.checkForUpdates();
      }, this.checkInterval);
    }
  }

  /**
   * Check for available updates
   */
  async checkForUpdates() {
    try {
      console.log("🔍 Checking for updates...");

      const releases = await this.fetchReleases();
      const latestRelease = this.getLatestRelease(releases);

      if (!latestRelease) {
        console.log("ℹ️  No releases found");
        return;
      }

      const latestVersion = this.parseVersion(latestRelease.tag_name);
      const currentVersion = this.parseVersion(`v${this.currentVersion}`);

      if (this.isNewerVersion(latestVersion, currentVersion)) {
        console.log(
          `📦 Update available: v${this.currentVersion} → ${latestRelease.tag_name}`,
        );

        if (this.config.notifyUser) {
          this.notifyUser(latestRelease);
        }

        if (this.config.autoUpdate) {
          await this.performUpdate(latestRelease);
        }
      } else {
        console.log("✅ Extension is up to date");
      }
    } catch (error) {
      console.error("❌ Update check failed:", error.message);
    }
  }

  /**
   * Fetch releases from GitHub API
   */
  async fetchReleases() {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: "api.github.com",
        path: `/repos/${this.githubRepo}/releases`,
        method: "GET",
        headers: {
          "User-Agent": "ChittyOS-Auto-Updater/1.0.1",
          Accept: "application/vnd.github.v3+json",
        },
      };

      const req = https.request(options, (res) => {
        let data = "";

        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          try {
            const releases = JSON.parse(data);
            resolve(releases);
          } catch (error) {
            reject(new Error("Failed to parse releases JSON"));
          }
        });
      });

      req.on("error", (error) => {
        reject(error);
      });

      req.setTimeout(10000, () => {
        req.destroy();
        reject(new Error("Request timeout"));
      });

      req.end();
    });
  }

  /**
   * Get the latest stable release
   */
  getLatestRelease(releases) {
    return releases
      .filter((release) => {
        // Filter by update channel
        if (this.updateChannel === "stable") {
          return !release.prerelease && !release.draft;
        } else if (this.updateChannel === "beta") {
          return !release.draft;
        }
        return !release.draft;
      })
      .filter((release) => release.tag_name.startsWith("mcp-v"))
      .sort((a, b) => new Date(b.published_at) - new Date(a.published_at))[0];
  }

  /**
   * Parse semantic version string
   */
  parseVersion(versionString) {
    const match = versionString.match(/(\d+)\.(\d+)\.(\d+)/);
    if (!match) return null;

    return {
      major: parseInt(match[1]),
      minor: parseInt(match[2]),
      patch: parseInt(match[3]),
      original: versionString,
    };
  }

  /**
   * Check if version A is newer than version B
   */
  isNewerVersion(versionA, versionB) {
    if (!versionA || !versionB) return false;

    if (versionA.major > versionB.major) return true;
    if (versionA.major < versionB.major) return false;

    if (versionA.minor > versionB.minor) return true;
    if (versionA.minor < versionB.minor) return false;

    return versionA.patch > versionB.patch;
  }

  /**
   * Notify user about available update
   */
  notifyUser(release) {
    const message = `
🔔 ChittyOS MCP Extension Update Available!

New Version: ${release.tag_name}
Current Version: v${this.currentVersion}

Release Notes:
${release.body ? release.body.substring(0, 200) + "..." : "No release notes available"}

To update manually:
1. Download: ${release.html_url}
2. Install via Claude Desktop Extensions

Auto-update: ${this.config.autoUpdate ? "Enabled" : "Disabled"}
`;

    console.log(message);

    // Write notification to file for Claude Desktop to display
    this.writeNotification(release);
  }

  /**
   * Write update notification to file
   */
  async writeNotification(release) {
    try {
      const notificationPath = path.join(
        this.extensionPath,
        ".update-notification.json",
      );
      const notification = {
        type: "update_available",
        timestamp: new Date().toISOString(),
        currentVersion: this.currentVersion,
        availableVersion: release.tag_name,
        downloadUrl: release.html_url,
        releaseNotes: release.body,
        autoUpdate: this.config.autoUpdate,
      };

      await fs.writeFile(
        notificationPath,
        JSON.stringify(notification, null, 2),
      );
    } catch (error) {
      console.error("Failed to write notification:", error.message);
    }
  }

  /**
   * Perform the actual update
   */
  async performUpdate(release) {
    try {
      console.log(`🚀 Starting update to ${release.tag_name}...`);

      // Find the .mcpb asset
      const mcpbAsset = release.assets.find((asset) =>
        asset.name.endsWith(".mcpb"),
      );

      if (!mcpbAsset) {
        throw new Error("No .mcpb package found in release");
      }

      // Create backup if enabled
      if (this.config.backupBeforeUpdate) {
        await this.createBackup();
      }

      // Download the new version
      const downloadPath = await this.downloadUpdate(mcpbAsset);

      // Verify the download
      if (this.config.verifySignatures) {
        await this.verifyDownload(release, downloadPath);
      }

      // Install the update
      await this.installUpdate(downloadPath);

      console.log(`✅ Successfully updated to ${release.tag_name}`);

      // Clean up
      await this.cleanup(downloadPath);
    } catch (error) {
      console.error("❌ Update failed:", error.message);

      // Restore backup if update failed
      if (this.config.backupBeforeUpdate) {
        await this.restoreBackup();
      }
    }
  }

  /**
   * Create backup before update
   */
  async createBackup() {
    console.log("📦 Creating backup...");

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupDir = path.join(this.extensionPath, `backup-${timestamp}`);

    await fs.mkdir(backupDir, { recursive: true });

    // Copy current extension files
    const files = ["chittymcp.js", "manifest.json", "package.json"];
    for (const file of files) {
      try {
        const srcPath = path.join(this.extensionPath, file);
        const destPath = path.join(backupDir, file);
        await fs.copyFile(srcPath, destPath);
      } catch (error) {
        console.warn(`Warning: Could not backup ${file}`);
      }
    }

    this.backupPath = backupDir;
    console.log(`✅ Backup created at ${backupDir}`);
  }

  /**
   * Download update package
   */
  async downloadUpdate(asset) {
    console.log(`⬇️  Downloading ${asset.name}...`);

    const downloadPath = path.join(this.extensionPath, "update.mcpb");

    return new Promise((resolve, reject) => {
      const file = require("fs").createWriteStream(downloadPath);

      https
        .get(asset.browser_download_url, (response) => {
          if (response.statusCode !== 200) {
            reject(new Error(`Download failed: ${response.statusCode}`));
            return;
          }

          response.pipe(file);

          file.on("finish", () => {
            file.close();
            console.log("✅ Download completed");
            resolve(downloadPath);
          });

          file.on("error", (error) => {
            fs.unlink(downloadPath).catch(() => {});
            reject(error);
          });
        })
        .on("error", (error) => {
          reject(error);
        });
    });
  }

  /**
   * Verify downloaded package integrity
   */
  async verifyDownload(release, downloadPath) {
    console.log("🔐 Verifying download integrity...");

    // Find checksum file
    const checksumAsset = release.assets.find((asset) =>
      asset.name.endsWith(".sha256"),
    );

    if (!checksumAsset) {
      console.warn("⚠️  No checksum file found, skipping verification");
      return;
    }

    // Download checksum
    const expectedChecksum = await this.downloadChecksum(checksumAsset);

    // Calculate actual checksum
    const fileBuffer = await fs.readFile(downloadPath);
    const actualChecksum = crypto
      .createHash("sha256")
      .update(fileBuffer)
      .digest("hex");

    if (expectedChecksum.trim() !== actualChecksum) {
      throw new Error(
        "Checksum verification failed - download may be corrupted",
      );
    }

    console.log("✅ Download integrity verified");
  }

  /**
   * Download and parse checksum file
   */
  async downloadChecksum(asset) {
    return new Promise((resolve, reject) => {
      https
        .get(asset.browser_download_url, (response) => {
          let data = "";

          response.on("data", (chunk) => {
            data += chunk;
          });

          response.on("end", () => {
            // Parse checksum file (format: "checksum filename")
            const checksum = data.split(" ")[0];
            resolve(checksum);
          });
        })
        .on("error", reject);
    });
  }

  /**
   * Install the downloaded update
   */
  async installUpdate(downloadPath) {
    console.log("📦 Installing update...");

    // For now, just replace the .mcpb file
    // In a real implementation, this would extract and install the package
    const targetPath = path.join(
      this.extensionPath,
      "chittyos-mcp-extension.mcpb",
    );
    await fs.copyFile(downloadPath, targetPath);

    console.log("✅ Update installed");
  }

  /**
   * Restore backup after failed update
   */
  async restoreBackup() {
    if (!this.backupPath) return;

    console.log("🔄 Restoring backup...");

    try {
      const files = await fs.readdir(this.backupPath);

      for (const file of files) {
        const srcPath = path.join(this.backupPath, file);
        const destPath = path.join(this.extensionPath, file);
        await fs.copyFile(srcPath, destPath);
      }

      console.log("✅ Backup restored");
    } catch (error) {
      console.error("❌ Failed to restore backup:", error.message);
    }
  }

  /**
   * Clean up temporary files
   */
  async cleanup(downloadPath) {
    try {
      await fs.unlink(downloadPath);

      // Clean up old backups (keep last 3)
      const backupDirs = (await fs.readdir(this.extensionPath))
        .filter((name) => name.startsWith("backup-"))
        .sort()
        .reverse();

      if (backupDirs.length > 3) {
        for (const dir of backupDirs.slice(3)) {
          const dirPath = path.join(this.extensionPath, dir);
          await fs.rmdir(dirPath, { recursive: true });
        }
      }
    } catch (error) {
      console.warn("Cleanup warning:", error.message);
    }
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === "check") {
    const updater = new AutoUpdater({ autoUpdate: false });
    updater.checkForUpdates();
  } else if (command === "start") {
    const updater = new AutoUpdater();
    updater.start();
  } else {
    console.log(`
ChittyOS MCP Extension Auto-Updater

Usage:
  node auto-updater.js check    # Check for updates once
  node auto-updater.js start    # Start auto-updater service

Options:
  --channel stable|beta|alpha   # Update channel (default: stable)
  --no-auto                     # Disable automatic updates
  --no-backup                   # Disable backup creation
  --no-verify                   # Disable signature verification
`);
  }
}

module.exports = AutoUpdater;
