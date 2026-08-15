'use strict';

const { spawn } = require('child_process');

/**
 * Build the process and HTTP execution surfaces shared by providers.
 * Both methods return the RawResult shape consumed by normalize().
 */
function makeRunner(timeoutMs, workDir) {
  function processRunner(cmd, args, opts = {}) {
    const ac = new AbortController();
    const cwd = opts.cwd || workDir;
    const proc = spawn(cmd, args, {
      signal: ac.signal,
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd,
      env: { ...process.env, ...opts.env },
    });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', d => { stdout += d; });
    proc.stderr.on('data', d => { stderr += d; });
    const timer = setTimeout(() => ac.abort(), timeoutMs);

    return new Promise(resolve => {
      let resolved = false;
      const done = (code, error_type = null) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timer);
        resolve({ stdout, stderr, code, error_type });
      };
      proc.on('close', code => done(code, code !== 0 ? 'nonzero' : null));
      proc.on('error', err => {
        if (err.name === 'AbortError') done('timeout', 'timeout');
        else if (err.code === 'ENOENT') done(-1, 'enoent');
        else done(-1, 'spawn_error');
      });
    });
  }

  async function request(url, opts = {}) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...opts, signal: ac.signal });
      const stdout = await response.text();
      return {
        stdout,
        stderr: response.ok ? '' : stdout,
        code: response.status,
        error_type: response.ok ? null : 'nonzero',
      };
    } catch (err) {
      return {
        stdout: '',
        stderr: err.message || '',
        code: err.name === 'AbortError' ? 'timeout' : -1,
        error_type: err.name === 'AbortError' ? 'timeout' : 'request_error',
      };
    } finally {
      clearTimeout(timer);
    }
  }

  return { process: processRunner, request };
}

module.exports = { makeRunner };
