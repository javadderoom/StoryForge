#!/usr/bin/env tsx
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';

const BAZAAR_API_BASE = 'https://api.pishkhan.cafebazaar.ir/v1';
const AUTH_HEADER_KEY = 'CAFEBAZAAR-PISHKHAN-API-SECRET';

interface DeployOptions {
  filePath?: string;
  architecture?: string;
  autoPublish: boolean;
  stagedRolloutPercentage: number;
  changelogFa?: string;
  changelogEn?: string;
  developerNote?: string;
  dryRun: boolean;
  shouldBuild: boolean;
  buildTarget: 'appbundle' | 'apk';
}

function printUsage() {
  console.log(`
========================================================================
   StoryForge / Afsanehsaz — Cafe Bazaar Pishkhan Deployment Tool
========================================================================

Usage:
  npx tsx scripts/deploy-bazaar.ts [options]
  npm run deploy:bazaar -- [options]

Options:
  --dry-run                     Validate credentials, API connectivity, and package binary without uploading or committing
  --file <path>                 Path to the .aab or .apk file (defaults to auto-detection)
  --build                       Trigger 'flutter build appbundle --release' before deployment
  --apk                         If --build is set, build APK instead of App Bundle
  --auto-publish                Auto-publish release after approval (default: false)
  --no-auto-publish             Do not auto-publish release after approval (default)
  --staged-rollout <1-100>      Rollout percentage (default: 100)
  --changelog-fa <text>         Persian changelog / what's new
  --changelog-en <text>         English changelog / what's new
  --developer-note <text>       Internal note for Cafe Bazaar review team
  --help, -h                    Show this help message

Examples:
  npx tsx scripts/deploy-bazaar.ts --dry-run
  npx tsx scripts/deploy-bazaar.ts --build --changelog-fa "بهبود عملکرد و رفع اشکالات"
  npx tsx scripts/deploy-bazaar.ts --file ../app/build/app/outputs/bundle/release/app-release.aab
`);
}

function parseArgs(args: string[]): DeployOptions {
  const options: DeployOptions = {
    autoPublish: false,
    stagedRolloutPercentage: 100,
    dryRun: false,
    shouldBuild: false,
    buildTarget: 'appbundle',
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--build') {
      options.shouldBuild = true;
    } else if (arg === '--apk') {
      options.buildTarget = 'apk';
    } else if (arg === '--auto-publish') {
      options.autoPublish = true;
    } else if (arg === '--no-auto-publish') {
      options.autoPublish = false;
    } else if (arg === '--file') {
      options.filePath = args[++i];
    } else if (arg.startsWith('--file=')) {
      options.filePath = arg.slice(7);
    } else if (arg === '--staged-rollout') {
      options.stagedRolloutPercentage = parseInt(args[++i], 10);
    } else if (arg.startsWith('--staged-rollout=')) {
      options.stagedRolloutPercentage = parseInt(arg.slice(17), 10);
    } else if (arg === '--changelog-fa' || arg === '--changelog') {
      options.changelogFa = args[++i];
    } else if (arg.startsWith('--changelog-fa=')) {
      options.changelogFa = arg.slice(15);
    } else if (arg === '--changelog-en') {
      options.changelogEn = args[++i];
    } else if (arg.startsWith('--changelog-en=')) {
      options.changelogEn = arg.slice(15);
    } else if (arg === '--developer-note') {
      options.developerNote = args[++i];
    } else if (arg.startsWith('--developer-note=')) {
      options.developerNote = arg.slice(17);
    } else if (arg === '--arch' || arg === '--architecture') {
      options.architecture = args[++i];
    } else if (arg.startsWith('--arch=')) {
      options.architecture = arg.slice(7);
    } else if (arg.startsWith('--architecture=')) {
      options.architecture = arg.slice(15);
    }
  }

  return options;
}

function loadEnvCredentials(): { secret: string; packageName: string } {
  const candidatePaths = [
    path.resolve('.env'),
    path.resolve('web/.env'),
    path.resolve('../web/.env'),
    path.resolve(__dirname, '../.env'),
    path.resolve(__dirname, '../../web/.env'),
  ];

  let secret = process.env.CAFEBAZAAR_PISHKHAN_API_SECRET || process.env['CAFEBAZAAR-PISHKHAN-API-SECRET'] || '';
  let packageName = process.env.BAZAAR_PACKAGE_NAME || 'com.afsanehsaz.app';

  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      try {
        const content = fs.readFileSync(p, 'utf8');
        for (const line of content.split('\n')) {
          const trimmed = line.trim();
          if (trimmed.startsWith('#')) continue;

          const secretMatch = trimmed.match(/^(?:CAFEBAZAAR_PISHKHAN_API_SECRET|CAFEBAZAAR-PISHKHAN-API-SECRET)=(.*)$/);
          if (secretMatch && !secret) {
            secret = secretMatch[1].trim().replace(/^['"]|['"]$/g, '');
          }

          const pkgMatch = trimmed.match(/^BAZAAR_PACKAGE_NAME=(.*)$/);
          if (pkgMatch && packageName === 'com.afsanehsaz.app') {
            packageName = pkgMatch[1].trim().replace(/^['"]|['"]$/g, '');
          }
        }
      } catch {
        // ignore
      }
    }
  }

  return { secret: secret.trim(), packageName: packageName.trim() };
}

function maskSecret(secret: string): string {
  if (secret.length <= 8) return '****';
  return `${secret.slice(0, 4)}...${secret.slice(-4)} (len: ${secret.length})`;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function findReleaseBinary(explicitPath?: string, preferAab = false): string | null {
  if (explicitPath) {
    const resolved = path.resolve(explicitPath);
    if (fs.existsSync(resolved)) return resolved;
    return null;
  }

  // Look for standard Flutter output locations (Cafe Bazaar REST API requires APKs for parsing)
  const apkCandidates = [
    path.resolve('app/build/app/outputs/flutter-apk/app-release.apk'),
    path.resolve('../app/build/app/outputs/flutter-apk/app-release.apk'),
    path.resolve(__dirname, '../../app/build/app/outputs/flutter-apk/app-release.apk'),
    path.resolve('app/build/app/outputs/apk/release/app-release.apk'),
    path.resolve('../app/build/app/outputs/apk/release/app-release.apk'),
    path.resolve(__dirname, '../../app/build/app/outputs/apk/release/app-release.apk'),
  ];

  const aabCandidates = [
    path.resolve('app/build/app/outputs/bundle/release/app-release.aab'),
    path.resolve('../app/build/app/outputs/bundle/release/app-release.aab'),
    path.resolve(__dirname, '../../app/build/app/outputs/bundle/release/app-release.aab'),
  ];

  const candidates = preferAab ? [...aabCandidates, ...apkCandidates] : [...apkCandidates, ...aabCandidates];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function triggerFlutterBuild(target: 'appbundle' | 'apk') {
  const appDirCandidates = [
    path.resolve('app'),
    path.resolve('../app'),
    path.resolve(__dirname, '../../app'),
  ];

  const appDir = appDirCandidates.find((d) => fs.existsSync(path.join(d, 'pubspec.yaml')));
  if (!appDir) {
    throw new Error('Flutter app directory not found. Could not execute build.');
  }

  const buildCmd = target === 'appbundle' ? 'flutter build appbundle --release' : 'flutter build apk --release';
  console.log(`\n📦 Triggering Flutter build in: ${appDir}`);
  console.log(`$ ${buildCmd}\n`);

  execSync(buildCmd, {
    cwd: appDir,
    stdio: 'inherit',
  });

  console.log('\n✅ Flutter build completed successfully.\n');
}

async function requestBazaar<T = any>(
  endpoint: string,
  method: 'GET' | 'POST',
  secret: string,
  body?: any,
  isMultipart = false
): Promise<T> {
  const url = `${BAZAAR_API_BASE}${endpoint}`;
  const headers: Record<string, string> = {
    [AUTH_HEADER_KEY]: secret,
    Accept: 'application/json',
  };

  if (!isMultipart && body) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(url, {
    method,
    headers,
    body: isMultipart ? body : body ? JSON.stringify(body) : undefined,
  });

  const responseText = await res.text();
  let json: any = {};
  try {
    json = JSON.parse(responseText);
  } catch {
    json = { raw: responseText };
  }

  if (!res.ok) {
    const errorMsg = json.message || json.detail || json.error || `HTTP ${res.status}: ${res.statusText}`;
    throw new Error(`Cafe Bazaar API error (${endpoint}): ${errorMsg} (HTTP ${res.status})`);
  }

  return json;
}

async function main() {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  console.log('\n======================================================');
  console.log('  🚀 Cafe Bazaar Pishkhan Automated Deployment');
  console.log('======================================================');

  if (options.dryRun) {
    console.log('🔍 Running in [DRY-RUN] mode (no changes will be submitted)\n');
  }

  // 1. Load credentials
  const { secret, packageName } = loadEnvCredentials();
  if (!secret) {
    console.error('❌ Error: Cafe Bazaar Pishkhan API secret not found!');
    console.error('Please configure CAFEBAZAAR_PISHKHAN_API_SECRET in your web/.env file.\n');
    process.exit(1);
  }

  console.log(`📦 Target Package: ${packageName}`);
  console.log(`🔑 API Secret:     ${maskSecret(secret)}`);

  // 2. Build if requested
  if (options.shouldBuild) {
    triggerFlutterBuild(options.buildTarget);
  }

  // 3. Locate release binary
  let binaryPath = findReleaseBinary(options.filePath);
  if (!binaryPath) {
    console.error(`\n❌ Error: No release binary (.aab or .apk) found!`);
    if (options.filePath) {
      console.error(`Specified file does not exist: ${options.filePath}`);
    } else {
      console.error('Searched in app/build/app/outputs/bundle/release and flutter-apk/');
      console.error('Tip: Run with --build to automatically build the bundle, e.g.:');
      console.error('     npx tsx scripts/deploy-bazaar.ts --build');
    }
    process.exit(1);
  }

  const fileStats = fs.statSync(binaryPath);
  const fileName = path.basename(binaryPath);
  const fileExt = path.extname(binaryPath).toLowerCase();

  console.log(`📁 Binary File:    ${fileName} (${formatBytes(fileStats.size)})`);
  console.log(`📍 Path:           ${binaryPath}`);

  // Calculate file hash for verification
  const fileBuffer = fs.readFileSync(binaryPath);
  const sha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex');
  console.log(`🔒 SHA256 Checksum: ${sha256.slice(0, 16)}...`);

  // 4. Test API Connectivity / Check uncommitted release
  console.log('\n⏳ Checking current release state on Cafe Bazaar...');
  const lastUncommitted = await requestBazaar('/apps/releases/last-uncommitted', 'GET', secret);

  const hasUncommitted = lastUncommitted.type !== 'not-exists';
  if (hasUncommitted) {
    console.log(`ℹ️ An uncommitted release draft already exists: ${lastUncommitted.message || 'Ready'}`);
  } else {
    console.log(`ℹ️ No uncommitted release found. A new release will be initialized.`);
  }

  if (options.dryRun) {
    console.log('\n----------------- [DRY RUN SUMMARY] -----------------');
    console.log(`✅ Authentication:      SUCCESS (Valid API Secret)`);
    console.log(`✅ Package File:         ${fileName} (${formatBytes(fileStats.size)})`);
    console.log(`✅ Target Application:   ${packageName}`);
    console.log(`✅ Rollout Percentage:   ${options.stagedRolloutPercentage}%`);
    console.log(`✅ Auto-Publish:         ${options.autoPublish ? 'YES' : 'NO'}`);
    if (options.changelogFa) console.log(`📝 Persian Changelog:    "${options.changelogFa}"`);
    if (options.changelogEn) console.log(`📝 English Changelog:    "${options.changelogEn}"`);
    if (options.developerNote) console.log(`📝 Developer Note:       "${options.developerNote}"`);
    console.log('-----------------------------------------------------');
    console.log('✨ Dry-run completed successfully! Remove --dry-run to deploy to Cafe Bazaar.\n');
    return;
  }

  // 5. Create new release if none exists
  if (!hasUncommitted) {
    console.log('\n📝 Creating new release draft on Cafe Bazaar...');
    const createRes = await requestBazaar('/apps/releases/', 'POST', secret, {});
    console.log(`✅ Release created: ${createRes.message || 'OK'}`);
  }

  // 6. Upload package binary (.aab or .apk)
  console.log(`\n⬆️ Uploading ${fileName} (${formatBytes(fileStats.size)}) to Cafe Bazaar...`);
  console.log('This may take 1-3 minutes depending on network bandwidth...');

  const startTime = Date.now();
  const form = new FormData();
  const fileBlob = await fs.openAsBlob(binaryPath, { type: 'application/vnd.android.package-archive' });
  form.append('apk', fileBlob, fileName);
  const detectedArch = options.architecture || (fileName.includes('arm64') ? 'arm64-v8a' : fileName.includes('armeabi') ? 'armeabi-v7a' : 'all');
  console.log(`📐 Architecture:    ${detectedArch}`);
  form.append('architecture', detectedArch);

  const uploadRes = await requestBazaar('/apps/releases/upload/', 'POST', secret, form, true);
  const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`✅ Package uploaded successfully in ${elapsedSec}s!`);
  if (uploadRes.package) {
    const pkg = uploadRes.package;
    if (pkg.version_name) console.log(`   - Version Name: ${pkg.version_name}`);
    if (pkg.version_code) console.log(`   - Version Code: ${pkg.version_code}`);
    if (pkg.apk_size) console.log(`   - Server Size:  ${formatBytes(pkg.apk_size)}`);
  }

  // 7. Commit release
  console.log('\n🚀 Committing release to Cafe Bazaar review queue...');
  const commitPayload = {
    auto_publish: options.autoPublish,
    staged_rollout_percentage: options.stagedRolloutPercentage,
    changelog_fa: options.changelogFa || '',
    changelog_en: options.changelogEn || '',
    developer_note: options.developerNote || 'Automated deployment via StoryForge CLI',
  };

  const commitRes = await requestBazaar('/apps/releases/commit/', 'POST', secret, commitPayload);

  console.log('\n======================================================');
  console.log('  🎉 DEPLOYMENT TO CAFE BAZAAR SUCCESSFUL!');
  console.log('======================================================');
  console.log(`📦 Status:       ${commitRes.message || 'Committed'}`);
  console.log(`⚙️ Auto-Publish: ${options.autoPublish ? 'Enabled' : 'Disabled (Requires manual publish after review)'}`);
  console.log(`📊 Rollout:      ${options.stagedRolloutPercentage}%`);
  console.log(`🌐 Dashboard:    https://pishkhan.cafebazaar.ir/apps/${packageName}/releases`);
  console.log('======================================================\n');
}

main().catch((err: any) => {
  console.error('\n❌ Deployment failed:');
  console.error(err.message || err);
  process.exit(1);
});
