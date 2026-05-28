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

async function migrate() {
  const argv = yargs(hideBin(process.argv)).argv;
  let project = /.*/;
if(argv.project){
  console.log('Filtered to Project: ', argv.project);
  project = argv.project;
}

  // Step 1: Fetch data from Harness
  if (argv.extract) {
    await fetchProjects();
    await fetchEnvironments(project);
    argv.excludeTargets ? null : await fetchTargets(project);
    await fetchTargetGroups(project);
    await fetchFeatureFlags(project);

  }
  // Step 2: Transform data to Split's format
  if (argv.transform) {
  // 
   transformProjects(project);
   transformEnvironments(project);
   argv.excludeTargets ? null :   transformTargets(project);
   transformTargetGroups(project);
   transformFeatureFlags(project);
  }
  // Step 3: Load transformed data into Split


  if (argv.load) {
    await loadProjects(project);
    await loadEnvironments(project);
    await loadSegments(project);
    await loadRuleBasedSegments(project);
    await loadFeatureFlags(project);
    argv.excludeTargets ? null : await loadTargets(project);
  }
}

// Run the migration
migrate();
