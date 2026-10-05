const fetchProjects = require('./harness/getProjects');
const fetchEnvironments = require('./harness/getEnvironments');
const fetchTargets = require('./harness/getTargets');
const fetchTargetGroups = require('./harness/getTargetGroups');
const fetchFeatureFlags = require('./harness/getFeatureFlags');

const transformProjects = require('./transformers/transformProjects');
const transformEnvironments = require('./transformers/transformEnvironments');
const transformTargets = require('./transformers/transformTargets');
const transformTargetGroups = require('./transformers/transformTargetGroups');
const transformFeatureFlags = require('./transformers/transformFeatureFlags');

// const loadFeatureFlags = require('./split/loadFeatureFlags');
const loadProjects = require('./split/loadProjects');
const loadEnvironments = require('./split/loadEnvironments');
const loadSegments = require('./split/loadSegments');
const loadFeatureFlags = require('./split/loadFeatureFlags');
const loadTargets = require('./split/loadTargets');
const loadRuleBasedSegments = require('./split/loadRuleBasedSegments');

const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const fs = require('fs');

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function resolveProjectFilter(requested, projects) {
  if (!requested) {
    return /.*/;
  }

  const exactMatches = projects.filter(({ project: item }) =>
    item.identifier === requested || item.name === requested
  );
  const matches = exactMatches.length > 0
    ? exactMatches
    : projects.filter(({ project: item }) =>
        item.identifier.match(requested) || String(item.name || '').match(requested)
      );

  if (matches.length === 0) {
    console.log(`[migration] No project name or identifier matched "${requested}"`);
    return requested;
  }

  const identifiers = [...new Set(matches.map(({ project: item }) => item.identifier))];
  matches.forEach(({ project: item }) => {
    console.log(`[migration] Project name: ${item.name}`);
    console.log(`[migration] Project identifier: ${item.identifier}`);
  });
  return new RegExp(`^(${identifiers.map(escapeRegExp).join('|')})$`);
}

function readExtractedProjects() {
  return JSON.parse(fs.readFileSync('./data/projects.json')).data.content;
}

async function migrate() {
  const argv = yargs(hideBin(process.argv)).argv;
  let project = /.*/;
  if (argv.project) {
    console.log(`[migration] Project filter: ${argv.project}`);
    console.log('[migration] --project accepts the project identifier or the project name');
  }

  // Step 1: Fetch data from Harness
  if (argv.extract) {
    console.log('[migration] Extract phase started');
    const projects = await fetchProjects();
    if (!Array.isArray(projects)) {
      throw new Error('Project extraction failed. See the preceding API error.');
    }
    project = resolveProjectFilter(argv.project, projects);
    const matchingProjects = projects.filter(({ project: item }) =>
      item.identifier.match(project)
    );
    console.log(
      `[migration] ${matchingProjects.length} project(s) matched: ${
        matchingProjects.map(({ project: item }) => item.identifier).join(', ') || 'none'
      }`
    );
    if (matchingProjects.length === 0) {
      throw new Error(
        `No project identifier matched "${argv.project}". Check the spelling and data/projects.json.`
      );
    }

    console.log('[extract:environments] Starting');
    await fetchEnvironments(project);
    if (argv.excludeTargets) {
      console.log('[extract:targets] Skipped (--excludeTargets)');
    } else {
      console.log('[extract:targets] Starting');
      await fetchTargets(project);
    }
    console.log('[extract:target-groups] Starting');
    await fetchTargetGroups(project);
    console.log('[extract:feature-flags] Starting');
    await fetchFeatureFlags(project);
    console.log('[migration] Extract phase completed');
  }
  if ((argv.transform || argv.load) && !argv.extract && argv.project) {
    project = resolveProjectFilter(argv.project, readExtractedProjects());
  }

  // Step 2: Transform data to Split's format
  if (argv.transform) {
    console.log('[migration] Transform phase started');
    transformProjects(project);
    transformEnvironments(project);
    if (!argv.excludeTargets) {
      transformTargets(project);
    }
    transformTargetGroups(project);
    transformFeatureFlags(project);
    console.log('[migration] Transform phase completed');
  }

  // Step 3: Load transformed data into Split
  if (argv.load) {
    console.log('[migration] Load phase started');
    await loadProjects(project);
    await loadEnvironments(project);
    await loadSegments(project);
    await loadRuleBasedSegments(project);
    await loadFeatureFlags(project);
    if (!argv.excludeTargets) {
      await loadTargets(project);
    }
    console.log('[migration] Load phase completed');
  }

  console.log('[migration] Migration completed successfully');
}

// Run the migration
migrate().catch((error) => {
  console.error(`[migration] Failed: ${error.message}`);
  process.exit(1);
});
