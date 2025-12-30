import { execSync } from 'child_process';

function run(command) {
    try {
        execSync(command, { stdio: 'inherit' });
    } catch (e) {
        // Allow failure for commit if no changes, but throw for others
        if (command.startsWith('git commit')) {
            console.log('ℹ️  No changes to commit or commit failed. Proceeding...');
            return;
        }
        process.exit(1);
    }
}

console.log('🔄 Syncing with remote...');

// 1. Add all changes
console.log('📦 Adding files...');
run('git add -A');

// 2. Commit with random hash
const hash = Math.random().toString(36).substring(7);
console.log(`📝 Committing with ID: ${hash}...`);
run(`git commit -m "Quick Sync: ${hash}"`);

// 3. Push
console.log('🚀 Pushing to remote...');
run('git push');

console.log('✅ Sync complete!');
