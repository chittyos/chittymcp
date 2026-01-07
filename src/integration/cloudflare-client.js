/**
 * Cloudflare API Client
 * Handles Workers, KV, R2, and D1 operations
 */

import fetch from "node-fetch";
import { logger } from "../core/logger.js";

export class CloudflareClient {
  constructor(options = {}) {
    this.apiToken = options.apiToken || process.env.CLOUDFLARE_API_TOKEN;
    this.accountId = options.accountId || process.env.CLOUDFLARE_ACCOUNT_ID;
    this.baseUrl = "https://api.cloudflare.com/client/v4";
  }

  /**
   * Make API request to Cloudflare
   */
  async request(method, endpoint, body = null) {
    if (!this.apiToken || !this.accountId) {
      throw new Error("Cloudflare API credentials not configured");
    }

    const url = `${this.baseUrl}${endpoint}`;
    const options = {
      method,
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        "Content-Type": "application/json",
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, options);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(`Cloudflare API error: ${data.errors?.[0]?.message || response.statusText}`);
      }

      return data.result;
    } catch (error) {
      logger.error(`Cloudflare API request failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Deploy a Worker
   */
  async deployWorker(workerName, script, environment = "production") {
    logger.info(`Deploying worker: ${workerName} to ${environment}`);

    return this.request(
      "PUT",
      `/accounts/${this.accountId}/workers/scripts/${workerName}`,
      { script, bindings: [] }
    );
  }

  /**
   * Create KV namespace
   */
  async createKVNamespace(namespaceName) {
    logger.info(`Creating KV namespace: ${namespaceName}`);

    return this.request(
      "POST",
      `/accounts/${this.accountId}/storage/kv/namespaces`,
      { title: namespaceName }
    );
  }

  /**
   * List KV namespaces
   */
  async listKVNamespaces() {
    return this.request("GET", `/accounts/${this.accountId}/storage/kv/namespaces`);
  }

  /**
   * Create R2 bucket
   */
  async createR2Bucket(bucketName) {
    logger.info(`Creating R2 bucket: ${bucketName}`);

    return this.request(
      "POST",
      `/accounts/${this.accountId}/r2/buckets`,
      { name: bucketName }
    );
  }

  /**
   * List R2 buckets
   */
  async listR2Buckets() {
    return this.request("GET", `/accounts/${this.accountId}/r2/buckets`);
  }

  /**
   * Create D1 database
   */
  async createD1Database(databaseName) {
    logger.info(`Creating D1 database: ${databaseName}`);

    return this.request(
      "POST",
      `/accounts/${this.accountId}/d1/database`,
      { name: databaseName }
    );
  }

  /**
   * Execute D1 query
   */
  async executeD1Query(databaseId, query, parameters = []) {
    logger.debug(`Executing D1 query on database: ${databaseId}`);

    return this.request(
      "POST",
      `/accounts/${this.accountId}/d1/database/${databaseId}/query`,
      { sql: query, params: parameters }
    );
  }
}
