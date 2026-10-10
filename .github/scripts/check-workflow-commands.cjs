const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

// Exercise each workflow's actual shell command without running Garmin code.
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'garmin-command-check-'));
fs.writeFileSync(path.join(directory, 'yarn'), '#!/bin/sh\nprintf "%s\\n" "$@"\n', { mode: 0o700 });
let checked = 0;
try {
    for (const file of fs.readdirSync('.github/workflows')) {
        const source = fs.readFileSync(path.join('.github/workflows', file), 'utf8');
        const match = source.match(/^\s*run: (yarn .*\$(SYNC_COMMAND|MIGRATE_COMMAND).*)$/m);
        if (!match) continue;
        const options = source.match(/options:\n((?:\s+- [a-z_]+\n)+)/);
        assert.ok(options, `${file}: no command choices found`);
        for (const option of options[1].matchAll(/- ([a-z_]+)/g)) {
            const command = option[1];
            const result = spawnSync('bash', ['-e', '-c', match[1]], {
                encoding: 'utf8',
                env: { ...process.env, PATH: `${directory}:${process.env.PATH}`, [match[2]]: command },
            });
            assert.equal(result.status, 0, `${file}: shell command failed`);
            assert.equal(result.stdout.trim(), command, `${file}: Yarn received an incorrect script name`);
            checked++;
        }
    }
    assert.equal(checked, 24, 'Expected to check all choices in four Garmin workflows');
    console.log(`Workflow shell checks passed for ${checked} command choices.`);
} finally {
    fs.rmSync(directory, { recursive: true, force: true });
}
