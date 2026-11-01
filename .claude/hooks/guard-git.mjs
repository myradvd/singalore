// Claude Code PreToolUse hook. Blocks Bash commands that could break main or skip the safety checks.
// Exit code 2 blocks the command and shows the reason to Claude. Exit code 0 lets it run.
import { execFileSync } from 'node:child_process';

const protectedBranches = ['main', 'master'];

// Reads all of standard input and returns it as one string.
async function readStandardInput()
{
  const chunks = [];
  for await (const chunk of process.stdin)
  {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

// Returns the name of the branch checked out in the given folder, or an empty string if unknown.
function currentBranch(folder)
{
  try
  {
    return execFileSync('git', ['branch', '--show-current'], { cwd: folder, encoding: 'utf8' }).trim();
  }
  catch
  {
    return '';
  }
}

// Splits a shell command line into its separate commands at &&, ||, ; and |.
function splitCommands(commandLine)
{
  return commandLine
    .split(/&&|\|\||;|\||\n/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

// Returns the reason a single command must be blocked, or null if it is safe.
function blockReason(command, branch)
{
  const onProtectedBranch = protectedBranches.includes(branch);
  const words = command.split(/\s+/);
  const isGit = /^git\b/.test(command);

  if (/--no-verify\b/.test(command))
  {
    return 'Skipping hooks with --no-verify is not allowed.';
  }
  if (isGit && words[1] === 'push')
  {
    if (words.some((word) => word === '-f' || word.startsWith('--force') || word.startsWith('+')))
    {
      return 'Force pushing is not allowed (CONTRIBUTING: block force pushes).';
    }
    const namesProtected = words.slice(2).some((word) =>
      protectedBranches.some((name) => word === name || word.endsWith(`:${name}`) || word.endsWith(`/${name}`)));
    if (namesProtected || (onProtectedBranch && words.length <= 4))
    {
      return 'Pushing to main is not allowed (CONTRIBUTING R1). Push your own branch and open a pull request.';
    }
  }
  if (isGit && onProtectedBranch && ['commit', 'merge', 'rebase', 'cherry-pick', 'revert', 'am'].includes(words[1]))
  {
    return `You are on ${branch}. Create a branch first: git checkout -b <short-name> (CONTRIBUTING R1).`;
  }
  if (isGit && words[1] === 'reset' && words.includes('--hard') && onProtectedBranch)
  {
    return 'git reset --hard on main is not allowed.';
  }
  if (/^npm\s+(install|i|add|uninstall|remove|rm|update|upgrade)\s+\S/.test(command) || /^npx\s+(-y\s+)?expo\s+install\b/.test(command))
  {
    return 'Adding, removing or upgrading packages needs the user\'s say so (CONTRIBUTING R6). Ask first.';
  }
  return null;
}

// Reads the hook input, checks every command in it and blocks the first unsafe one.
async function main()
{
  let input;
  try
  {
    input = JSON.parse(await readStandardInput());
  }
  catch
  {
    process.exit(0);
  }
  const commandLine = input?.tool_input?.command ?? '';
  const folder = input?.cwd || process.cwd();
  const branch = currentBranch(folder);
  for (const command of splitCommands(commandLine))
  {
    const reason = blockReason(command, branch);
    if (reason !== null)
    {
      process.stderr.write(`Blocked by .claude/hooks/guard-git.mjs: ${reason}\n`);
      process.exit(2);
    }
  }
  process.exit(0);
}

await main();
