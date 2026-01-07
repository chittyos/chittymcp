/**
 * Notion API Client
 * Handles evidence syncing to Notion databases
 */

import fetch from "node-fetch";
import { logger } from "../core/logger.js";

export class NotionClient {
  constructor(options = {}) {
    this.token = options.token || process.env.NOTION_TOKEN;
    this.databaseId = options.databaseId || process.env.NOTION_DATABASE_ID;
    this.version = "2022-06-28";
  }

  /**
   * Create a page in Notion database
   */
  async createPage(properties) {
    if (!this.token || !this.databaseId) {
      logger.warn("Notion not configured, skipping sync");
      return null;
    }

    try {
      const response = await fetch("https://api.notion.com/v1/pages", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
          "Notion-Version": this.version,
        },
        body: JSON.stringify({
          parent: { database_id: this.databaseId },
          properties,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Notion API error: ${error}`);
      }

      const result = await response.json();
      logger.info(`Created Notion page: ${result.id}`);
      return result;
    } catch (error) {
      logger.error(`Notion sync failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Sync evidence metadata to Notion
   */
  async syncEvidence(metadata, filePath) {
    const properties = {
      "Exhibit ID": {
        title: [{ text: { content: metadata.exhibit_id } }],
      },
      Filename: {
        rich_text: [{ text: { content: metadata.original_name } }],
      },
      Category: {
        select: { name: metadata.category },
      },
      Hash: {
        rich_text: [{ text: { content: metadata.hash } }],
      },
      Priority: {
        select: { name: metadata.priority },
      },
      "File Size": {
        number: metadata.file_size,
      },
      Processed: {
        date: { start: metadata.processed_at },
      },
      "Case ID": {
        rich_text: [{ text: { content: metadata.case_id } }],
      },
      "File Path": {
        rich_text: [{ text: { content: filePath } }],
      },
    };

    return this.createPage(properties);
  }
}
