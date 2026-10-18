import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as deploy from './deploy-cloud-run.mjs';
test('reviewable Cloud Run deployment helper exists', () => assert.equal(typeof deploy?.runPreflight, 'function'));
const run = test;
const options = { project: 'fictional-project-123', runtimeServiceAccount: 'starline-memory-runtime@fictional-project-123.iam.gserviceaccount.com',
  buildServiceAccount: 'starline-memory-build@fictional-project-123.iam.gserviceaccount.com', service: 'starline-memory-ai', runtimeRole: 'projects/fictional-project-123/roles/starlineMemoryGeminiCaller' };
function runner({ billing = true, missingAPI = false, bindings = true } = {}) {
  const calls = [];
  return { calls, async json(args) {
    calls.push(args);
    if (args[0] === 'projects' && args[1] === 'describe') return { projectId: options.project, lifecycleState: 'ACTIVE' };
    if (args[0] === 'billing') return { projectId: options.project, billingEnabled: billing };
    if (args[0] === 'services') return deploy.REQUIRED_APIS.filter((_, index) => !missingAPI || index !== 0).map(name => ({ config: { name } }));
    if (args[0] === 'iam' && args[1] === 'service-accounts') return { email: args[3], disabled: false };
    if (args[0] === 'iam' && args[1] === 'roles') return { includedPermissions: ['aiplatform.endpoints.predict', 'serviceusage.services.use'], stage: 'GA' };
    if (args[0] === 'projects' && args[1] === 'get-iam-policy') return { bindings: bindings ? [
      { role: options.runtimeRole, members: ['serviceAccount:' + options.runtimeServiceAccount] },
      { role: 'roles/run.builder', members: ['serviceAccount:' + options.buildServiceAccount] }
    ] : [] };
    if (args[0] === 'artifacts') return { name: 'source-repository', format: 'DOCKER' };
    throw new Error('Unexpected check');
  } };
}
run('project is always explicit and unsafe placeholder arguments are rejected', () => {
  assert.throws(() => deploy.parseArgs([]), /project/i);
  assert.throws(() => deploy.parseArgs(['--project', 'your-project-id']), /project/i);
  assert.throws(() => deploy.parseArgs(['--project', 'fictional-project-123', '--service', 'bad;touch /tmp/x']), /service/i);
  assert.equal(deploy.parseArgs(['--project', 'fictional-project-123']).mode, 'plan');
});
run('billing disabled stops preflight before any enable/build/deploy operation', async () => {
  const api = runner({ billing: false });
  await assert.rejects(deploy.runPreflight(options, api.json), /billing/i);
  assert.equal(api.calls.length, 2);
  assert.ok(api.calls.every(args => !args.includes('enable') && !args.includes('deploy')));
});
run('missing API or dedicated service account role stops clearly', async () => {
  await assert.rejects(deploy.runPreflight(options, runner({ missingAPI: true }).json), /API/i);
  await assert.rejects(deploy.runPreflight(options, runner({ bindings: false }).json), /role|binding/i);
});
run('preflight only reads the explicit project and accepts complete prerequisites', async () => {
  const api = runner();
  const result = await deploy.runPreflight(options, api.json);
  assert.equal(result.ready, true);
  assert.ok(api.calls.every(args => args.includes('--project=' + options.project)));
});
run('deploy plan pins resources, identities and no secrets or billing mutations', () => {
  const args = deploy.buildDeployArgs(options, '/tmp/allowlisted-context');
  for (const value of ['--region=asia-northeast1', '--min=0', '--max=1', '--min-instances=0', '--max-instances=1', '--cpu=1', '--memory=512Mi', '--concurrency=8', '--timeout=60s', '--cpu-throttling', '--no-cpu-boost']) assert.ok(args.includes(value), value);
  assert.ok(args.some(value => value.includes('GOOGLE_CLOUD_LOCATION=global') && value.includes('GEMINI_MODEL=gemini-3.5-flash')));
  assert.ok(args.includes('--service-account=' + options.runtimeServiceAccount));
  assert.ok(args.some(value => value.startsWith('--build-service-account=projects/')));
  assert.ok(!args.some(value => /API_KEY|credentials|billing|keys/.test(value)));
});
run('build context is allowlisted and never copies local environments or user data', async t => {
  const source = await mkdtemp(join(tmpdir(), 'memory-source-fixture-'));
  t.after(() => rm(source, { recursive: true, force: true }));
  await mkdir(join(source, 'public'));
  for (const file of deploy.BUILD_FILES) await writeFile(join(source, file), file);
  await writeFile(join(source, 'public', 'index.html'), '<title>Fictional</title>');
  await writeFile(join(source, '.env'), 'FAKE_TEST_ONLY=not-a-real-secret');
  await writeFile(join(source, 'chat.db'), 'not real user data');
  const context = await deploy.createBuildContext(source);
  t.after(context.cleanup);
  assert.equal(await readFile(join(context.path, 'public/index.html'), 'utf8'), '<title>Fictional</title>');
  await assert.rejects(readFile(join(context.path, '.env')));
  await assert.rejects(readFile(join(context.path, 'chat.db')));
});
