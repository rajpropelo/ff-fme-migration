
# Harness to Split Feature Flags Migration Script

This project is designed to facilitate the migration of environments, feature flags, projects, targets, and target groups from Harness to Split. The migration process involves fetching data from Harness, transforming it to match Split's structure, and then loading the data into Split. 

## Prerequisites

Ensure you have the following installed:

- Node.js (v12.x or higher)
- npm (Node Package Manager)
- A valid API key for Harness
- A valid API key for Split

### Installation

1. Navigate into the project directory:

   ```bash
   cd harness-classic-to-fme
   ```

2. Install the dependencies:

   ```bash
   npm install
   ```

### Configuration

1. Open the `config.js` file review the environment variables and set them with your actual Harness and Split API keys and endpoints:

   ```javascript
   module.exports = {
     HARNESS_API_KEY: process.env.HARNESS_API_KEY,
     SPLIT_API_KEY: process.env.SPLIT_API_KEY, // Use a Harness Service Account Token here if you are using a migrated account (eg you access from app.harness.io)
     HARNESS_ACCOUNT_ID: process.env.HARNESS_ACCOUNT_ID,
     TARGET_HARNESS_ORG_ID: process.env.TARGET_HARNESS_ORG_ID, // (OPTIONAL) Your target harness org if are using a migrated account (must already exist)
     TARGET_HARNESS_ACCOUNT_ID: process.env.TARGET_HARNESS_ACCOUNT_ID, // (OPTIONAL) Your target harness account if are using a migrated account
     HARNESS_API_URLS: {
       PROJECTS: 'https://app.harness.io/gateway/api/v1/projects',
       TARGETS: 'https://app.harness.io/gateway/api/v1/targets',
       TARGET_GROUPS: 'https://app.harness.io/gateway/api/v1/target-groups',
       FEATURE_FLAGS: 'https://app.harness.io/gateway/api/v1/feature-flags',
     },
     SPLIT_API_URL: 'https://api.split.io/internal/api/v2/',
   };
   ```

### Usage

1. Run the migration script:

   ```bash
   node index.js [--extract] [--transform] [--load] [--excludeTargets] ?[--project] <string matching your project>
   ```

2. The script will fetch the following entities from Harness if `-extract` is passed: 
   - Environments
   - Projects
   - Targets
   - Target Groups
   - Feature Flags

   These will be saved as JSON files under the `data/` directory.

3. The script will then transform the data into a structure that Split can accept and save the transformed data under the `transformedData/` directory if `--transform` is passed.

4. You can adjust and edit any of the transformed data for your one time load.

4. Finally, the transformed data you've selected will be loaded into Split if `-load` is passed.

5. If `--excludeTargets` is passed, the script will not extract targets - this will make the transformed data smaller and faster to load. Targets in FME are mosly a nice to have for building targeting rules and do not affect flag evaluations

**NOTE:** It is possible to re-run as many times as you need. It will re-load segment memberships and flag definitions, but will not touch existing project level flag definitions, environments, or projects.

Run `npm test` to run the tests

### Transformation details

1. Projects will be transformed into Workspaces (Split Projects)
2. Limit of 100 projects
3. Environments will be passed into Split as environments
4. Targets will be made into an identities
5. Target groups with no attribute rules will come across as segments
6. Target groups with logical rules will come across as rule based segments
7. All flags will be user traffic type
8. No flag pipelines or jira integration supported
9. Target groups that use rules or are empty will not be transferred over (as there is no way to migrate)
10. JSON flags will come across as dynamic configuration 
11. All segments (from target groups) and identities (targets) will also be user trafficType
12. Owners on flags will not come across
13. Boolean flags will have to be on/off because `true` and `false` are reserved words for treatments
14. All randomization will be bucketed by the identifier
15. String treatment values that contain invalid characters for split (eg not -_azAZ09) will be stripped
16. Only projects and environments with feature flags will be loaded
17. String treatment values where the value is the empty string '' will be replaced with the string 'null'
18. `console.warn` will be emitted for anything that could not be transferred over or will need to be reviewed manually
19. All segments will be user traffic type
20. All case sensitivity issues may pop up - please ensure that you don't have multiple segments or flags with the same name and different cases



### Folder Structure

```
/harness-split-migration
  ├── config.js                 # Shared configuration file for API keys and URLs
  ├── harness/
  │   ├── __tests__             # tests
  │   ├── getProjects.js        # Fetch Harness projects
  │   ├── getTargets.js         # Fetch Harness targets
  │   ├── getTargetGroups.js    # Fetch Harness target groups
  │   └── getFeatureFlags.js    # Fetch Harness feature flags
  ├── split/
  │   ├── __tests__             # tests
  │   ├── loadFeatureFlags.js   # Load transformed feature flags into Split
  │   ├── loadEnvironments.js   # Load transformed environments into Split
  │   ├── loadProjects.js       # Load transformed projects into Split
  │   ├── loadTargets.js        # Load transformed targets into Split
  │   └── loadSegments.js       # Load transformed segments into Split
  ├── transformers/
  │   ├── __tests__             # tests
  │   ├── transformProjects.js  # Transform Harness projects to Split format
  │   ├── transformTargets.js   # Transform Harness targets to Split format
  │   ├── transformTargetGroups.js  # Transform Harness target groups to Split format
  │   └── transformFeatureFlags.js  # Transform Harness feature flags to Split format
  ├── data/                     # Contains fetched JSON files
  ├── transformedData/          # Contains JSON files transformed into Split's format
  ├── sample-command.sh         # Sample command to set environment variables and run a full transformation
  └── index.js                  # Main script to run the migration

```

### Customization

If you need to modify the transformation logic or the API endpoints, edit the respective files in the `transformers/` or `harness/` directories as needed. 

For example, to change how projects are transformed, edit `transformProjects.js` in the `transformers/` directory.


