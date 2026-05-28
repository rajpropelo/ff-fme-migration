module.exports = {
  HARNESS_API_KEY: process.env.HARNESS_API_KEY,
  HARNESS_ACCOUNT_ID: process.env.HARNESS_ACCOUNT_ID,
  SPLIT_API_KEY: process.env.SPLIT_API_KEY,
  TARGET_HARNESS_ORG_ID: process.env.TARGET_HARNESS_ORG_ID,
  TARGET_HARNESS_ACCOUNT_ID: process.env.TARGET_HARNESS_ACCOUNT_ID,
  HARNESS_API_URLS: {
    PROJECTS: 'https://app.harness.io/ng/api/projects',
    ENVIRONMENTS: 'https://app.harness.io/ng/api/environmentsV2',
    TARGETS: 'https://app.harness.io/cf/admin/targets',
    TARGET_GROUPS: 'https://app.harness.io/cf/admin/segments',
    FEATURE_FLAGS: 'https://app.harness.io/cf/admin/features',
  },
  SPLIT_API_URL: 'https://api.split.io/internal/api/v2/',
};
