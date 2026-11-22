// Reuse is deliberately limited to smoke-service infrastructure repairs. Any
// application, dependency, broad-test or production-schema change requires a new
// broad run. Original source IDs, commands and timestamps remain authoritative.
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const frontendAllowed=new Set(['scripts/run-coverage-resolution.cjs','scripts/coverage-process.cjs','scripts/coverage-process.test.cjs','scripts/coverage-reuse.cjs','scripts/coverage-reuse.test.cjs','docs/testing/coverage-resolution.md','smoke/payment-scratchpad.spec.ts','smoke/invoice-visits.spec.ts','smoke/screening-call.spec.ts','smoke/screening-pdf-viewer.spec.ts','smoke/canonical-ekg.spec.ts']);
const apiAllowed=new Set(['test/invoice-visits.integration.cjs','test/screening-call.integration.cjs','test/screening-pdf-viewer.fixture.cjs']);
function git(cwd,...args){return execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim()}
function verifyBroadReuse(file,gateFile,frontend,api,environment){
  const evidence=JSON.parse(fs.readFileSync(file)),gate=JSON.parse(fs.readFileSync(gateFile));
  if(!evidence.sources?.frontend||!evidence.sources?.api||gate.head!==evidence.sources.frontend)throw Error('Missing original broad source proof');
  const row=evidence.checks?.find(c=>c.label==='broad');
  if(!row||row.exit_code!==0||!row.finished_at)throw Error('Original broad check did not pass');
  const reportPath=path.resolve(row.log),relative=path.relative(path.dirname(path.resolve(file)),reportPath);
  if(relative.startsWith('..')||path.isAbsolute(relative))throw Error('Broad report must belong to its evidence folder');
  const report=JSON.parse(fs.readFileSync(reportPath));
  if(!report.stats?.expected||!Array.isArray(report.errors)||report.errors.length||['unexpected','skipped','flaky'].some(k=>report.stats[k]!==0))throw Error('Broad report has failures, flakes or skips');
  if(JSON.stringify(report.stats)!==JSON.stringify(row.stats))throw Error('Broad report statistics do not match the original receipt');
  const original={};
  for(const arg of gate.command.slice(1)){if(!arg.includes('='))break;const at=arg.indexOf('=');original[arg.slice(0,at)]=arg.slice(at+1)}
  for(const key of ['COVERAGE_FULL','TEST_API_CHECKOUT','TEST_MONGO_URL','PLAYWRIGHT_BASE_URL','PLAYWRIGHT_FIXTURE_BASE_URL','CLIENT_PORTAL_FIXTURE_BASE_URL','INVOICE_CLIENT_WEBSITE_URL','COVERAGE_IR_URL','REACT_APP_CLIENT_INVOICE_PREVIEW_URL'])
    if((original[key]||'')!==(environment[key]||''))throw Error('Broad environment changed: '+key);
  if(original.COVERAGE_FULL!=='1')throw Error('Original broad check was not complete coverage');
  const proof={};
  for(const [name,cwd,allowed]of [['frontend',frontend,frontendAllowed],['api',api,apiAllowed]]){
    const base=evidence.sources[name];git(cwd,'merge-base','--is-ancestor',base,'HEAD');
    const changed=git(cwd,'diff','--name-only',base+'..HEAD').split('\n').filter(Boolean);
    if(changed.some(p=>!allowed.has(p)))throw Error('Broad-affecting source changed in '+name+': '+changed.join(', '));
    proof[name]={tested_source:base,current_source:git(cwd,'rev-parse','HEAD'),changed_smoke_infrastructure_only:changed};
  }
  return {...row,reused:true,provenance:path.resolve(file),source_proof:proof,reuse_reason:'Only isolated smoke fixture wiring changed; application, schemas, broad tests, dependencies and environment unchanged. Original command, UTC times and sources retained.'};
}
module.exports={verifyBroadReuse};
