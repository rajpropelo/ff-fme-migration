const axios = require('axios');
const { SPLIT_API_KEY, TARGET_HARNESS_ORG_ID, TARGET_HARNESS_ACCOUNT_ID } = require('../config');
// Initialize axios client

function createApiClient(baseURL) {
  if(TARGET_HARNESS_ORG_ID && TARGET_HARNESS_ACCOUNT_ID) {
    return axios.create({
      baseURL: baseURL,
      headers: {
        'x-api-key': SPLIT_API_KEY,
        'Content-Type': 'application/json',
      },
    });
  } else {
    return axios.create({
      baseURL: baseURL,
      headers: {
        Authorization: `Bearer ${SPLIT_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });
  }
}

let apiClient = createApiClient('https://api.split.io/internal/api/v2/');




// Helper function to sleep for a specified duration
const sleep = (milliseconds) => new Promise(resolve => setTimeout(resolve, milliseconds));

// Retry logic with exponential backoff
async function makeApiRequestWithRetry(config, baseURL = 'https://api.split.io/internal/api/v2/', maxRetries = 5, retryCount = 0) {
  try {
    apiClient = createApiClient(baseURL);
    const response = await apiClient(config);
    return response.data;
  } catch (error) {
    if (error.response && error.response.status === 429) {
      // Rate limit hit
      const retryAfterOrg = error.response.headers['x-ratelimit-reset-seconds-org'];
      const retryAfterIp = error.response.headers['x-ratelimit-reset-seconds-ip'];
      const retryAfterOrgFloat = parseFloat(retryAfterOrg);
      const retryAfterIpFloat = parseFloat(retryAfterIp);
      const retryAfter = Math.max(retryAfterOrgFloat, retryAfterIpFloat);
      const delay = retryAfter ? retryAfter * 1000 : Math.pow(2, retryCount) * 1000; // Exponential backoff
      console.log(`Rate limit hit. Retrying in ${delay / 1000} seconds...`);
      await sleep(delay);

      if (retryCount < maxRetries) {
        return makeApiRequestWithRetry(config, baseURL, maxRetries, retryCount + 1);
      } else {
        throw new Error('Max retries reached. Rate limit issue persists.');
      }
    } else {
      // Other errors (e.g., network issues, 500 errors, etc.)
      throw error;
    }
  }
}

// Export the function so it can be used in other files
module.exports = {
  makeApiRequestWithRetry,
};
