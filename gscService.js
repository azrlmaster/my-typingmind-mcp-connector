/**
 * gscService.js
 * 
 * This module provides functions to interact with the Google Search Console API
 * using OAuth2 authentication.
 */
const { google } = require('googleapis');
const searchconsole = google.searchconsole('v1');

// --- Configuration & Authentication Setup ---

const GSC_OAUTH_CLIENT_ID = process.env.GSC_OAUTH_CLIENT_ID;
const GSC_OAUTH_CLIENT_SECRET = process.env.GSC_OAUTH_CLIENT_SECRET;
const GSC_OAUTH_REFRESH_TOKEN = process.env.GSC_OAUTH_REFRESH_TOKEN;
const GSC_OAUTH_REDIRECT_URI = process.env.GSC_OAUTH_REDIRECT_URI; // e.g., 'http://localhost' or your app's deployed callback

let oauth2Client;
let isAuthInitialized = false;

if (GSC_OAUTH_CLIENT_ID && GSC_OAUTH_CLIENT_SECRET && GSC_OAUTH_REFRESH_TOKEN && GSC_OAUTH_REDIRECT_URI) {
  oauth2Client = new google.auth.OAuth2(
    GSC_OAUTH_CLIENT_ID,
    GSC_OAUTH_CLIENT_SECRET,
    GSC_OAUTH_REDIRECT_URI
  );

  oauth2Client.setCredentials({
    refresh_token: GSC_OAUTH_REFRESH_TOKEN,
  });

  // Set the auth client globally for all google.searchconsole calls
  // The library will automatically use the refresh token to get new access tokens.
  google.options({ auth: oauth2Client });
  isAuthInitialized = true;
  console.log("gscService: OAuth2 client initialized successfully.");

} else {
  console.error("gscService: Missing one or more GSC OAuth environment variables (CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN, REDIRECT_URI). GSC Service will not be available.");
}

/**
 * Helper function to handle API errors.
 * @param {Error} error The error object from the API call.
 * @param {string} operationName The name of the operation being performed.
 * @throws {Error} Throws a new error with a more descriptive message.
 */
function handleApiError(error, operationName) {
  let errorMessage = `Error during GSC operation "${operationName}": ${error.message}`;
  if (error.response && error.response.data) {
    const apiError = error.response.data.error;
    if (apiError) {
      errorMessage += ` | API Error: ${apiError.code} ${apiError.message}`;
      if (apiError.status) errorMessage += ` (Status: ${apiError.status})`;
      if (apiError.errors && apiError.errors.length > 0) {
         errorMessage += ` | Details: ${apiError.errors.map(e => `${e.reason}: ${e.message}`).join(', ')}`;
      }
    }
    if (error.response.status === 401 && (apiError.message.includes('invalid_grant') || apiError.message.includes('Invalid Credentials'))) {
      errorMessage += ' | This might be due to an expired or revoked refresh token. Re-authorization may be needed.';
    }
  } else if (error.message.includes('No refresh token is set.')) {
     errorMessage += ' | OAuth refresh token is missing or not set correctly.';
  }
  console.error(errorMessage, error.stack); // Log the full stack for debugging
  throw new Error(errorMessage); // Re-throw a new error with combined info
}

// --- Sites API ---

/**
 * Lists all sites (properties) accessible by the authenticated user.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of site entries.
 */
async function listSites() {
  if (!isAuthInitialized) throw new Error("GSC Service not initialized due to missing OAuth credentials.");
  try {
    const res = await searchconsole.sites.list();
    return res.data.siteEntry || [];
  } catch (e) {
    handleApiError(e, 'listSites');
  }
}

/**
 * Gets a specific site's (property's) information.
 * @param {string} siteUrl The full URL of the site (e.g., 'sc-domain:example.com' or 'https://www.example.com/').
 * @returns {Promise<Object>} A promise that resolves to the site entry object.
 */
async function getSite(siteUrl) {
  if (!isAuthInitialized) throw new Error("GSC Service not initialized due to missing OAuth credentials.");
  if (!siteUrl) throw new Error("siteUrl parameter is required for getSite.");
  try {
    const res = await searchconsole.sites.get({ siteUrl });
    return res.data;
  } catch (e) {
    handleApiError(e, `getSite (${siteUrl})`);
  }
}

/**
 * Adds a site to the Search Console.
 * Note: The authenticated user must be an owner of the site.
 * @param {string} siteUrl The URL of the site to add.
 * @returns {Promise<void>} A promise that resolves when the site is added successfully.
 */
async function addSite(siteUrl) {
  if (!isAuthInitialized) throw new Error("GSC Service not initialized due to missing OAuth credentials.");
  if (!siteUrl) throw new Error("siteUrl parameter is required for addSite.");
  try {
    // The add operation does not return a body, so we just await its completion.
    await searchconsole.sites.add({ siteUrl });
    console.log(`gscService: Site "${siteUrl}" submitted for addition successfully.`);
    return { message: `Site "${siteUrl}" submitted for addition successfully. Verification may be required.` };
  } catch (e) {
    handleApiError(e, `addSite (${siteUrl})`);
  }
}

/**
 * Deletes a site from the Search Console.
 * Note: The authenticated user must be an owner of the site.
 * @param {string} siteUrl The URL of the site to delete.
 * @returns {Promise<void>} A promise that resolves when the site is deleted successfully.
 */
async function deleteSite(siteUrl) {
  if (!isAuthInitialized) throw new Error("GSC Service not initialized due to missing OAuth credentials.");
  if (!siteUrl) throw new Error("siteUrl parameter is required for deleteSite.");
  try {
    // The delete operation does not return a body.
    await searchconsole.sites.delete({ siteUrl });
    console.log(`gscService: Site "${siteUrl}" deleted successfully.`);
    return { message: `Site "${siteUrl}" deleted successfully.` };
  } catch (e) {
    handleApiError(e, `deleteSite (${siteUrl})`);
  }
}

// --- Search Analytics API ---

/**
 * Queries search analytics data for a site.
 * @param {string} siteUrl The URL of the site.
 * @param {string} startDate Start date in YYYY-MM-DD format.
 * @param {string} endDate End date in YYYY-MM-DD format.
 * @param {Array<string>} dimensions Array of dimensions (e.g., ['query'], ['page'], ['date', 'device']).
 * @param {Object} [options] Optional parameters.
 * @param {Array<Object>} [options.dimensionFilterGroups] Filter groups.
 * @param {string} [options.type='web'] Type of search (web, image, video, news, discover, googleNews).
 * @param {string} [options.aggregationType='auto'] Aggregation type (auto, byPage, byProperty).
 * @param {number} [options.rowLimit=1000] Maximum number of rows to return.
 * @param {number} [options.startRow=0] Zero-based start row for pagination.
 * @returns {Promise<Object>} A promise that resolves to the search analytics data (rows, totals, etc.).
 */
async function queryAnalytics(siteUrl, startDate, endDate, dimensions, options = {}) {
  if (!isAuthInitialized) throw new Error("GSC Service not initialized due to missing OAuth credentials.");
  if (!siteUrl || !startDate || !endDate || !dimensions || dimensions.length === 0) {
    throw new Error("siteUrl, startDate, endDate, and dimensions are required for queryAnalytics.");
  }

  const {
    dimensionFilterGroups,
    type = 'web',
    aggregationType = 'auto',
    rowLimit = 1000, // Default to a reasonable number
    startRow = 0,
  } = options;

  const requestBody = {
    startDate,
    endDate,
    dimensions,
    type,
    aggregationType,
    rowLimit,
    startRow,
  };

  if (dimensionFilterGroups) {
    requestBody.dimensionFilterGroups = dimensionFilterGroups;
  }

  try {
    const res = await searchconsole.searchanalytics.query({
      siteUrl,
      requestBody,
    });
    return res.data; // Contains 'rows', 'responseAggregationType', etc.
  } catch (e) {
    handleApiError(e, `queryAnalytics for ${siteUrl}`);
  }
}

// --- URL Inspection API ---

/**
 * Inspects a URL to get its indexing status and other information from Google's index.
 * @param {string} siteUrl The site URL to which the inspectionUrl belongs (e.g., 'sc-domain:example.com' or property URL).
 * @param {string} inspectionUrl The full URL to inspect.
 * @param {string} [languageCode='en-US'] The language code for the inspection results (IETF BCP-47 format).
 * @returns {Promise<Object>} A promise that resolves to the inspection result.
 */
async function inspectUrl(siteUrl, inspectionUrl, languageCode = 'en-US') {
  if (!isAuthInitialized) throw new Error("GSC Service not initialized due to missing OAuth credentials.");
  if (!siteUrl || !inspectionUrl) {
    throw new Error("siteUrl and inspectionUrl are required for inspectUrl.");
  }
  try {
    const res = await searchconsole.urlInspection.index.inspect({
      requestBody: {
        inspectionUrl,
        siteUrl,
        languageCode,
      },
    });
    return res.data.inspectionResult; // Contains 'indexStatusResult', 'inspectionResultLink', 'crawledAs', etc.
  } catch (e) {
    handleApiError(e, `inspectUrl for ${inspectionUrl}`);
  }
}

// --- Sitemaps API ---

/**
 * Lists the sitemaps-entries submitted for this site, or basic information about a specific sitemap.
 * @param {string} siteUrl The site's URL (e.g., 'https://www.example.com/').
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of sitemap objects.
 */
async function listSitemaps(siteUrl) {
  if (!isAuthInitialized) throw new Error("GSC Service not initialized due to missing OAuth credentials.");
  if (!siteUrl) throw new Error("siteUrl parameter is required for listSitemaps.");
  try {
    const res = await searchconsole.sitemaps.list({ siteUrl });
    return res.data.sitemap || [];
  } catch (e) {
    handleApiError(e, `listSitemaps for ${siteUrl}`);
  }
}

/**
 * Retrieves information about a specific sitemap.
 * @param {string} siteUrl The site's URL.
 * @param {string} feedpath The full URL of the sitemap (e.g., 'https://www.example.com/sitemap.xml').
 * @returns {Promise<Object>} A promise that resolves to the sitemap object.
 */
async function getSitemap(siteUrl, feedpath) {
  if (!isAuthInitialized) throw new Error("GSC Service not initialized due to missing OAuth credentials.");
  if (!siteUrl || !feedpath) {
    throw new Error("siteUrl and feedpath are required for getSitemap.");
  }
  try {
    const res = await searchconsole.sitemaps.get({ siteUrl, feedpath });
    return res.data;
  } catch (e) {
    handleApiError(e, `getSitemap for ${feedpath}`);
  }
}

/**
 * Submits a sitemap for a site.
 * @param {string} siteUrl The site's URL.
 * @param {string} feedpath The full URL of the sitemap to submit.
 * @returns {Promise<Object>} A promise that resolves to an object indicating submission status.
 */
async function submitSitemap(siteUrl, feedpath) {
  if (!isAuthInitialized) throw new Error("GSC Service not initialized due to missing OAuth credentials.");
  if (!siteUrl || !feedpath) {
    throw new Error("siteUrl and feedpath are required for submitSitemap.");
  }
  try {
    // The submit operation doesn't typically return a detailed body on success, just a 200 OK.
    await searchconsole.sitemaps.submit({ siteUrl, feedpath });
    console.log(`gscService: Sitemap "${feedpath}" submitted successfully for site "${siteUrl}".`);
    return { message: `Sitemap "${feedpath}" submitted successfully for site "${siteUrl}".` };
  } catch (e) {
    handleApiError(e, `submitSitemap for ${feedpath}`);
  }
}

/**
 * Deletes a sitemap for a site.
 * This will remove it from Google's processing queue, but Google may still crawl URLs discovered through it.
 * @param {string} siteUrl The site's URL.
 * @param {string} feedpath The full URL of the sitemap to delete.
 * @returns {Promise<Object>} A promise that resolves to an object indicating deletion status.
 */
async function deleteSitemap(siteUrl, feedpath) {
  if (!isAuthInitialized) throw new Error("GSC Service not initialized due to missing OAuth credentials.");
  if (!siteUrl || !feedpath) {
    throw new Error("siteUrl and feedpath are required for deleteSitemap.");
  }
  try {
    // The delete operation doesn't typically return a detailed body on success.
    await searchconsole.sitemaps.delete({ siteUrl, feedpath });
    console.log(`gscService: Sitemap "${feedpath}" deleted successfully for site "${siteUrl}".`);
    return { message: `Sitemap "${feedpath}" deleted successfully for site "${siteUrl}".` };
  } catch (e) {
    handleApiError(e, `deleteSitemap for ${feedpath}`);
  }
}

// --- Module Exports ---
module.exports = {
  isAuthInitialized, // So the calling module can check if GSC features are available
  listSites,
  getSite,
  addSite,
  deleteSite,
  queryAnalytics,
  inspectUrl,
  listSitemaps,
  getSitemap,
  submitSitemap,
  deleteSitemap,
};
