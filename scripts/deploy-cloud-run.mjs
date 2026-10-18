#!/usr/bin/env node
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, copyFile, readdir, lstat, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const exec = promisify(execFile);
const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const REQUIRED_APIS = ['run.googleapis.com', 'cloudbuild.googleapis.com', 'artifactregistry.googleapis.com', 'aiplatform.googleapis.com', 'iam.googleapis.com'];
export const BUILD_FILES = ['package.json', 'package-lock.json', 'server.mjs', 'ai.mjs', 'Dockerfile', '.dockerignore'];
const REQUIRED_RUNTIME_PERMISSIONS = ['aiplatform.endpoints.predict', 'serviceusage.services.use'];
const roleID = 'starlineMemoryGeminiCaller';
function requireValue(condition, message) { if (!condition) throw new Error(message); }
export function parseArgs(args) {
  const known = new Set(['project', 'service', 'runtime-service-account', 'build-service-account', 'mode', 'gcloud']);
  const raw = {};
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index]?.replace(/^--/, '');
    requireValue(args[index]?.startsWith('--') && known.has(key) && args[index + 1] && !args[index + 1].startsWith('--'), 'Use explicit --name value arguments; see --help.');
    requireValue(raw[key] === undefined, `Duplicate argument: --${key}`);
    raw[key] = args[index + 1];
  }
  const project = raw.project;
  requireValue(typeof project === 'string' && /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(project) && !/^(your-|example-|replace-)/.test(project), 'An explicit real --project ID is required; placeholders are rejected.');
  const service = raw.service || 'starline-memory-ai';
  requireValue(/^[a-z][a-z0-9-]{0,47}[a-z0-9]$/.test(service), 'Invalid Cloud Run service name.');
  const runtimeServiceAccount = raw['runtime-service-account'] || `starline-memory-runtime@${project}.iam.gserviceaccount.com`;
  const buildServiceAccount = raw['build-service-account'] || `starline-memory-build@${project}.iam.gserviceaccount.com`;
  const accountPattern = new RegExp(`^[a-z][a-z0-9-]{4,28}[a-z0-9]@${project}\\.iam\\.gserviceaccount\\.com$`);
  requireValue(accountPattern.test(runtimeServiceAccount) && accountPattern.test(buildServiceAccount) && runtimeServiceAccount !== buildServiceAccount, 'Use distinct dedicated runtime/build service accounts in the explicit project.');
  const mode = raw.mode || 'plan';
  requireValue(['plan', 'check', 'deploy'].includes(mode), 'mode must be plan, check or deploy.');
  return { project, service, runtimeServiceAccount, buildServiceAccount, runtimeRole: `projects/${project}/roles/${roleID}`, mode, gcloud: raw.gcloud || process.env.GCLOUD_BIN || 'gcloud' };
}
export function buildDeployArgs(options, source) {
  return ['run', 'deploy', options.service, `--project=${options.project}`, '--region=asia-northeast1', `--source=${source}`,
    `--service-account=${options.runtimeServiceAccount}`, `--build-service-account=projects/${options.project}/serviceAccounts/${options.buildServiceAccount}`,
    '--allow-unauthenticated', '--ingress=all', '--execution-environment=gen2', '--port=8080', '--cpu=1', '--memory=512Mi',
    '--concurrency=8', '--timeout=60s', '--min=0', '--max=1', '--min-instances=0', '--max-instances=1', '--cpu-throttling', '--no-cpu-boost',
    `--set-env-vars=NODE_ENV=production,GOOGLE_CLOUD_PROJECT=${options.project},GOOGLE_CLOUD_LOCATION=global,GEMINI_MODEL=gemini-3.5-flash`, '--quiet'];
}
export async function runPreflight(options, json) {
  const projectFlag = `--project=${options.project}`;
  const project = await json(['projects', 'describe', options.project, projectFlag, '--format=json(projectId,lifecycleState)']);
  requireValue(project.projectId === options.project && project.lifecycleState === 'ACTIVE', 'Project is inaccessible or is not ACTIVE. No deployment was attempted.');
  const billing = await json(['billing', 'projects', 'describe', options.project, projectFlag, '--format=json(projectId,billingEnabled)']);
  requireValue(billing.billingEnabled === true, 'Billing is not enabled for the explicit project. Stop: this helper never links billing or upgrades a payment plan.');
  const services = await json(['services', 'list', '--enabled', projectFlag, '--format=json(config.name)']);
  const enabled = new Set(services.map(service => service.config?.name));
  const missing = REQUIRED_APIS.filter(api => !enabled.has(api));
  requireValue(!missing.length, `Required API prerequisites are missing: ${missing.join(', ')}. Review the deployment guide; this helper never enables APIs automatically.`);
  for (const email of [options.runtimeServiceAccount, options.buildServiceAccount]) {
    const account = await json(['iam', 'service-accounts', 'describe', email, projectFlag, '--format=json(email,disabled)']);
    requireValue(account.email === email && !account.disabled, 'A dedicated service account is missing or disabled. Review setup; no key is created or downloaded.');
  }
  const role = await json(['iam', 'roles', 'describe', roleID, projectFlag, '--format=json(includedPermissions,stage,deleted)']);
  requireValue(!role.deleted && role.stage !== 'DISABLED'
    && REQUIRED_RUNTIME_PERMISSIONS.every(permission => role.includedPermissions?.includes(permission))
    && role.includedPermissions.every(permission => REQUIRED_RUNTIME_PERMISSIONS.includes(permission)), 'The dedicated runtime custom role must contain only aiplatform.endpoints.predict and serviceusage.services.use.');
  const policy = await json(['projects', 'get-iam-policy', options.project, projectFlag, '--format=json(bindings)']);
  const hasBinding = (email, expectedRole) => policy.bindings?.some(binding => binding.role === expectedRole && !binding.condition && binding.members?.includes(`serviceAccount:${email}`));
  requireValue(hasBinding(options.runtimeServiceAccount, options.runtimeRole), 'Runtime service account lacks the explicit unconditional custom role binding. Stop and review IAM setup.');
  requireValue(hasBinding(options.buildServiceAccount, 'roles/run.builder'), 'Build service account lacks its explicit roles/run.builder binding. Stop and review IAM setup.');
  for (const email of [options.runtimeServiceAccount, options.buildServiceAccount]) {
    requireValue(!policy.bindings?.some(binding => ['roles/owner', 'roles/editor'].includes(binding.role) && binding.members?.includes(`serviceAccount:${email}`)), 'A dedicated service account has Owner/Editor. Remove broad grants after administrator review before using this helper.');
  }
  const repository = await json(['artifacts', 'repositories', 'describe', 'cloud-run-source-deploy', '--location=asia-northeast1', projectFlag, '--format=json(name,format)']);
  requireValue(repository.format === 'DOCKER', 'The Cloud Run source-build Docker repository is not ready. Review the deployment guide.');
  return { ready: true, project: options.project, region: 'asia-northeast1', aiLocation: 'global', model: 'gemini-3.5-flash' };
}
export async function createBuildContext(source = sourceRoot) {
  const path = await mkdtemp(join(tmpdir(), 'starline-memory-build-'));
  const cleanup = () => rm(path, { recursive: true, force: true });
  try {
    for (const name of BUILD_FILES) {
      const file = join(source, name);
      requireValue((await lstat(file)).isFile(), `Build file is not an ordinary file: ${name}`);
      await copyFile(file, join(path, name));
    }
    async function copyPublic(relative = '') {
      const directory = join(source, 'public', relative);
      await mkdir(join(path, 'public', relative), { recursive: true });
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        requireValue(!entry.isSymbolicLink(), 'Public symlinks are not allowed in the isolated build context.');
        requireValue(!entry.name.startsWith('.'), 'Hidden files are not allowed in the public build directory.');
        const next = join(relative, entry.name);
        if (entry.isDirectory()) await copyPublic(next);
        else {
          requireValue(entry.isFile() && /\.(?:html|js|mjs|css|svg|png|webp|ico|json)$/.test(entry.name), 'Unexpected public file type; review before uploading source.');
          await copyFile(join(directory, entry.name), join(path, 'public', next));
        }
      }
    }
    await copyPublic();
    await writeFile(join(path, '.gcloudignore'), '.git\nnode_modules\n.env\n.env.*\n');
    return { path, cleanup };
  } catch (error) { await cleanup(); throw error; }
}
function makeJSONRunner(binary) {
  return async args => {
    try {
      const result = await exec(binary, args, { timeout: 30000, maxBuffer: 2 * 1024 * 1024, env: { ...process.env, CLOUDSDK_CORE_DISABLE_PROMPTS: '1' } });
      return JSON.parse(result.stdout);
    } catch { throw new Error(`Could not verify prerequisite (${args.slice(0, 3).join(' ')}). Check explicit-project access and login; no credentials or raw provider errors are printed.`); }
  };
}
async function deployProcess(binary, args) {
  await new Promise((accept, reject) => {
    const child = spawn(binary, args, { stdio: 'inherit', env: { ...process.env, CLOUDSDK_CORE_DISABLE_PROMPTS: '1' } });
    child.once('error', () => reject(new Error('gcloud could not be started.')));
    child.once('exit', code => code === 0 ? accept() : reject(new Error('Cloud Run deployment did not complete successfully. No successful URL is claimed.')));
  });
}
async function main() {
  if (process.argv.includes('--help')) {
    console.log('Usage: node scripts/deploy-cloud-run.mjs --project PROJECT_ID [--mode plan|check|deploy] [--runtime-service-account EMAIL] [--build-service-account EMAIL] [--service NAME] [--gcloud PATH]\nDefault plan is offline and performs no cloud operation. check reads prerequisites. deploy runs only after all checks pass. Never links billing, enables APIs, grants IAM, creates a key, or upgrades payment settings.');
    return;
  }
  const options = parseArgs(process.argv.slice(2));
  if (options.mode === 'plan') {
    console.log(JSON.stringify({ mode: 'OFFLINE_PLAN_ONLY', cloudOperationsExecuted: false, deploymentReady: false,
      prerequisiteGuide: 'docs/cloud-run-deployment.md', command: [options.gcloud, ...buildDeployArgs(options, '<temporary-allowlisted-build-context>')] }, null, 2));
    return;
  }
  const json = makeJSONRunner(options.gcloud);
  const result = await runPreflight(options, json);
  console.log(JSON.stringify({ ...result, checksOnly: options.mode === 'check', aiLiveVerified: false }));
  if (options.mode !== 'deploy') return;
  const context = await createBuildContext();
  try {
    await deployProcess(options.gcloud, buildDeployArgs(options, context.path));
    const deployed = await json(['run', 'services', 'describe', options.service, `--project=${options.project}`, '--region=asia-northeast1', '--format=json(status.url,status.latestReadyRevisionName)']);
    const url = deployed.status?.url;
    requireValue(typeof url === 'string' && /^https:\/\/[^/]+\.run\.app\/?$/.test(url) && deployed.status.latestReadyRevisionName, 'Deployment command returned but no ready Cloud Run URL could be verified.');
    console.log(JSON.stringify({ deployed: true, url, revision: deployed.status.latestReadyRevisionName, aiLiveVerified: false,
      next: `node scripts/live-smoke.mjs ${url}` }, null, 2));
  } finally { await context.cleanup(); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error.message); process.exitCode = 1; });
