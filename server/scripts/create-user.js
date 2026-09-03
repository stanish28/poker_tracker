#!/usr/bin/env node
/**
 * Create a login account.
 *
 * Registration is closed (POST /api/auth/register was removed so the auth gate
 * cannot be bypassed by signing up), so accounts are provisioned here instead.
 *
 * The password is read from the terminal with echo disabled. It is never
 * printed, never written to disk, and never passed as a command-line argument
 * -- arguments are visible to `ps` and land in shell history.
 *
 *   node server/scripts/create-user.js
 *
 * With DATABASE_URL set (in the environment or server/.env) the account is
 * inserted directly. Without it, the script prints an INSERT statement carrying
 * the bcrypt hash, to paste into a database console instead:
 *
 *   node server/scripts/create-user.js --print-sql
 *
 * Without a terminal -- in a script, or to avoid the interactive prompt
 * entirely -- pass --stdin and supply three lines: username, email, password.
 * Use your shell's own hidden read so the password stays out of history:
 *
 *   read -rs -p 'Password: ' PW
 *   printf 'admin\nadmin@example.com\n%s\n' "$PW" |
 *     node server/scripts/create-user.js --stdin
 *
 * To make the new account the administrator that may merge players, set
 * ADMIN_USERNAME to its username and redeploy.
 */

const path = require('path');
const readline = require('readline');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const BCRYPT_ROUNDS = 12; // matches the cost of the existing account hashes
const PRINT_SQL = process.argv.includes('--print-sql');
const FROM_STDIN = process.argv.includes('--stdin');

/** Read every line of piped stdin, for --stdin mode. */
function readStdin() {
  return new Promise((resolve, reject) => {
    let buffer = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { buffer += chunk; });
    process.stdin.on('end', () => resolve(buffer.split('\n')));
    process.stdin.on('error', reject);
  });
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (answer) => {
    rl.close();
    resolve(answer.trim());
  }));
}

/**
 * Read a line with echo suppressed.
 *
 * readline cannot hide input on its own, so the tty is put into raw mode and
 * keystrokes are collected manually. Ctrl-C must be handled explicitly here,
 * because raw mode stops the terminal turning it into SIGINT.
 */
function askSecret(question) {
  return new Promise((resolve, reject) => {
    const { stdin, stdout } = process;
    if (!stdin.isTTY) {
      reject(new Error('A terminal is required to read the password without echoing it.'));
      return;
    }

    stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    let secret = '';
    const onData = (char) => {
      switch (char) {
        case '\n':
        case '\r':
        case '\u0004': // Ctrl-D
          stdin.setRawMode(false);
          stdin.pause();
          stdin.removeListener('data', onData);
          stdout.write('\n');
          resolve(secret);
          break;
        case '\u0003': // Ctrl-C
          stdin.setRawMode(false);
          stdin.pause();
          stdout.write('\n');
          process.exit(130);
          break;
        case '\u007f': // Backspace
        case '\b':
          secret = secret.slice(0, -1);
          break;
        default:
          // Ignore other control characters; take everything else verbatim.
          if (char >= ' ') secret += char;
      }
    };

    stdin.on('data', onData);
  });
}

function validate(username, email, password, confirmation) {
  if (!username) return 'A username is required.';
  if (username.length > 50) return 'Username must be 50 characters or fewer.';
  if (!email) return 'An email address is required.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'That email address is not valid.';
  if (password.length < 12) {
    return 'Password must be at least 12 characters. This account can merge and delete player data.';
  }
  if (password !== confirmation) return 'The passwords do not match.';
  return null;
}

async function main() {
  let username;
  let email;
  let password;
  let confirmation;

  if (FROM_STDIN) {
    const [u, e, p] = await readStdin();
    username = (u || '').trim();
    email = (e || '').trim();
    // Not trimmed: leading or trailing spaces are legitimate password characters.
    password = p === undefined ? '' : p.replace(/\r$/, '');
    confirmation = password; // a caller piping input has nothing to mistype against
  } else {
    console.log('\nCreate a Poker Tracker login.\n');
    username = await ask('Username: ');
    email = await ask('Email: ');
    password = await askSecret('Password (not shown): ');
    confirmation = await askSecret('Confirm password: ');
  }

  const problem = validate(username, email, password, confirmation);
  if (problem) {
    console.error(`\n${problem}`);
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const id = crypto.randomUUID();

  if (PRINT_SQL || !process.env.DATABASE_URL) {
    if (!process.env.DATABASE_URL && !PRINT_SQL) {
      console.log('\nDATABASE_URL is not set, so nothing was written. Run this SQL instead:');
    } else {
      console.log('\nRun this SQL against your database:');
    }
    // The hash is safe to display; the password itself is never echoed.
    console.log(
      `\nINSERT INTO users (id, username, email, password_hash, created_at, updated_at)\n` +
      `VALUES ('${id}', '${username.replace(/'/g, "''")}', '${email.replace(/'/g, "''")}', '${passwordHash}', NOW(), NOW());\n`
    );
    console.log(`Then set ADMIN_USERNAME=${username} to let this account merge players.\n`);
    return;
  }

  const { queryDatabase } = require('../db');

  const existing = await queryDatabase(
    'SELECT username, email FROM users WHERE username = $1 OR email = $2',
    [username, email]
  );
  if (Array.isArray(existing) && existing.length > 0) {
    const clash = existing[0].username === username ? 'username' : 'email address';
    console.error(`\nThat ${clash} is already taken. No account was created.`);
    process.exit(1);
  }

  const result = await queryDatabase(
    `INSERT INTO users (id, username, email, password_hash, created_at, updated_at)
     VALUES ($1, $2, $3, $4, NOW(), NOW())
     RETURNING id, username, email`,
    [id, username, email, passwordHash]
  );

  if (!result || result.error || !result.rows || result.rows.length === 0) {
    console.error(`\nCould not create the account: ${result?.message || 'unknown database error'}`);
    process.exit(1);
  }

  console.log(`\nCreated "${result.rows[0].username}" (${result.rows[0].email}).`);
  console.log(`\nTo let this account merge duplicate players, set ADMIN_USERNAME=${username}`);
  console.log('in your deployment environment and redeploy.\n');
  process.exit(0);
}

main().catch((error) => {
  console.error(`\nFailed: ${error.message}`);
  process.exit(1);
});
