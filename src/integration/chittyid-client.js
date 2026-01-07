/**
 * ChittyID Service Client
 * Handles all communication with the ChittyID service (id.chitty.cc)
 */

import fetch from "node-fetch";
import { logger } from "../core/logger.js";

export class ChittyIDClient {
  constructor(options = {}) {
    this.serviceUrl = options.serviceUrl || process.env.CHITTYID_SERVICE || "https://id.chitty.cc";
    this.token = options.token || process.env.CHITTY_ID_TOKEN;
  }

  /**
   * Mint a new ChittyID
   * @param {string} entityType - Entity type (PEO, PLACE, PROP, EVNT, etc.)
   * @param {Object} metadata - Entity metadata
   * @returns {Object} ChittyID response
   */
  async mint(entityType, metadata = {}) {
    if (!this.token) {
      throw new Error("CHITTY_ID_TOKEN not configured");
    }

    try {
      logger.debug(`Minting ChittyID for entity type: ${entityType}`);

      const response = await fetch(`${this.serviceUrl}/v1/mint`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ entity_type: entityType, metadata }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ChittyID service returned ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      logger.info(`ChittyID minted: ${result.id}`);
      return result;
    } catch (error) {
      logger.error(`ChittyID mint failed: ${error.message}`);

      // Return mock ID for development/testing
      if (process.env.CHITTY_ENV === 'development') {
        const mockID = `CHITTY-${entityType}-${Date.now().toString(36).toUpperCase()}-MOCK`;
        logger.warn(`Using mock ChittyID: ${mockID}`);
        return {
          id: mockID,
          entity_type: entityType,
          metadata,
          mock: true,
          timestamp: new Date().toISOString(),
        };
      }

      throw error;
    }
  }

  /**
   * Validate a ChittyID format
   * @param {string} chittyId - ChittyID to validate
   * @returns {boolean} True if valid
   */
  validateFormat(chittyId) {
    // ChittyID format: VV-G-LLL-SSSS-T-YM-C-X
    const pattern = /^CHITTY-[A-Z]+-[A-Z0-9]+-[A-Z0-9]+$/;
    return pattern.test(chittyId);
  }

  /**
   * Check ChittyID service health
   * @returns {Object} Health status
   */
  async checkHealth() {
    try {
      const response = await fetch(`${this.serviceUrl}/health`);
      return {
        status: response.ok ? 'healthy' : 'unhealthy',
        statusCode: response.status,
      };
    } catch (error) {
      logger.error(`ChittyID health check failed: ${error.message}`);
      return {
        status: 'error',
        error: error.message,
      };
    }
  }
}
